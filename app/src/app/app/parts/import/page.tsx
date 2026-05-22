'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface CatalogPart {
  id: string;
  display_name_ru: string;
  display_name_en: string | null;
  part_number: string | null;
}

type RowAction = 'matched' | 'pick' | 'custom' | 'skip';

interface ReviewRow {
  name: string;
  qty: number;
  article: string | null;
  matchedId: string | null; // catalog id auto-matched
  action: RowAction;
  pickedId: string; // when action='pick'
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-zа-я0-9]/gi, '').trim();

const ALL_MACHINE_TYPES = ['МЗВ', 'МСЗ', 'МСЗУ', 'МЗУ'];

type Step = 'upload' | 'map' | 'review' | 'done';

export default function PartsImportPage() {
  const t = useTranslations('parts_import');
  const router = useRouter();
  const { user } = useGlobal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogPart[]>([]);

  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Parsed sheet
  const [rows, setRows] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [nameCol, setNameCol] = useState<number>(-1);
  const [qtyCol, setQtyCol] = useState<number>(-1);
  const [articleCol, setArticleCol] = useState<number>(-1);

  const [review, setReview] = useState<ReviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const client = await createSPASassClient();
      const sb = client.getSupabaseClient();
      const { data: profile } = await sb
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      const cid = (profile as { company_id: string } | null)?.company_id ?? null;
      setCompanyId(cid);
      const { data } = await sb
        .from('parts_catalog')
        .select('id, display_name_ru, display_name_en, part_number');
      setCatalog((data ?? []) as CatalogPart[]);
    };
    load();
  }, [user]);

  // ---- Step 1: parse file ----
  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: '',
      });
      const asStrings: string[][] = raw.map((r) =>
        (r as unknown[]).map((c) => (c == null ? '' : String(c).trim()))
      );
      if (asStrings.length === 0) {
        setError(t('empty_file'));
        return;
      }
      setRows(asStrings);
      setHeaderRow(0);
      autoGuessColumns(asStrings[0]);
      setStep('map');
    } catch {
      setError(t('parse_failed'));
    } finally {
      setBusy(false);
    }
  };

  const autoGuessColumns = (header: string[]) => {
    const find = (keywords: string[]) =>
      header.findIndex((h) => {
        const n = norm(h);
        return keywords.some((k) => n.includes(k));
      });
    setNameCol(find(['назван', 'наимен', 'name', 'part', 'деталь', 'запчаст', 'description', 'товар']));
    setQtyCol(find(['колич', 'qty', 'quantity', 'количество', 'остаток', 'count', 'штук', 'amount']));
    setArticleCol(find(['артик', 'article', 'partnumber', 'sku', 'код', 'number', 'каталож']));
  };

  // ---- Step 2 → 3: build review with catalog matching ----
  const buildReview = () => {
    const dataRows = rows.slice(headerRow + 1);
    const byArticle = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const p of catalog) {
      if (p.part_number) byArticle.set(norm(p.part_number), p.id);
      byName.set(norm(p.display_name_ru), p.id);
      if (p.display_name_en) byName.set(norm(p.display_name_en), p.id);
    }

    const built: ReviewRow[] = [];
    for (const r of dataRows) {
      const name = (nameCol >= 0 ? r[nameCol] : '')?.trim() ?? '';
      const article = articleCol >= 0 ? (r[articleCol]?.trim() || null) : null;
      const qtyRaw = qtyCol >= 0 ? r[qtyCol] : '';
      const qty = parseFloat(String(qtyRaw).replace(',', '.'));
      if (!name && !article) continue; // skip empty rows
      let matchedId: string | null = null;
      if (article && byArticle.has(norm(article))) matchedId = byArticle.get(norm(article))!;
      else if (name && byName.has(norm(name))) matchedId = byName.get(norm(name))!;
      built.push({
        // 0 when the quantity is blank/unparseable — surfaced in review and
        // excluded from import until the user fills it in (never silently 1).
        name: name || article || '—',
        qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
        article,
        matchedId,
        action: matchedId ? 'matched' : 'custom',
        pickedId: '',
      });
    }
    setReview(built);
    setStep('review');
  };

  const setRow = (i: number, patch: Partial<ReviewRow>) =>
    setReview((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const summary = useMemo(() => {
    let matched = 0, custom = 0, skip = 0;
    for (const r of review) {
      if (r.action === 'skip') skip++;
      else if (r.action === 'matched' || r.action === 'pick') matched++;
      else custom++;
    }
    return { matched, custom, skip };
  }, [review]);

  // Only rows with a real quantity and not skipped are importable.
  const importable = review.filter((r) => r.action !== 'skip' && r.qty > 0);
  const missingQtyCount = review.filter((r) => r.action !== 'skip' && r.qty <= 0).length;

  // ---- Step 3: import ----
  // Throws on any DB error so the caller can count the row as failed.
  const upsertInventory = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sb: any,
    partId: string,
    qty: number
  ) => {
    const { data: existing } = await sb
      .from('parts_inventory')
      .select('id, quantity')
      .eq('company_id', companyId)
      .eq('part_id', partId)
      .is('machine_id', null)
      .maybeSingle();
    if (existing) {
      const { error: upErr } = await sb
        .from('parts_inventory')
        .update({
          quantity: Number(existing.quantity) + qty,
          last_replenished_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await sb.from('parts_inventory').insert({
        company_id: companyId,
        part_id: partId,
        machine_id: null,
        quantity: qty,
        last_replenished_at: new Date().toISOString(),
      });
      if (insErr) throw insErr;
    }
  };

  const handleImport = async () => {
    if (!companyId) return;
    if (importable.length === 0) {
      setError(t('nothing_to_import'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const sb = client.getSupabaseClient();
      let count = 0;
      let failed = 0;
      for (const r of importable) {
        try {
          let partId: string | null = null;
          if (r.action === 'matched') partId = r.matchedId;
          else if (r.action === 'pick') partId = r.pickedId || null;
          else if (r.action === 'custom') {
            const { data: created, error: cErr } = await sb
              .from('parts_catalog')
              .insert({
                display_name_ru: r.name,
                category: 'consumable',
                manufacturer: 'Прочее',
                // Unique enough to avoid part_number collisions across re-runs.
                part_number: r.article || `IMPORT-${crypto.randomUUID().slice(0, 8)}`,
                unit: 'pcs',
                compatible_machine_types: ALL_MACHINE_TYPES,
                is_custom: true,
                created_by_company_id: companyId,
              })
              .select('id')
              .single();
            if (cErr || !created) {
              failed++;
              continue;
            }
            partId = (created as { id: string }).id;
          }
          if (!partId) {
            failed++;
            continue;
          }
          await upsertInventory(sb, partId, r.qty);
          count++;
        } catch {
          failed++;
        }
      }
      setImportedCount(count);
      setFailedCount(failed);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import_failed'));
    } finally {
      setBusy(false);
    }
  };

  const headerCells = rows[headerRow] ?? [];
  const colOptions = headerCells.map((h, i) => ({ idx: i, label: h || `#${i + 1}` }));

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/app/parts"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('back')}
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">{t('title')}</h1>
        <p className="text-secondary-600 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs font-medium text-secondary-500">
        <span className={step === 'upload' ? 'text-primary-700' : ''}>1. {t('step_upload')}</span>
        <span>›</span>
        <span className={step === 'map' ? 'text-primary-700' : ''}>2. {t('step_map')}</span>
        <span>›</span>
        <span className={step === 'review' || step === 'done' ? 'text-primary-700' : ''}>3. {t('step_review')}</span>
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* STEP 1 — upload */}
      {step === 'upload' && (
        <Card className="p-8">
          <div
            className="border-2 border-dashed border-secondary-300 rounded-xl p-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            {busy ? (
              <div className="flex items-center justify-center text-secondary-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {t('parsing')}
              </div>
            ) : (
              <>
                <FileSpreadsheet className="w-10 h-10 text-secondary-400 mx-auto mb-3" />
                <p className="text-sm text-secondary-600">
                  {t('drop_hint')}{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary-600 hover:underline font-medium"
                  >
                    {t('browse')}
                  </button>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </>
            )}
          </div>
        </Card>
      )}

      {/* STEP 2 — map columns */}
      {step === 'map' && (
        <Card className="p-5 space-y-5">
          <p className="text-sm text-secondary-600">{t('rows_found', { count: rows.length })}</p>

          <div>
            <Label htmlFor="headerRow">{t('header_row')}</Label>
            <Select
              id="headerRow"
              value={String(headerRow)}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                setHeaderRow(idx);
                autoGuessColumns(rows[idx] ?? []);
              }}
              className="mt-1 max-w-[140px]"
            >
              {rows.slice(0, 5).map((_, i) => (
                <option key={i} value={i}>
                  {i + 1}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-secondary-500">{t('header_row_hint')}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>{t('col_name')}</Label>
              <Select value={String(nameCol)} onChange={(e) => setNameCol(parseInt(e.target.value, 10))} className="mt-1">
                <option value="-1">{t('col_select')}</option>
                {colOptions.map((c) => (
                  <option key={c.idx} value={c.idx}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('col_qty')}</Label>
              <Select value={String(qtyCol)} onChange={(e) => setQtyCol(parseInt(e.target.value, 10))} className="mt-1">
                <option value="-1">{t('col_select')}</option>
                {colOptions.map((c) => (
                  <option key={c.idx} value={c.idx}>{c.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('col_article')}</Label>
              <Select value={String(articleCol)} onChange={(e) => setArticleCol(parseInt(e.target.value, 10))} className="mt-1">
                <option value="-1">{t('col_none')}</option>
                {colOptions.map((c) => (
                  <option key={c.idx} value={c.idx}>{c.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary-400 mb-2">{t('preview')}</p>
            <div className="overflow-x-auto rounded-lg border border-secondary-200">
              <table className="w-full text-xs">
                <tbody>
                  {rows.slice(headerRow, headerRow + 4).map((r, ri) => (
                    <tr key={ri} className={ri === 0 ? 'bg-secondary-50 font-semibold' : 'border-t border-secondary-100'}>
                      {r.slice(0, 6).map((c, ci) => (
                        <td key={ci} className="px-2 py-1.5 text-secondary-700 whitespace-nowrap max-w-[160px] truncate">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {nameCol < 0 || qtyCol < 0 ? (
            <p className="text-xs text-amber-700">{t('need_name_qty')}</p>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={buildReview} disabled={nameCol < 0 || qtyCol < 0}>
              {t('to_review')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3 — review */}
      {step === 'review' && (
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-heading font-semibold text-secondary-900">{t('review_title')}</h3>
            <p className="text-xs text-secondary-500 mt-1">{t('review_hint')}</p>
          </div>

          <div className="space-y-2">
            {review.map((r, i) => {
              const isMatched = r.action === 'matched';
              const isCustom = r.action === 'custom';
              const isSkip = r.action === 'skip';
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    isSkip
                      ? 'border-secondary-200 bg-secondary-50 opacity-60'
                      : isMatched || r.action === 'pick'
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-amber-200 bg-amber-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {isMatched || r.action === 'pick' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : isSkip ? null : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-secondary-900 truncate">{r.name}</p>
                        {r.article && <p className="text-xs text-secondary-500 font-mono">{r.article}</p>}
                        <p className="text-[11px] text-secondary-500 mt-0.5">
                          {isMatched
                            ? t('matched')
                            : r.action === 'pick'
                              ? t('matched')
                              : isCustom
                                ? t('will_create')
                                : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={r.qty || ''}
                        onChange={(e) => setRow(i, { qty: parseFloat(e.target.value) || 0 })}
                        className={`w-20 h-9 text-right tabular-nums ${
                          !isSkip && r.qty <= 0 ? 'border-accent-400 ring-1 ring-accent-300' : ''
                        }`}
                      />
                      {!isSkip && r.qty <= 0 && (
                        <span className="text-[10px] text-accent-700">{t('qty_required')}</span>
                      )}
                    </div>
                  </div>

                  {/* Action controls for non-matched rows */}
                  {!isMatched && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Select
                        value={r.action === 'pick' ? r.pickedId : r.action}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === 'custom') setRow(i, { action: 'custom', pickedId: '' });
                          else if (v === 'skip') setRow(i, { action: 'skip', pickedId: '' });
                          else setRow(i, { action: 'pick', pickedId: v });
                        }}
                        className="flex-1 min-w-[200px] h-9 text-sm"
                      >
                        <option value="custom">{t('create_custom')}</option>
                        <option value="skip">{t('row_skip')}</option>
                        <optgroup label={t('pick_catalog')}>
                          {catalog.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name_ru}
                            </option>
                          ))}
                        </optgroup>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {missingQtyCount > 0 && (
            <p className="text-xs text-accent-700">
              {t('missing_qty_note', { count: missingQtyCount })}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-secondary-100">
            <p className="text-xs text-secondary-500 tabular-nums">
              {t('summary', { matched: summary.matched, custom: summary.custom, skip: summary.skip })}
            </p>
            <Button onClick={handleImport} disabled={busy || importable.length === 0}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {busy ? t('importing') : t('import_button', { count: importable.length })}
            </Button>
          </div>
        </Card>
      )}

      {/* DONE */}
      {step === 'done' && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <h3 className="font-heading font-semibold text-secondary-900 mb-1">{t('done_title')}</h3>
          <p className="text-sm text-secondary-600 mb-2">{t('done_desc', { count: importedCount })}</p>
          {failedCount > 0 && (
            <p className="text-sm text-accent-700 mb-6">{t('done_failed', { count: failedCount })}</p>
          )}
          <Button onClick={() => router.replace('/app/parts')}>{t('to_garage')}</Button>
        </Card>
      )}
    </div>
  );
}
