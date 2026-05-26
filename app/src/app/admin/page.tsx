'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Truck,
  MessageSquareText,
  ShoppingCart,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Copy,
  Check,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { createSPASassClient } from '@/lib/supabase/client';

interface CompanyRow {
  id: string;
  name: string;
  country: string;
  updated_at: string;
}

interface Row extends CompanyRow {
  machines_count: number;
  open_tickets: number;
  active_parts_requests: number;
}

export default function AdminCompaniesPage() {
  const t = useTranslations('admin');
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [registerEngineerOpen, setRegisterEngineerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();

      const { data: companies, error: cErr } = await sb
        .from('companies')
        .select('id, name, country, updated_at')
        .order('name');
      if (cErr) throw cErr;

      const enriched: Row[] = await Promise.all(
        ((companies ?? []) as CompanyRow[]).map(async (c) => {
          const [m, t, p] = await Promise.all([
            sb
              .from('machines')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', c.id),
            sb
              .from('tickets')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', c.id)
              .neq('status', 'resolved')
              .neq('status', 'closed_self'),
            sb
              .from('parts_requests')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', c.id)
              .eq('kind', 'consolidated')
              .in('status', ['forwarded', 'quoted', 'approved', 'ordered']),
          ]);
          return {
            ...c,
            machines_count: m.count ?? 0,
            open_tickets: t.count ?? 0,
            active_parts_requests: p.count ?? 0,
          };
        })
      );
      setRows(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
            {t('companies_title')}
          </h1>
          <p className="text-secondary-600 text-sm mt-1">
            {t('companies_subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setRegisterEngineerOpen(true)}>
            <UserPlus className="w-4 h-4" />
            {t('register_engineer')}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            {t('create_company')}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-accent-300 bg-accent-50/30 mb-4">
          <p className="text-sm text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center text-secondary-500 py-10">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('loading_companies')}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Building2 className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
          <p className="text-sm text-secondary-600 mb-4">
            {t('no_companies')}
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            {t('create_first')}
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Link
                  href={`/admin/companies/${r.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1 hover:text-primary-700"
                >
                  <Building2 className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-secondary-900 truncate">{r.name}</p>
                    <p className="text-xs text-secondary-500">{r.country || '—'}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-5 text-xs text-secondary-600">
                  <span title={t('fleet_machines_count')}>
                    <Truck className="w-3 h-3 inline mr-1" />
                    {r.machines_count}
                  </span>
                  <span title={t('tickets_count')}>
                    <MessageSquareText className="w-3 h-3 inline mr-1" />
                    {r.open_tickets}
                  </span>
                  <span title={t('active_requests_count')}>
                    <ShoppingCart className="w-3 h-3 inline mr-1" />
                    {r.active_parts_requests}
                  </span>
                  <Link
                    href={`/admin/companies/${r.id}`}
                    className="text-primary-600 hover:underline text-xs"
                  >
                    {t('open_link')}
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-accent-700 border-accent-300 hover:bg-accent-50"
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateCompanyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          router.push(`/admin/companies/${id}`);
        }}
      />

      <DeleteCompanyDialog
        company={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          reload();
        }}
      />

      <RegisterEngineerDialog
        open={registerEngineerOpen}
        onOpenChange={setRegisterEngineerOpen}
      />
    </div>
  );
}

// =========================================================================
// Register NPGM service engineer (tier2_engineer) — cross-tenant, company-less.
// Pre-registers the account and returns a set-password activation link.
// =========================================================================

function RegisterEngineerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setErr(null);
      setLink(null);
      setCopied(false);
    }
  }, [open]);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const resp = await fetch('/api/invites/preregister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'tier2_engineer',
          email: email.trim(),
          full_name: name.trim(),
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? t('engineer_failed'));
      setLink(`${window.location.origin}${json.path}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can select the text manually */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('engineer_dialog_title')}</DialogTitle>
          <DialogDescription>{t('engineer_dialog_desc')}</DialogDescription>
        </DialogHeader>

        {!link ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="eng_name">{t('engineer_field_name')}</Label>
              <Input
                id="eng_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ivan Petrov"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="eng_email">{t('engineer_field_email')}</Label>
              <Input
                id="eng_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@npgm.ru"
              />
            </div>
            {err && (
              <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2 whitespace-pre-wrap">
                {err}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-emerald-900 font-medium">{t('engineer_created')}</p>
            <p className="text-xs text-secondary-700 font-mono break-all bg-white border border-secondary-200 rounded p-2">
              {link}
            </p>
          </div>
        )}

        <DialogFooter>
          {!link ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={submit}
                disabled={busy || name.trim().length < 2 || !email.trim()}
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('engineer_create')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('close')}
              </Button>
              <Button onClick={copy}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? tCommon('copied') : tCommon('copy')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// Create company dialog
// =========================================================================

function CreateCompanyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setCountry('');
      setErr(null);
    }
  }, [open]);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const resp = await fetch('/api/admin/companies/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, country: country || undefined }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? t('create_failed'));
      onCreated(json.company.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('create_dialog_title')}</DialogTitle>
          <DialogDescription>
            {t('create_dialog_desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cname">{t('field_name')}</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Modern Chemical & Service Company"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="ccountry">{t('field_country')}</Label>
            <Input
              id="ccountry"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Saudi Arabia"
            />
            <p className="text-xs text-secondary-500 mt-1">
              {t('country_default_hint')}
            </p>
          </div>
          {err && (
            <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2 whitespace-pre-wrap">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={submit} disabled={busy || name.trim().length < 2}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {tCommon('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// Delete company dialog — typed-name confirmation
// =========================================================================

function DeleteCompanyDialog({
  company,
  onClose,
  onDeleted,
}: {
  company: Row | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setConfirmText('');
      setErr(null);
    }
  }, [company]);

  const submit = async () => {
    if (!company) return;
    setErr(null);
    setBusy(true);
    try {
      const resp = await fetch('/api/admin/companies/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id, confirm_name: confirmText }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? t('delete_failed'));
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!company} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-accent-700">{t('delete_dialog_title')}</DialogTitle>
          <DialogDescription>
            {t('delete_dialog_desc')}
          </DialogDescription>
        </DialogHeader>
        {company && (
          <div className="space-y-3">
            <p className="text-sm text-secondary-700">
              {t('delete_confirm_prompt_part1')}{' '}
              <strong className="font-mono">{company.name}</strong>{' '}
              {t('delete_confirm_prompt_part2')}
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={company.name}
              autoFocus
            />
            {err && (
              <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2 whitespace-pre-wrap">
                {err}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !company || confirmText !== company.name}
            className="bg-accent-600 hover:bg-accent-700 text-white"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('delete_forever')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
