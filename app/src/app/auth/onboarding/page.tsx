'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';

const PENDING_INVITE_KEY = 'npgm.pending_invite_token';

const COUNTRIES = [
  { code: 'RU', name_ru: 'Россия' },
  { code: 'KZ', name_ru: 'Казахстан' },
  { code: 'KG', name_ru: 'Кыргызстан' },
  { code: 'BY', name_ru: 'Беларусь' },
  { code: 'SA', name_ru: 'Саудовская Аравия' },
  { code: 'AE', name_ru: 'ОАЭ' },
  { code: 'OM', name_ru: 'Оман' },
  { code: 'QA', name_ru: 'Катар' },
  { code: 'KW', name_ru: 'Кувейт' },
  { code: 'BH', name_ru: 'Бахрейн' },
  { code: 'IQ', name_ru: 'Ирак' },
  { code: 'EG', name_ru: 'Египет' },
  { code: 'JO', name_ru: 'Иордания' },
  { code: 'OTHER', name_ru: 'Другая' },
];

const LANGUAGES = [
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('ru');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // While we redeem a pending invite (came from /auth/invite/[token]) we keep
  // the form mounted but invisible — once accept_invite() succeeds the user
  // already has a company_id, so we just bounce them into the app.
  const [redeemingInvite, setRedeemingInvite] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = window.localStorage.getItem(PENDING_INVITE_KEY);
        if (!token) {
          setRedeemingInvite(false);
          return;
        }
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rpcErr } = await (supabase as any).rpc('accept_invite', { p_token: token });
        // Always clear the token so we don't loop on a bad one.
        window.localStorage.removeItem(PENDING_INVITE_KEY);
        if (cancelled) return;
        if (rpcErr) {
          // Show the form so the user can fall back to creating a company.
          setError(`Не удалось принять приглашение: ${rpcErr.message}`);
          setRedeemingInvite(false);
          return;
        }
        router.replace('/app');
      } catch {
        if (!cancelled) setRedeemingInvite(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/onboarding/create-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          country: country === 'OTHER' ? '' : country,
          full_name: fullName,
          language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось создать компанию');
      }
      router.push(data.redirect ?? '/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (redeemingInvite) {
    return (
      <div className="bg-white py-12 px-4 shadow sm:rounded-lg sm:px-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto mb-3" />
        <p className="text-sm text-secondary-600">Принимаем приглашение…</p>
      </div>
    );
  }

  return (
    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 mb-3">
          <Building2 className="w-6 h-6 text-primary-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Создание компании</h2>
        <p className="text-sm text-slate-500 mt-1">
          Зарегистрируйте свою организацию, чтобы начать работу
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-slate-700">
            Название компании
          </label>
          <input
            id="companyName"
            type="text"
            required
            minLength={2}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Modern Chemical & Service Co."
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
            Ваше имя
          </label>
          <input
            id="fullName"
            type="text"
            required
            minLength={2}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Иван Иванов"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Будете администратором компании. Других сотрудников добавите позже.
          </p>
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-slate-700">
            Страна
          </label>
          <select
            id="country"
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          >
            <option value="">Выберите страну</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name_ru}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="language" className="block text-sm font-medium text-slate-700">
            Язык интерфейса
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || country === 'OTHER'}
          className="flex w-full justify-center items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Создание...' : 'Создать компанию и продолжить'}
        </button>

        {country === 'OTHER' && (
          <p className="text-xs text-amber-700">
            Свяжитесь с нами для регистрации компании в вашей стране — на текущий момент
            мы поддерживаем только список выше.
          </p>
        )}
      </form>
    </div>
  );
}
