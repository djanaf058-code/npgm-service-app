'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Copy, Check, X, Users, Clock, AlertTriangle } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal, useRole } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { UserRole } from '@/lib/types';

interface MemberRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole | null;
  created_at: string;
}

interface InviteRow {
  id: string;
  token: string;
  role: UserRole;
  email: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  inviter: { full_name: string | null } | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  operator: 'Оператор',
  service_engineer: 'Сервисный инженер',
  project_manager: 'Проектный менеджер',
  company_admin: 'Руководитель сервисной службы',
  tier2_engineer: 'НПГМ Tier 2',
  platform_admin: 'Платформа',
};

export default function TeamPage() {
  const { user } = useGlobal();
  const { canManageCompany, loading: roleLoading } = useRole();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      // Get the caller's company_id so the queries are scoped to one tenant.
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      const cid = (profile as { company_id: string | null } | null)?.company_id;
      if (!cid) throw new Error('Профиль не привязан к компании');

      const [memberResp, inviteResp] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, phone, role, created_at')
          .eq('company_id', cid)
          .order('created_at', { ascending: true }),
        supabase
          .from('invites')
          .select(
            'id, token, role, email, expires_at, accepted_at, created_at, inviter:profiles!invites_invited_by_fkey(full_name)'
          )
          .eq('company_id', cid)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (memberResp.error) throw memberResp.error;
      if (inviteResp.error) throw inviteResp.error;
      setMembers((memberResp.data ?? []) as MemberRow[]);
      setInvites((inviteResp.data ?? []) as unknown as InviteRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && canManageCompany) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, canManageCompany]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Загрузка…
      </div>
    );
  }

  if (!canManageCompany) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h2 className="font-heading font-semibold text-secondary-900 mb-2">
            Раздел доступен только руководителю
          </h2>
          <p className="text-sm text-secondary-600">
            Управление командой и приглашения операторов — функция руководителя сервисной службы.
          </p>
        </Card>
      </div>
    );
  }

  const pendingInvites = invites.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date());
  const expiredInvites = invites.filter((i) => !i.accepted_at && new Date(i.expires_at) <= new Date());
  const acceptedInvites = invites.filter((i) => i.accepted_at);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">Команда</h1>
          <p className="text-secondary-600 text-sm mt-1">
            Сотрудники вашей компании и активные приглашения. Пригласите оператора по ссылке —
            подойдёт WhatsApp, Telegram или почта.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4" />
          Пригласить
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-accent-300 bg-accent-50/30">
          <p className="text-sm text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {/* Members */}
      <section>
        <h2 className="font-heading text-base font-semibold text-secondary-700 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Сотрудники ({members.length})
        </h2>
        {loading ? (
          <Card className="p-6 text-center text-secondary-500">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Загружаем…
          </Card>
        ) : members.length === 0 ? (
          <Card className="p-6 text-center text-secondary-500 text-sm">
            Пока вы один в компании. Пригласите коллег, чтобы они начали работу.
          </Card>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <Card key={m.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-secondary-900 truncate">
                    {m.full_name || '(имя не указано)'}
                    {m.id === user?.id && (
                      <span className="ml-2 text-xs text-secondary-500">(это вы)</span>
                    )}
                  </p>
                  {m.phone && <p className="text-xs text-secondary-500 truncate">{m.phone}</p>}
                </div>
                <Badge variant="outline">{m.role ? ROLE_LABELS[m.role] : '—'}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <section>
          <h2 className="font-heading text-base font-semibold text-secondary-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Активные приглашения ({pendingInvites.length})
          </h2>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <PendingInviteCard
                key={inv.id}
                invite={inv}
                onCancelled={reload}
                onError={(e) => setError(e)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Accepted (history) */}
      {acceptedInvites.length > 0 && (
        <section className="opacity-80">
          <h2 className="font-heading text-base font-semibold text-secondary-500 uppercase tracking-wider mb-3">
            Принято ({acceptedInvites.length})
          </h2>
          <div className="space-y-1.5">
            {acceptedInvites.slice(0, 5).map((inv) => (
              <p key={inv.id} className="text-xs text-secondary-500 px-3 py-1.5 rounded bg-secondary-50/60">
                {inv.email || '(ссылка без email)'} · {ROLE_LABELS[inv.role]} · принято{' '}
                {inv.accepted_at && new Date(inv.accepted_at).toLocaleDateString('ru-RU')}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Expired (collapsed) */}
      {expiredInvites.length > 0 && (
        <p className="text-xs text-secondary-400 text-center">
          ({expiredInvites.length} {expiredInvites.length === 1 ? 'приглашение' : 'приглашений'} истекли)
        </p>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setGeneratedUrl(null);
            reload();
          }
        }}
        onCreated={(url) => setGeneratedUrl(url)}
        generatedUrl={generatedUrl}
        onError={(e) => setError(e)}
      />
    </div>
  );
}

// =================== Pending invite card ===================

function PendingInviteCard({
  invite,
  onCancelled,
  onError,
}: {
  invite: InviteRow;
  onCancelled: () => void;
  onError: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = typeof window !== 'undefined' ? `${window.location.origin}/auth/invite/${invite.token}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError('Не удалось скопировать ссылку');
    }
  };

  const cancel = async () => {
    if (!confirm('Отменить приглашение? После этого ссылка не сработает.')) return;
    setBusy(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('cancel_invite', { p_id: invite.id });
      if (error) throw error;
      onCancelled();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="warning">{ROLE_LABELS[invite.role]}</Badge>
            {invite.email && <span className="text-sm text-secondary-700">{invite.email}</span>}
          </div>
          <p className="text-xs text-secondary-500 break-all">{url}</p>
          <p className="text-xs text-secondary-500 mt-1">
            истекает{' '}
            {new Date(invite.expires_at).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
            {invite.inviter?.full_name && <> · от {invite.inviter.full_name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Скопировано' : 'Скопировать'}
          </Button>
          <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>
            <X className="w-3 h-3" />
            Отменить
          </Button>
        </div>
      </div>
    </Card>
  );
}

// =================== Invite dialog ===================

function InviteDialog({
  open,
  onOpenChange,
  onCreated,
  generatedUrl,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (url: string) => void;
  generatedUrl: string | null;
  onError: (msg: string) => void;
}) {
  const [role, setRole] = useState<UserRole>('operator');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const submit = async () => {
    setLocalErr(null);
    setBusy(true);
    try {
      const resp = await fetch('/api/invites/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email: email.trim() || null }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? 'Не удалось создать приглашение');
      onCreated(json.url);
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
      onError('Не удалось скопировать ссылку');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Пригласить в команду</DialogTitle>
          <DialogDescription>
            Создайте ссылку и отправьте её сотруднику любым способом (WhatsApp, Telegram, почта).
            Когда он зарегистрируется по этой ссылке, он автоматически попадёт в вашу компанию с
            нужной ролью.
          </DialogDescription>
        </DialogHeader>

        {!generatedUrl ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="invite_role">Роль *</Label>
              <Select
                id="invite_role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1"
              >
                <option value="operator">Оператор</option>
                <option value="service_engineer">Сервисный инженер</option>
                <option value="project_manager">Проектный менеджер</option>
                <option value="company_admin">Руководитель сервисной службы</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="invite_email">Email (опционально)</Label>
              <Input
                id="invite_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@company.com"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-secondary-500">
                Если указать — ссылку сможет принять только этот email. Если оставить пустым,
                ссылка примет любого, кто откроет её первым.
              </p>
            </div>
            {localErr && (
              <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2">
                {localErr}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
              <p className="text-sm text-emerald-900 font-medium mb-2">
                Приглашение готово. Перешлите ссылку:
              </p>
              <p className="text-xs text-secondary-700 font-mono break-all bg-white border border-secondary-200 rounded p-2">
                {generatedUrl}
              </p>
            </div>
            <p className="text-xs text-secondary-500">
              Ссылка действует 14 дней. Можно отменить приглашение в любой момент в списке.
            </p>
          </div>
        )}

        <DialogFooter>
          {!generatedUrl ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Отмена
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Создать ссылку
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Закрыть
              </Button>
              <Button onClick={copyUrl}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Скопировано' : 'Скопировать ссылку'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
