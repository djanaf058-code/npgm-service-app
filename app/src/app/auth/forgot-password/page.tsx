'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createSPASassClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { CheckCircle, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth_forgot');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = await createSPASassClient();
      const { error } = await supabase.getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unknown_error'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white py-8 px-4 shadow-sm border border-secondary-200 sm:rounded-xl sm:px-10 text-center">
        <CheckCircle className="h-12 w-12 text-primary-600 mx-auto mb-4" />
        <h2 className="font-heading text-2xl font-semibold text-secondary-900 mb-2">
          {t('sent_title')}
        </h2>
        <p className="text-secondary-600 mb-6 leading-relaxed">
          {t('sent_desc')}
        </p>
        <Link
          href="/auth/login"
          className="inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {t('back_to_login')}
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white py-8 px-4 shadow-sm border border-secondary-200 sm:rounded-xl sm:px-10">
      <div className="text-center mb-6">
        <h2 className="font-heading text-2xl font-semibold text-secondary-900">
          {t('title')}
        </h2>
        <p className="text-sm text-secondary-500 mt-1">{t('subtitle')}</p>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-secondary-700">
            {t('email_label')}
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

        <button
          type="submit"
          disabled={loading}
          className="flex w-full justify-center items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? t('sending') : t('send_link')}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-secondary-600">{t('remembered')} </span>
        <Link href="/auth/login" className="font-medium text-primary-600 hover:text-primary-700">
          {t('login')}
        </Link>
      </div>
    </div>
  );
}
