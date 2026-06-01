'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, KeyRound, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import type { UserRole } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { translateApiError } from '@/lib/i18n/apiError';

interface Preview {
  role: UserRole;
  email: string | null;
  full_name: string | null;
  is_preregistered: boolean;
  company_name?: string;
  expires_at: string;
  expired: boolean;
  accepted: boolean;
}

// Activation page for pre-registered invites. The manager already created
// the auth user; we only collect a password, set it via the admin API, then
// sign the user in to land them inside /app.
export default function SetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;
  const t = useTranslations('auth');
  const tErrors = useTranslations('api_errors');
  const tRoles = useTranslations('roles');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/invites/lookup?token=${encodeURIComponent(token)}`);
        const json = await resp.json();
        if (!resp.ok) throw new Error(translateApiError(tErrors, json.error, t('invite_load_failed')));
        if (!cancelled) setPreview(json as Preview);
        // If this is actually an anonymous link, send the user to the right page.
        if (!cancelled && json && !json.is_preregistered) {
          router.replace(`/auth/invite/${token}`);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError(t('password_too_short'));
      return;
    }
    if (password !== confirm) {
      setError(t('passwords_dont_match'));
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch('/api/invites/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(translateApiError(tErrors, json.error, t('set_password_failed')));

      // Sign in with the freshly-set password so we land a real session.
      if (json.email) {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: json.email,
          password,
        });
        if (signErr) throw signErr;
      }
      setDone(true);
      setTimeout(() => router.push('/app'), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('checking_invite')}
      </div>
    );
  }

  if (error && !preview) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="font-heading font-semibold text-secondary-900 mb-2">
          {t('invite_unavailable')}
        </h2>
        <p className="text-sm text-secondary-600 mb-4 whitespace-pre-wrap">{error}</p>
        <Button asChild variant="outline">
          <Link href="/">{t('to_home')}</Link>
        </Button>
      </Card>
    );
  }

  if (!preview) return null;

  // We've already redirected anonymous invites in the effect — render nothing.
  if (!preview.is_preregistered) return null;

  if (preview.accepted) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <h2 className="font-heading font-semibold text-secondary-900 mb-2">
          {t('account_already_activated')}
        </h2>
        <p className="text-sm text-secondary-600 mb-4">
          {t('single_use_link')}
        </p>
        <Button asChild>
          <Link href="/auth/login">{t('login_link')}</Link>
        </Button>
      </Card>
    );
  }

  if (preview.expired) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h2 className="font-heading font-semibold text-secondary-900 mb-2">
          {t('invite_expired')}
        </h2>
        <p className="text-sm text-secondary-600">
          {t('ask_manager_new_invite')}
        </p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <h2 className="font-heading font-semibold text-secondary-900 mb-2">{t('done')}</h2>
        <p className="text-sm text-secondary-600">{t('opening_app')}</p>
      </Card>
    );
  }

  return (
    <Card className="p-8 max-w-md mx-auto">
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="font-heading text-xl font-semibold text-secondary-900">
          {t('activate_account')}
        </h2>
        {preview.company_name && (
          <p className="text-secondary-700 mt-1 flex items-center justify-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-secondary-400" />
            {preview.company_name}
          </p>
        )}
        {preview.full_name && (
          <p className="text-sm text-secondary-900 font-medium mt-1">{preview.full_name}</p>
        )}
        <p className="text-xs text-secondary-500 mt-1">
          {preview.email} · <strong>{tRoles(preview.role)}</strong>
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor="pw">{t('create_password')}</Label>
          <Input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
            autoFocus
            minLength={8}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password.length >= 8 && password === confirm) submit();
            }}
          />
          <p className="text-xs text-secondary-500 mt-1">{t('min_8_chars')}</p>
        </div>
        <div>
          <Label htmlFor="pw2">{t('repeat_password')}</Label>
          <Input
            id="pw2"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1"
            minLength={8}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password.length >= 8 && password === confirm) submit();
            }}
          />
        </div>
        {error && (
          <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2 whitespace-pre-wrap">
            {error}
          </p>
        )}
        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('set_password_button')}
        </Button>
      </div>
    </Card>
  );
}
