import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

const VALID = new Set(['ru', 'en']);

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  // For anonymous users we just no-op — the cookie is enough for the login page.
  if (!user) return NextResponse.json({ ok: true, persisted: false });

  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const locale = body.locale ?? '';
  if (!VALID.has(locale)) {
    return NextResponse.json({ error: 'unsupported_locale' }, { status: 400 });
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('profiles')
    .update({ language: locale })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
