'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, UserPlus, Building2, AlertTriangle, CheckCircle2, LogIn } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { UserRole } from '@/lib/types';

interface InvitePreview {
  role: UserRole;
  email: string | null;
  company_name?: string;
  expires_at: string;
  expired: boolean;
  accepted: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  operator: 'Оператора',
  service_engineer: 'Сервисного инженера',
  project_manager: 'Проектного менеджера',
  company_admin: 'Руководителя сервисной службы',
  tier2_engineer: 'НПГМ Tier 2',
  platform_admin: 'Платформа',
};

const PENDING_INVITE_KEY = 'npgm.pending_invite_token';

export default function InviteLandingPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [accepting, setAccepting] = useState(false);

  // Step 1: load invite preview + auth status in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [previewResp, client] = await Promise.all([
          fetch(`/api/invites/lookup?token=${encodeURIComponent(token)}`),
          createSPASassClient(),
        ]);
        const previewJson = await previewResp.json();
        if (!previewResp.ok) throw new Error(previewJson.error ?? 'Не удалось загрузить приглашение');
        const supabase = client.getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setPreview(previewJson as InvitePreview);
        setSignedIn(!!user);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setAuthChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // For an already-signed-in user with no company yet (rare flow), accept right away.
  const acceptNow = async () => {
    setAccepting(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: rpcErr } = await (supabase as any).rpc('accept_invite', { p_token: token });
      if (rpcErr) throw rpcErr;
      router.push('/app');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAccepting(false);
    }
  };

  // For an unauthenticated visitor: stash the token and send them to register.
  const registerWithInvite = () => {
    try {
      window.localStorage.setItem(PENDING_INVITE_KEY, token);
    } catch {
      // localStorage might be blocked; the URL fallback also carries the token.
    }
    const emailQs = preview?.email ? `&email=${encodeURIComponent(preview.email)}` : '';
    router.push(`/auth/register?invite=${encodeURIComponent(token)}${emailQs}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Проверяем приглашение…
      </div>
    );
  }

  if (error || !preview) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="font-heading font-semibold text-secondary-900 mb-2">
          Приглашение недоступно
        </h2>
        <p className="text-sm text-secondary-600 mb-4 whitespace-pre-wrap">
          {error ?? 'Не нашли это приглашение.'}
        </p>
        <Button asChild variant="outline">
          <Link href="/">На главную</Link>
        </Button>
      </Card>
    );
  }

  if (preview.accepted) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <h2 className="font-heading font-semibold text-secondary-900 mb-2">
          Приглашение уже принято
        </h2>
        <p className="text-sm text-secondary-600 mb-4">
          Эта ссылка одноразовая — она уже использована. Если это были вы — войдите как обычно.
        </p>
        <Button asChild>
          <Link href="/auth/login">Войти</Link>
        </Button>
      </Card>
    );
  }

  if (preview.expired) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="font-heading font-semibold text-secondary-900 mb-2">
          Срок приглашения истёк
        </h2>
        <p className="text-sm text-secondary-600 mb-4">
          Попросите руководителя выпустить новое приглашение.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-8 max-w-md mx-auto">
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 mb-3">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="font-heading text-xl font-semibold text-secondary-900">
          Приглашение в команду
        </h2>
        {preview.company_name && (
          <p className="text-secondary-700 mt-1">{preview.company_name}</p>
        )}
        <p className="text-sm text-secondary-500 mt-1">
          Роль: <strong>{ROLE_LABELS[preview.role]}</strong>
        </p>
        {preview.email && (
          <p className="text-xs text-secondary-500 mt-1">
            Только для <strong>{preview.email}</strong>
          </p>
        )}
      </div>

      {authChecked && signedIn ? (
        <div className="space-y-3">
          <p className="text-sm text-secondary-700">
            Вы уже вошли в систему. Если у вас есть отдельный аккаунт — выйдите и зарегистрируйтесь
            по этой ссылке как новый сотрудник.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={acceptNow} disabled={accepting}>
              {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
              Принять под текущим аккаунтом
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/auth/login?invite=${encodeURIComponent(token)}`}>
                <LogIn className="w-4 h-4" />
                Войти под другим аккаунтом
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-secondary-700">
            Зарегистрируйтесь, чтобы присоединиться. Ваш профиль автоматически попадёт в
            компанию с указанной ролью.
          </p>
          <Button onClick={registerWithInvite} className="w-full">
            <UserPlus className="w-4 h-4" />
            Зарегистрироваться по приглашению
          </Button>
          <p className="text-xs text-secondary-500 text-center">
            Уже есть аккаунт?{' '}
            <Link
              href={`/auth/login?invite=${encodeURIComponent(token)}`}
              className="text-primary-600 hover:underline"
            >
              Войти
            </Link>
          </p>
        </div>
      )}
    </Card>
  );
}
