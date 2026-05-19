'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Loader2,
  Building2,
  Truck,
  MessageSquareText,
  ShoppingCart,
  ChevronRight,
  Users,
  UserPlus,
  KeyRound,
  Link2,
  Copy,
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { createSPASassClient } from '@/lib/supabase/client';
import { RequestStatusBadge } from '@/components/parts/RequestStatusBadge';
import type {
  PartsRequestKind,
  PartsRequestStatus,
  PartsRequestUrgency,
  UserRole,
} from '@/lib/types';

interface Company {
  id: string;
  name: string;
  country: string;
  language: string;
  timezone: string;
  created_at: string;
}

interface MachineRow {
  id: string;
  machine_type: string;
  model_code: string;
  status: string;
  pit_location: string | null;
  tons_pumped: number;
}

interface TicketRow {
  id: string;
  status: string;
  title: string;
  created_at: string;
}

interface PartsRequestRow {
  id: string;
  kind: PartsRequestKind;
  status: PartsRequestStatus;
  urgency: PartsRequestUrgency;
  created_at: string;
  expected_delivery_date: string | null;
}

interface MemberRow {
  id: string;
  full_name: string | null;
  role: UserRole | null;
  created_at: string;
}

type InviteStatus = 'pending' | 'pre_registered' | 'consumed' | 'cancelled' | null;

interface InviteRow {
  id: string;
  token: string;
  role: UserRole;
  email: string | null;
  full_name: string | null;
  user_id: string | null;
  status: InviteStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// platform_admin can grant any non-tier-2 role into a tenant.
const ADMIN_GRANTABLE_ROLES: UserRole[] = ['operator', 'service_engineer', 'project_manager'];

export default function AdminCompanyOverviewPage() {
  const t = useTranslations('admin_company');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const companyId = params.id;

  const [company, setCompany] = useState<Company | null>(null);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [requests, setRequests] = useState<PartsRequestRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteCompanyOpen, setDeleteCompanyOpen] = useState(false);

  const reload = async () => {
    try {
      setError(null);
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();

      const [
        companyResp,
        machinesResp,
        ticketsResp,
        requestsResp,
        membersResp,
        invitesResp,
      ] = await Promise.all([
        sb.from('companies').select('*').eq('id', companyId).maybeSingle(),
        sb
          .from('machines')
          .select('id, machine_type, model_code, status, pit_location, tons_pumped')
          .eq('company_id', companyId)
          .order('model_code')
          .limit(20),
        sb
          .from('tickets')
          .select('id, status, title, created_at')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(10),
        sb
          .from('parts_requests')
          .select('id, kind, status, urgency, created_at, expected_delivery_date')
          .eq('company_id', companyId)
          .eq('kind', 'consolidated')
          .order('created_at', { ascending: false })
          .limit(10),
        sb
          .from('profiles')
          .select('id, full_name, role, created_at')
          .eq('company_id', companyId)
          .order('created_at', { ascending: true }),
        sb
          .from('invites')
          .select(
            'id, token, role, email, full_name, user_id, status, expires_at, accepted_at, created_at'
          )
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (companyResp.error) throw companyResp.error;
      if (machinesResp.error) throw machinesResp.error;
      if (ticketsResp.error) throw ticketsResp.error;
      if (requestsResp.error) throw requestsResp.error;
      if (membersResp.error) throw membersResp.error;
      if (invitesResp.error) throw invitesResp.error;

      setCompany(companyResp.data as Company | null);
      setMachines((machinesResp.data ?? []) as MachineRow[]);
      setTickets((ticketsResp.data ?? []) as TicketRow[]);
      setRequests((requestsResp.data ?? []) as PartsRequestRow[]);
      setMembers((membersResp.data ?? []) as MemberRow[]);
      setInvites((invitesResp.data ?? []) as unknown as InviteRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('loading')}
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-6 max-w-2xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> {t('back_to_companies')}
        </Link>
        <Card className="p-6 text-center">
          <p className="text-accent-700 whitespace-pre-wrap">{error ?? t('company_not_found')}</p>
        </Card>
      </div>
    );
  }

  const awaitingActivation = invites.filter((i) => i.status === 'pre_registered');
  const pendingLinks = invites.filter(
    (i) =>
      (i.status === 'pending' || i.status === null) &&
      !i.accepted_at &&
      new Date(i.expires_at) > new Date()
  );

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" /> {t('back_to_companies')}
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-xl md:text-2xl font-bold text-secondary-900 truncate">
                {company.name}
              </h1>
              <p className="text-sm text-secondary-500">
                {company.country || '—'} · {company.language} · {company.timezone}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteCompanyOpen(true)}
            className="text-accent-700 border-accent-300 hover:bg-accent-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('delete_company')}
          </Button>
        </div>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-600" />
            {t('team_section', { n: members.length })}
          </CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-3.5 h-3.5" />
            {t('add_member')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-secondary-500">
              {t('no_team')}
            </p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {members.map((m) => (
                <MemberRowItem
                  key={m.id}
                  member={m}
                  onChanged={reload}
                  onError={(e) => setError(e)}
                />
              ))}
            </ul>
          )}

          {awaitingActivation.length > 0 && (
            <div className="pt-2 border-t border-secondary-100">
              <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold mb-2 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-primary-600" />
                {t('pending_activation', { n: awaitingActivation.length })}
              </p>
              <ul className="space-y-1.5">
                {awaitingActivation.map((inv) => (
                  <AdminInviteRow
                    key={inv.id}
                    invite={inv}
                    kind="preregister"
                    onChanged={reload}
                    onError={(e) => setError(e)}
                  />
                ))}
              </ul>
            </div>
          )}

          {pendingLinks.length > 0 && (
            <div className="pt-2 border-t border-secondary-100">
              <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold mb-2 flex items-center gap-1">
                <Link2 className="w-3 h-3 text-amber-600" />
                {t('open_links', { n: pendingLinks.length })}
              </p>
              <ul className="space-y-1.5">
                {pendingLinks.map((inv) => (
                  <AdminInviteRow
                    key={inv.id}
                    invite={inv}
                    kind="anonymous"
                    onChanged={reload}
                    onError={(e) => setError(e)}
                  />
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Machines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary-600" />
            {t('fleet_section', { n: machines.length })}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => router.push(`/app/machines/new?company_id=${companyId}`)}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('add_machine')}
          </Button>
        </CardHeader>
        <CardContent>
          {machines.length === 0 ? (
            <p className="text-sm text-secondary-500">{t('no_machines')}</p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {machines.map((m) => (
                <MachineRowItem
                  key={m.id}
                  machine={m}
                  onChanged={reload}
                  onError={(e) => setError(e)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-primary-600" />
            {t('tickets_section', { n: tickets.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="text-sm text-secondary-500">{t('no_tickets')}</p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {tickets.map((tk) => (
                <li key={tk.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 truncate text-sm text-secondary-900">
                    {tk.title}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline">{tk.status}</Badge>
                    <Link
                      href={`/app/tickets/${tk.id}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      {t('open_link')}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Parts requests */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary-600" />
            {t('parts_section', { n: requests.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-secondary-500">{t('no_parts_requests')}</p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="py-2 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <RequestStatusBadge status={r.status} />
                    {r.urgency !== 'normal' && (
                      <Badge variant={r.urgency === 'critical' ? 'destructive' : 'warning'}>
                        {r.urgency}
                      </Badge>
                    )}
                    <span className="text-xs text-secondary-500">
                      {new Date(r.created_at).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs text-secondary-500">
                    {r.expected_delivery_date && (
                      <span>
                        ETA{' '}
                        {new Date(r.expected_delivery_date).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    )}
                    <Link
                      href={`/app/parts/request/${r.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      {t('open_link')}
                    </Link>
                    <ChevronRight className="w-4 h-4 text-secondary-300" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AdminInviteDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) reload();
        }}
        targetCompanyId={companyId}
        companyName={company.name}
        onError={(e) => setError(e)}
      />

      <DeleteCompanyDialog
        open={deleteCompanyOpen}
        onOpenChange={setDeleteCompanyOpen}
        company={company}
        onDeleted={() => router.push('/admin')}
        onError={(e) => setError(e)}
      />
    </div>
  );
}

// =========================================================================
// Member row — name + role + delete button
// =========================================================================

function MemberRowItem({
  member,
  onChanged,
  onError,
}: {
  member: MemberRow;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const t = useTranslations('admin_company');
  const tRoles = useTranslations('roles');
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (
      !confirm(
        t('delete_member_confirm', {
          name: member.full_name || t('delete_member_default_name'),
        })
      )
    )
      return;
    setBusy(true);
    try {
      const resp = await fetch('/api/admin/members/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? t('delete_member_failed'));
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="py-2 flex items-center justify-between gap-3 flex-wrap">
      <span className="text-sm text-secondary-900 font-medium min-w-0 flex-1 truncate">
        {member.full_name || t('no_name')}
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant="outline">{member.role ? tRoles(member.role) : '—'}</Badge>
        <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </li>
  );
}

// =========================================================================
// Machine row — type + model + delete button
// =========================================================================

function MachineRowItem({
  machine,
  onChanged,
  onError,
}: {
  machine: MachineRow;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const t = useTranslations('admin_company');
  const tCommon = useTranslations('common');
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (
      !confirm(t('delete_machine_confirm', { model: machine.model_code }))
    )
      return;
    setBusy(true);
    try {
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();
      const { error: delErr } = await sb.from('machines').delete().eq('id', machine.id);
      if (delErr) throw delErr;
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="py-2 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Badge variant="outline">{machine.machine_type}</Badge>
        <span className="text-sm font-medium text-secondary-900">{machine.model_code}</span>
        {machine.pit_location && (
          <span className="text-xs text-secondary-500">· {machine.pit_location}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-secondary-500 flex-shrink-0">
        <span className="tabular-nums">
          {Number(machine.tons_pumped).toLocaleString('ru-RU')} {tCommon('tons_short')}
        </span>
        <Link href={`/app/machines/${machine.id}`} className="text-primary-600 hover:underline">
          {t('open_link')}
        </Link>
        <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </li>
  );
}

// =========================================================================
// Delete company dialog — requires typing the name to confirm
// =========================================================================

function DeleteCompanyDialog({
  open,
  onOpenChange,
  company,
  onDeleted,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const t = useTranslations('admin_delete_company');
  const tCommon = useTranslations('common');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setConfirmText('');
      setLocalErr(null);
    }
  }, [open]);

  const submit = async () => {
    setLocalErr(null);
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
      const msg = e instanceof Error ? e.message : String(e);
      setLocalErr(msg);
      onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-accent-700">{t('title')}</DialogTitle>
          <DialogDescription>
            {t('desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-secondary-700">
            {t('confirm_part1')}{' '}
            <strong className="font-mono">{company.name}</strong>{' '}
            {t('confirm_part2')}
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={company.name}
            autoFocus
          />
          {localErr && (
            <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2 whitespace-pre-wrap">
              {localErr}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={busy || confirmText !== company.name}
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

// =========================================================================
// Admin invite row — copy link / delete
// =========================================================================

function AdminInviteRow({
  invite,
  kind,
  onChanged,
  onError,
}: {
  invite: InviteRow;
  kind: 'preregister' | 'anonymous';
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const t = useTranslations('admin_company');
  const tRoles = useTranslations('roles');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const path = kind === 'preregister' ? 'set-password' : 'invite';
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/${path}/${invite.token}`
      : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError(t('copy_link_failed'));
    }
  };
  const remove = async () => {
    const msg =
      kind === 'preregister'
        ? t('delete_preregister_confirm', {
            label: invite.full_name || invite.email || '',
          })
        : t('delete_anonymous_confirm');
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const resp = await fetch('/api/invites/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invite.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? t('cancel_invite_failed'));
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center justify-between gap-2 flex-wrap py-1">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Badge variant={kind === 'preregister' ? 'success' : 'warning'}>
            {tRoles(invite.role)}
          </Badge>
          {invite.full_name && (
            <span className="text-secondary-900 font-medium">{invite.full_name}</span>
          )}
          {invite.email && <span className="text-secondary-600">{invite.email}</span>}
        </div>
        <p className="text-xs text-secondary-500 break-all">{url}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
        </Button>
        <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    </li>
  );
}

// =========================================================================
// Admin invite dialog — pre-register or anonymous link into THIS company
// =========================================================================

type Mode = 'preregister' | 'link';

function AdminInviteDialog({
  open,
  onOpenChange,
  targetCompanyId,
  companyName,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetCompanyId: string;
  companyName: string;
  onError: (msg: string) => void;
}) {
  const t = useTranslations('admin_invite');
  const tCommon = useTranslations('common');
  const tCompany = useTranslations('admin_company');
  const tRoles = useTranslations('roles');
  const [mode, setMode] = useState<Mode>('preregister');
  const [role, setRole] = useState<UserRole>('project_manager');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setRole('project_manager');
      setEmail('');
      setFullName('');
      setLocalErr(null);
      setGeneratedUrl(null);
      setMode('preregister');
    }
  }, [open]);

  const submit = async () => {
    setLocalErr(null);
    setBusy(true);
    try {
      const endpoint =
        mode === 'preregister' ? '/api/invites/preregister' : '/api/invites/create';
      const payload =
        mode === 'preregister'
          ? {
              email: email.trim(),
              full_name: fullName.trim(),
              role,
              target_company_id: targetCompanyId,
            }
          : { role, email: email.trim() || null, target_company_id: targetCompanyId };
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? t('creation_failed'));
      setGeneratedUrl(`${window.location.origin}${json.path}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLocalErr(msg);
      onError(msg);
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError(tCompany('copy_link_failed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialog_title', { company: companyName })}</DialogTitle>
          <DialogDescription>
            {t('dialog_desc')}
          </DialogDescription>
        </DialogHeader>

        {!generatedUrl && (
          <div className="flex gap-1 p-1 bg-secondary-100 rounded-md text-xs font-medium">
            <button
              type="button"
              onClick={() => setMode('preregister')}
              className={`flex-1 px-3 py-1.5 rounded transition-colors ${
                mode === 'preregister'
                  ? 'bg-white text-secondary-900 shadow-sm'
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              {t('tab_preregister')}
            </button>
            <button
              type="button"
              onClick={() => setMode('link')}
              className={`flex-1 px-3 py-1.5 rounded transition-colors ${
                mode === 'link'
                  ? 'bg-white text-secondary-900 shadow-sm'
                  : 'text-secondary-600 hover:text-secondary-900'
              }`}
            >
              {t('tab_link')}
            </button>
          </div>
        )}

        {!generatedUrl ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="admin_invite_role">{t('field_role')}</Label>
              <Select
                id="admin_invite_role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1"
              >
                {ADMIN_GRANTABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tRoles(r)}
                  </option>
                ))}
              </Select>
            </div>

            {mode === 'preregister' ? (
              <>
                <div>
                  <Label htmlFor="admin_invite_name">{t('field_full_name')}</Label>
                  <Input
                    id="admin_invite_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('placeholder_full_name')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="admin_invite_email">{t('field_email')}</Label>
                  <Input
                    id="admin_invite_email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('placeholder_email')}
                    className="mt-1"
                  />
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="admin_invite_email_opt">{t('field_email_optional')}</Label>
                <Input
                  id="admin_invite_email_opt"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('placeholder_email')}
                  className="mt-1"
                />
              </div>
            )}

            {localErr && (
              <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2 whitespace-pre-wrap">
                {localErr}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
              <p className="text-sm text-emerald-900 font-medium mb-2">
                {mode === 'preregister'
                  ? t('preregister_link_ready')
                  : t('anonymous_link_ready')}
              </p>
              <p className="text-xs text-secondary-700 font-mono break-all bg-white border border-secondary-200 rounded p-2">
                {generatedUrl}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!generatedUrl ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {mode === 'preregister' ? t('create_account') : t('create_link')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('close')}
              </Button>
              <Button onClick={copyUrl}>
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
