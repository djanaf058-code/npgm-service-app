'use client';

import { createSPASassClient } from '@/lib/supabase/client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const PENDING_INVITE_KEY = 'npgm.pending_invite_token';

// useSearchParams() requires a Suspense boundary in Next.js 15 — without it
// the static export step bails. Wrap the form in one.
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-secondary-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Загрузка…
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const inviteEmailHint = searchParams.get('email');

  const [email, setEmail] = useState(inviteEmailHint ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const router = useRouter();

  // Persist invite token in localStorage so the GlobalContext picks it up
  // post-verify-email and runs accept_invite() automatically.
  useEffect(() => {
    if (inviteToken) {
      try {
        window.localStorage.setItem(PENDING_INVITE_KEY, inviteToken);
      } catch {
        // ignore — fallback path is link-based, not catastrophic
      }
    }
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!acceptedTerms) {
      setError('Подтвердите согласие с условиями использования и политикой конфиденциальности');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов');
      return;
    }

    setLoading(true);

    try {
      const supabase = await createSPASassClient();
      const { error } = await supabase.registerEmail(email, password);

      if (error) throw error;

      router.push('/auth/verify-email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white py-8 px-4 shadow-sm border border-secondary-200 sm:rounded-xl sm:px-10">
      <div className="text-center mb-6">
        <h2 className="font-heading text-2xl font-semibold text-secondary-900">
          {inviteToken ? 'Регистрация по приглашению' : 'Регистрация компании'}
        </h2>
        <p className="text-sm text-secondary-500 mt-1">
          {inviteToken
            ? 'Создайте аккаунт. После подтверждения email вы автоматически попадёте в команду.'
            : 'Создайте аккаунт администратора. Сотрудников добавите позже.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-secondary-700">
            Рабочий email
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
          <label htmlFor="password" className="block text-sm font-medium text-secondary-700">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-secondary-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-secondary-500">Не короче 8 символов</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700">
            Повторите пароль
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-secondary-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id="terms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="terms" className="text-sm text-secondary-600 leading-snug">
            Я согласен с{' '}
            <Link href="/legal/terms" className="font-medium text-primary-600 hover:text-primary-700" target="_blank">
              условиями использования
            </Link>{' '}
            и{' '}
            <Link href="/legal/privacy" className="font-medium text-primary-600 hover:text-primary-700" target="_blank">
              политикой конфиденциальности
            </Link>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Создание аккаунта...' : 'Создать аккаунт'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-secondary-600">Уже есть аккаунт? </span>
        <Link href="/auth/login" className="font-medium text-primary-600 hover:text-primary-700">
          Войти
        </Link>
      </div>
    </div>
  );
}
