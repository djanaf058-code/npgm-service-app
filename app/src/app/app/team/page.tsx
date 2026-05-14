'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  UserPlus,
  Copy,
  Check,
  X,
  Users,
  AlertTriangle,
  KeyRound,
  Link2,
} from 'lucide-react';
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

// Map inviter role → which roles they can hand out. Centralised so the form
// and any future API checks line up.
function rolesForInviter(role: UserRole | null): UserRole[] {
  switch (role) {
    case 'service_engineer':
      return ['operator', 'service_engineer'];
    case 'project_manager':
    case 'platform_admin':
      return ['operator', 'service_engineer', 'project_manager'];
    default:
      return [];
  }
}

export default function TeamPage() {
  const { user } = useGlobal();
  const { role, canInviteTeam, loading: roleLoading } = useRole();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

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
            'id, token, role, email, full_name, user_id, status, expires_at, accepted_at, created_at, inviter:profiles!invites_invited_by_fkey(full_name)'
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
    if (user && canInviteTeam) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, canInviteTeam]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Загрузка…
      </div>
    );
  }

  if (!canInviteTeam) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h2 className="font-heading font-semibold text-secondary-900 mb-2">
            Раздел доступен только руководителям
          </h2>
          <p className="text-sm text-secondary-600">
            Управление командой — функция руководителя сервисной службы или проектного менеджера.
          </p>
        </Card>
      </div>
    );
  }

  // Pre-registered, awaiting first-time password.
  const awaitingActivation = invites.filter((i) => i.status === 'pre_registered');
  // Anonymous links, still good.
  const pendingLinks = invites.filter(
    (i) =>
      (i.status === 'pending' || i.status === null) &&
      !i.accepted_at &&
      new Date(i.expires_at) > new Date()
  );
  const expiredOrCancelled = invites.filter(
    (i) =>
      i.status === 'cancelled' ||
      (i.status !== 'consumed' &&
        !i.accepted_at &&
        new Date(i.expires_at) <= new Date() &&
        i.status !== 'pre_registered')
  );
  const acceptedInvites = invites.filter((i) => i.status === 'consumed' || i.accepted_at);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
            Команда
          </h1>
          <p className="text-secondary-600 text-sm mt-1">
            Зарегистрируйте сотрудника заранее (он только придумает пароль) или поделитесь
            анонимной ссылкой, по которой человек зарегистрируется сам.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4" />
          Добавить сотрудника
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-accent-300 bg-accent-50/30">
          <p className="text-sm text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {/* Active members */}
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
            Пока вы один в компании. Добавьте коллег, чтобы они начали работу.
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

      {/* Pre-registered, awaiting first-time password */}
      {awaitingActivation.length > 0 && (
        <section>
          <h2 className="font-heading text-base font-semibold text-secondary-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary-600" />
            Ожидают активации ({awaitingActivation.length})
          </h2>
          <div className="space-y-2">
            {awaitingActivation.map((inv) => (
              <PendingActivationCard
                key={inv.id}
                invite={inv}
                onChanged={reload}
                onError={(e) => setError(e)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Anonymous pending links */}
      {pendingLinks.length > 0 && (
        <section>
          <h2 className="font-heading text-base font-semibold text-secondary-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-amber-600" />
            Открытые ссылки ({pendingLinks.length})
          </h2>
          <div className="space-y-2">
            {pendingLinks.map((inv) => (
              <PendingLinkCard
                key={inv.id}
                invite={inv}
                onChanged={reload}
                onError={(e) => setError(e)}
              />
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {acceptedInvites.length > 0 && (
        <section className="opacity-80">
          <h2 className="font-heading text-base font-semibold text-secondary-500 uppercase tracking-wider mb-3">
            Принято ({acceptedInvites.length})
          </h2>
          <div className="space-y-1.5">
            {acceptedInvites.slice(0, 5).map((inv) => (
              <p
                key={inv.id}
                className="text-xs text-secondary-500 px-3 py-1.5 rounded bg-secondary-50/60"
              >
                {inv.full_name || inv.email || '(ссылка без email)'} · {ROLE_LABELS[inv.role]} ·{' '}
                принято{' '}
                {inv.accepted_at && new Date(inv.accepted_at).toLocaleDateString('ru-RU')}
              </p>
            ))}
          </div>
        </section>
      )}

      {expiredOrCancelled.length > 0 && (
        <p className="text-xs text-secondary-400 text-center">
          ({expiredOrCancelled.length} истекли или отменены)
        </p>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) reload();
        }}
        availableRoles={rolesForInviter(role)}
        onError={(e) => setError(e)}
      />
    </div>
  );
}

// =========================================================================
// Pre-registered invite card
// =========================================================================

function PendingActivationCard({
  invite,
  onChanged,
  onError,
}: {
  invite: InviteRow;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/set-password/${invite.token}`
      : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError('Не удалось скопировать ссылку');
    }
  };

  const remove = async () => {
    if (
      !confirm(
        `Удалить ${invite.full_name || invite.email}? Аккаунт сотрудника будет полностью удалён.`
      )
    )
      return;
    setBusy(true);
    try {
      const resp = await fetch('/api/invites/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invite.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? 'Не удалось удалить');
      onChanged();
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
            <Badge variant="success">{ROLE_LABELS[invite.role]}</Badge>
            <span className="text-sm font-medium text-secondary-900">
              {invite.full_name}
            </span>
            <span className="text-sm text-secondary-600">· {invite.email}</span>
          </div>
          <p className="text-xs text-secondary-500 break-all">{url}</p>
          <p className="text-xs text-secondary-500 mt-1">
            Сотрудник перейдёт по ссылке и придумает пароль. Истекает{' '}
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
          <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
            <X className="w-3 h-3" />
            Удалить
          </Button>
        </div>
      </div>
    </Card>
  );
}

// =========================================================================
// Anonymous link card (fallback flow)
// =========================================================================

function PendingLinkCard({
  invite,
  onChanged,
  onError,
}: {
  invite: InviteRow;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/invite/${invite.token}`
      : '';

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
    if (!confirm('Отменить ссылку? После этого она не сработает.')) return;
    setBusy(true);
    try {
      const resp = await fetch('/api/invites/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invite.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? 'Не удалось отменить');
      onChanged();
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
            {invite.email && (
              <span className="text-sm text-secondary-700">{invite.email}</span>
            )}
          </div>
          <p className="text-xs text-secondary-500 break-all">{url}</p>
          <p className="text-xs text-secondary-500 mt-1">
            Анонимная ссылка. Истекает{' '}
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

// =========================================================================
// Invite dialog — two modes
// =========================================================================

type Mode = 'preregister' | 'link';

function InviteDialog({
  open,
  onOpenChange,
  availableRoles,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableRoles: UserRole[];
  onError: (msg: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('preregister');
  const defaultRole: UserRole = availableRoles[0] ?? 'operator';
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog opens/closes.
  useEffect(() => {
    if (open) {
      setRole(availableRoles[0] ?? 'operator');
      setEmail('');
      setFullName('');
      setLocalErr(null);
      setGeneratedUrl(null);
      setMode('preregister');
    }
  }, [open, availableRoles]);

  const submit = async () => {
    setLocalErr(null);
    setBusy(true);
    try {
      const endpoint =
        mode === 'preregister' ? '/api/invites/preregister' : '/api/invites/create';
      const payload =
        mode === 'preregister'
          ? { email: email.trim(), full_name: fullName.trim(), role }
          : { role, email: email.trim() || null };
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? 'Не удалось создать приглашение');
      const fullUrl = `${window.location.origin}${json.path}`;
      setGeneratedUrl(fullUrl);
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
          <DialogTitle>Добавить сотрудника</DialogTitle>
          <DialogDescription>
            Зарегистрируйте сотрудника заранее (он только придумает пароль) или поделитесь
            анонимной ссылкой.
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
              Зарегистрировать
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
              Анонимная ссылка
            </button>
          </div>
        )}

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
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </div>

            {mode === 'preregister' ? (
              <>
                <div>
                  <Label htmlFor="invite_name">ФИО *</Label>
                  <Input
                    id="invite_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Иванов"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="invite_email">Email *</Label>
                  <Input
                    id="invite_email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ivan@company.com"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-secondary-500">
                    Это будет логин сотрудника. Если ошибётесь — сможете удалить и создать
                    заново до активации.
                  </p>
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="invite_email_opt">Email (опционально)</Label>
                <Input
                  id="invite_email_opt"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ivan@company.com"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-secondary-500">
                  Если указать — ссылку сможет принять только этот email. Иначе ссылка
                  принимает любого, кто откроет её первым.
                </p>
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
                  ? 'Аккаунт создан. Перешлите ссылку сотруднику:'
                  : 'Ссылка готова. Перешлите её:'}
              </p>
              <p className="text-xs text-secondary-700 font-mono break-all bg-white border border-secondary-200 rounded p-2">
                {generatedUrl}
              </p>
            </div>
            <p className="text-xs text-secondary-500">
              {mode === 'preregister'
                ? 'Сотрудник откроет ссылку, придумает пароль и сразу войдёт в систему.'
                : 'Ссылка действует 14 дней. Можно отменить в любой момент в списке.'}
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
                {mode === 'preregister' ? 'Создать аккаунт' : 'Создать ссылку'}
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
