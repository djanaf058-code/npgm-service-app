'use client';

import { CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { createSPASassClient } from '@/lib/supabase/client';

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const resendVerificationEmail = async () => {
    if (!email) {
      setError('Введите email');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const supabase = await createSPASassClient();
      const { error } = await supabase.resendVerificationEmail(email);
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white py-8 px-4 shadow-sm border border-secondary-200 sm:rounded-xl sm:px-10 text-center">
      <CheckCircle className="h-12 w-12 text-primary-600 mx-auto mb-4" />

      <h2 className="font-heading text-2xl font-semibold text-secondary-900 mb-2">
        Проверьте почту
      </h2>

      <p className="text-secondary-600 mb-6 leading-relaxed">
        Мы отправили письмо со ссылкой для подтверждения аккаунта.
        Откройте его и нажмите на ссылку.
      </p>

      <div className="space-y-3">
        <p className="text-xs text-secondary-500">
          Письмо не пришло? Проверьте «Спам» или отправьте повторно:
        </p>

        {error && (
          <div className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-3">
            {error}
          </div>
        )}

        {success && (
          <div className="text-sm text-primary-700 bg-primary-50 border border-primary-200 rounded-md p-3">
            Письмо отправлено повторно.
          </div>
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@company.com"
          className="block w-full rounded-md border border-secondary-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm"
        />

        <button
          className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={resendVerificationEmail}
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Отправка...' : 'Отправить ещё раз'}
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-secondary-200">
        <Link
          href="/auth/login"
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Вернуться ко входу
        </Link>
      </div>
    </div>
  );
}
