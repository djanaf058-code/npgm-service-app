'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

const LOCALES = [
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
] as const;

// Persisted via two channels:
//   - NEXT_LOCALE cookie (read by app/src/i18n.ts server-side)
//   - /api/profile/locale call (writes to profiles.language for logged-in users)
// Anonymous visitors only get the cookie; that's fine for the login page.
export function LocaleSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setLocale = (next: string) => {
    if (next === currentLocale) return;
    // 1 year cookie, root path so it persists across all routes
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    // Best-effort persist to DB (no-op for anonymous users)
    fetch('/api/profile/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {});
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="inline-flex items-center gap-0.5 text-xs font-medium bg-secondary-100 rounded-md p-0.5">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          disabled={isPending}
          className={`px-2 py-1 rounded transition-colors ${
            currentLocale === l.code
              ? 'bg-white text-secondary-900 shadow-sm'
              : 'text-secondary-600 hover:text-secondary-900'
          }`}
        >
          <span className="mr-1">{l.flag}</span>
          {l.label}
        </button>
      ))}
    </div>
  );
}
