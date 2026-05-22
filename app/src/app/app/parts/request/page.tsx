'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Loader2,
  Send,
  Plus,
  X,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import type {
  MaintenanceBomItem,
  MaintenanceFreeformItem,
  PartCategory,
  PartsRequestUrgency,
} from '@/lib/types';

interface CatalogPart {
  id: string;
  display_name_ru: string;
  application_ru: string | null;
  category: PartCategory;
  compatible_machine_types: string[];
}

interface MachineOption {
  id: string;
  model_code: string;
  machine_type: string;
}

const URGENCY_STYLE: Record<PartsRequestUrgency, string> = {
  normal: 'border-secondary-200',
  urgent: 'border-amber-300 bg-amber-50/30',
  critical: 'border-accent-300 bg-accent-50/30',
};

export default function PartsRequestPage() {
  const t = useTranslations('parts.request_new');
  const router = useRouter();
  const { user } = useGlobal();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogPart[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [urgency, setUrgency] = useState<PartsRequestUrgency>('normal');
  const [machineId, setMachineId] = useState<string>('');
  const [parts, setParts] = useState<MaintenanceBomItem[]>([]);
  const [freeform, setFreeform] = useState<MaintenanceFreeformItem[]>([]);
  const [notes, setNotes] = useState('');

  // Catalog picker state
  const [pickerPartId, setPickerPartId] = useState('');
  const [pickerQty, setPickerQty] = useState('1');

  const urgencyLabel = (u: PartsRequestUrgency): string => {
    if (u === 'critical') return t('urgency_critical');
    if (u === 'urgent') return t('urgency_urgent');
    return t('urgency_normal');
  };
  const urgencyDesc = (u: PartsRequestUrgency): string => {
    if (u === 'critical') return t('urgency_critical_desc');
    if (u === 'urgent') return t('urgency_urgent_desc');
    return t('urgency_normal_desc');
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();

        const [profileResp, catalogResp, machinesResp] = await Promise.all([
          supabase.from('profiles').select('company_id').eq('id', user.id).single(),
          supabase
            .from('parts_catalog')
            .select('id, display_name_ru, application_ru, category, compatible_machine_types')
            .order('display_name_ru'),
          supabase
            .from('machines')
            .select('id, model_code, machine_type')
            .eq('status', 'active')
            .order('model_code'),
        ]);

        const cid = (profileResp.data as { company_id: string } | null)?.company_id;
        if (!cid) throw new Error(t('err_no_profile_company'));
        setCompanyId(cid);

        if (catalogResp.error) throw catalogResp.error;
        setCatalog((catalogResp.data ?? []) as CatalogPart[]);

        if (machinesResp.error) throw machinesResp.error;
        setMachines((machinesResp.data ?? []) as MachineOption[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('load_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, t]);

  const addCatalogPart = () => {
    if (!pickerPartId) return;
    const part = catalog.find((p) => p.id === pickerPartId);
    if (!part) return;
    const qty = parseFloat(pickerQty);
    if (!Number.isFinite(qty) || qty <= 0) return;

    setParts((prev) => {
      // If same part already in list, accumulate
      const idx = prev.findIndex((p) => p.part_id === part.id);
      if (idx >= 0) {
        return prev.map((p, i) => (i === idx ? { ...p, quantity: p.quantity + qty } : p));
      }
      return [
        ...prev,
        {
          part_id: part.id,
          display_name_ru: part.display_name_ru,
          quantity: qty,
          source: 'schedule_default',
        },
      ];
    });
    setPickerPartId('');
    setPickerQty('1');
  };

  const updatePartQty = (idx: number, qty: number) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: qty } : p)));
  };

  const removePart = (idx: number) => {
    setParts((prev) => prev.filter((_, i) => i !== idx));
  };

  const addFreeformItem = () => {
    setFreeform((prev) => [...prev, { description: '', quantity_estimate: 1, photo_url: null }]);
  };

  const updateFreeform = (idx: number, patch: Partial<MaintenanceFreeformItem>) => {
    setFreeform((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeFreeform = (idx: number) => {
    setFreeform((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setError(null);

    if (parts.length === 0 && freeform.length === 0) {
      setError(t('err_empty_request'));
      return;
    }
    if (parts.some((p) => !Number.isFinite(p.quantity) || p.quantity <= 0)) {
      setError(t('err_invalid_quantity'));
      return;
    }
    if (freeform.some((f) => f.description.trim().length < 3)) {
      setError(t('err_freeform_too_short'));
      return;
    }

    setSubmitting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      const { data: req, error: insertErr } = await supabase
        .from('parts_requests')
        .insert({
          company_id: companyId,
          machine_id: machineId || null,
          urgency,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          parts_requested: parts,
          parts_freeform: freeform,
          notes: notes.trim() || null,
          requested_by: user!.id,
        })
        .select('id')
        .single();
      if (insertErr || !req) throw insertErr ?? new Error(t('err_create_failed'));

      // replace (not push): drop the form from history so "back" lands on the
      // garage list, not back inside the just-submitted request form.
      router.replace(`/app/parts/request/${(req as { id: string }).id}`);
    } catch (err) {
      let msg: string;
      if (err instanceof Error) msg = err.message;
      else if (err && typeof err === 'object' && 'message' in err) msg = String((err as { message: unknown }).message);
      else msg = JSON.stringify(err);
      setError(`${t('err_submit_prefix')}: ${msg}`);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('loading')}
      </div>
    );
  }

  const URGENCY_LIST: PartsRequestUrgency[] = ['normal', 'urgent', 'critical'];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/app/parts"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('back_to_garage')}
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          {t('title')}
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          {t('subtitle')}
        </p>
        <p className="text-xs text-secondary-500 mt-2">
          {t('footnote')}
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Urgency */}
        <Card className="p-5">
          <Label className="mb-3 block">{t('urgency_label')}</Label>
          <div className="grid gap-2">
            {URGENCY_LIST.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                  urgency === u
                    ? `${URGENCY_STYLE[u]} ring-2 ring-primary-500`
                    : `${URGENCY_STYLE[u]} hover:border-primary-300`
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-secondary-900">
                  {u === 'critical' && <AlertTriangle className="w-4 h-4 text-accent-600" />}
                  {u === 'urgent' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                  {urgencyLabel(u)}
                </div>
                <p className="text-xs text-secondary-600 mt-0.5">{urgencyDesc(u)}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Optional machine binding */}
        <Card className="p-5">
          <Label htmlFor="machineId">{t('machine_label')}</Label>
          <Select
            id="machineId"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="mt-1"
          >
            <option value="">{t('machine_none')}</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_code} ({m.machine_type})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-secondary-500">
            {t('machine_hint')}
          </p>
        </Card>

        {/* Catalog parts */}
        <Card className="p-5">
          <h2 className="font-heading font-semibold text-secondary-900 mb-3">
            {t('catalog_section')}
          </h2>

          {parts.length > 0 && (
            <ul className="divide-y divide-secondary-100 mb-4">
              {parts.map((p, idx) => (
                <li key={`${p.part_id}-${idx}`} className="py-3 flex items-center gap-3">
                  <span className="flex-1 min-w-0 text-sm text-secondary-900">
                    {p.display_name_ru}
                  </span>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={p.quantity}
                    onChange={(e) => updatePartQty(idx, parseFloat(e.target.value) || 0)}
                    className="w-20 text-right tabular-nums"
                  />
                  <span className="text-xs text-secondary-500 w-8">{t('unit_pcs')}</span>
                  <button
                    type="button"
                    onClick={() => removePart(idx)}
                    className="text-secondary-400 hover:text-accent-600 p-1"
                    aria-label={t('remove_aria')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Picker */}
          <div className="flex items-end gap-2 pt-3 border-t border-secondary-100">
            <div className="flex-1 min-w-0">
              <Label htmlFor="pickerPart" className="text-xs">
                {t('picker_label')}
              </Label>
              <Select
                id="pickerPart"
                value={pickerPartId}
                onChange={(e) => setPickerPartId(e.target.value)}
                className="mt-1"
              >
                <option value="">{t('picker_placeholder')}</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name_ru} ({p.compatible_machine_types.join(', ') || '—'})
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-20">
              <Label htmlFor="pickerQty" className="text-xs">
                {t('picker_qty_label')}
              </Label>
              <Input
                id="pickerQty"
                type="number"
                step="1"
                min="1"
                value={pickerQty}
                onChange={(e) => setPickerQty(e.target.value)}
                className="mt-1 text-right"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCatalogPart} disabled={!pickerPartId}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Freeform parts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-secondary-900">
              {t('freeform_section')}
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addFreeformItem}>
              <Plus className="w-4 h-4" />
              {t('freeform_add')}
            </Button>
          </div>
          {freeform.length === 0 ? (
            <p className="text-sm text-secondary-500">
              {t('freeform_empty')}
            </p>
          ) : (
            <ul className="space-y-3">
              {freeform.map((item, idx) => (
                <li key={idx} className="border border-secondary-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Textarea
                      placeholder={t('freeform_placeholder')}
                      value={item.description}
                      onChange={(e) => updateFreeform(idx, { description: e.target.value })}
                      rows={2}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeFreeform(idx)}
                      className="text-secondary-400 hover:text-accent-600 p-1 mt-1"
                      aria-label={t('remove_aria')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-secondary-500">{t('freeform_qty_label')}</Label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={item.quantity_estimate ?? 1}
                        onChange={(e) =>
                          updateFreeform(idx, { quantity_estimate: parseFloat(e.target.value) || 1 })
                        }
                        className="w-16 text-right tabular-nums h-8"
                      />
                    </div>
                    {companyId && (
                      <PhotoUploader
                        bucket="parts-photos"
                        companyId={companyId}
                        context="request-freeform"
                        initialPath={item.photo_url}
                        onUploaded={(p) => updateFreeform(idx, { photo_url: p })}
                        onRemoved={() => updateFreeform(idx, { photo_url: null })}
                        onError={(e) => setError(e)}
                        compact
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Notes */}
        <Card className="p-5">
          <Label htmlFor="notes">{t('notes_label')}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notes_placeholder')}
            rows={3}
            className="mt-1"
          />
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button asChild type="button" variant="outline">
            <Link href="/app/parts">{t('cancel')}</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
