'use client';

import { useState, useEffect } from 'react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CheckCircle, Key, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = await createSPASassClient();
        const {
          data: { user },
          error,
        } = await supabase.getSupabaseClient().auth.getUser();
        if (error || !user) {
          setError('Ссылка недействительна или истекла. Запросите сброс пароля снова.');
        }
      } catch {
        setError('Не удалось проверить сессию восстановления');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (newPassword.length < 8) {
      setError('Пароль должен быть не короче 8 символов');
      return;
    }

    setLoading(true);

    try {
      const supabase = await createSPASassClient();
      const { error } = await supabase.getSupabaseClient().auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => router.push('/app'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white py-8 px-4 shadow-sm border border-secondary-200 sm:rounded-xl sm:px-10 text-center">
        <CheckCircle className="h-12 w-12 text-primary-600 mx-auto mb-4" />
        <h2 className="font-heading text-2xl font-semibold text-secondary-900 mb-2">
          Пароль обновлён
        </h2>
        <p className="text-secondary-600">
          Сейчас перенаправим в приложение...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white py-8 px-4 shadow-sm border border-secondary-200 sm:rounded-xl sm:px-10">
      <div className="text-center mb-6">
        <Key className="h-10 w-10 text-primary-600 mx-auto mb-3" />
        <h2 className="font-heading text-2xl font-semibold text-secondary-900">
          Новый пароль
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-secondary-700">
            Новый пароль
          </label>
          <input
            id="new-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-secondary-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-secondary-500">Не короче 8 символов</p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-secondary-700">
            Повторите пароль
          </label>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-secondary-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Сохранение...' : 'Сохранить пароль'}
        </button>
      </form>
    </div>
  );
}
