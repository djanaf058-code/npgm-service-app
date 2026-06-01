// Translates an `error` string returned from one of our API routes into the
// user's current locale. The contract is: if the route returns a stable code
// listed in `app/messages/{ru,en}.json` under the `api_errors` namespace, we
// translate it; otherwise we pass through (legacy RU strings + raw Supabase /
// PG messages render as-is, which is acceptable since they're rare and tend
// to be technical anyway).
//
// Usage in a client component:
//   const tErrors = useTranslations('api_errors');
//   ...
//   if (!resp.ok) {
//     setError(translateApiError(tErrors, json.error));
//   }

type TFn = ((key: string) => string) & { has?: (key: string) => boolean };

export function translateApiError(
  t: TFn,
  raw: string | null | undefined,
  fallback?: string,
): string {
  if (!raw) return fallback ?? '';
  // next-intl's `useTranslations` result exposes .has() — if the code is in
  // our namespace we translate; otherwise pass through unchanged.
  if (typeof t.has === 'function' && t.has(raw)) {
    return t(raw);
  }
  return raw;
}
