'use client';

import { createSPASassClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMFAPrompt, setShowMFAPrompt] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const client = await createSPASassClient();
      const { error: signInError } = await client.loginEmail(email, password);

      if (signInError) throw signInError;

      const supabase = client.getSupabaseClient();
      const { data: mfaData, error: mfaError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (mfaError) throw mfaError;

      if (mfaData.nextLevel === 'aal2' && mfaData.nextLevel !== mfaData.currentLevel) {
        setShowMFAPrompt(true);
      } else {
        router.push('/app');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showMFAPrompt) {
      router.push('/auth/2fa');
    }
  }, [showMFAPrompt, router]);

  return (
    <div className="bg-white py-8 px-4 shadow-sm border border-secondary-200 sm:rounded-xl sm:px-10">
      <div className="fixed top-4 right-4 z-10">
        <LocaleSwitcher />
      </div>
      <div className="text-center mb-6">
        <h2 className="font-heading text-2xl font-semibold text-secondary-900">Вход в аккаунт</h2>
        <p className="text-sm text-secondary-500 mt-1">Введите email и пароль</p>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-secondary-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-secondary-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-secondary-700">
              Пароль
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Забыли пароль?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-secondary-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-secondary-600">Нет аккаунта? </span>
        <Link href="/auth/register" className="font-medium text-primary-600 hover:text-primary-700">
          Зарегистрироваться
        </Link>
      </div>
    </div>
  );
}
