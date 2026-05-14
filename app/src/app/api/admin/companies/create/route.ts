import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

interface CreateBody {
  name: string;
  country?: string;
  language?: string;
  timezone?: string;
}

// Platform-admin only. Creates an empty tenant — name + country + lang/tz
// defaults so the admin can immediately drill into the new company page
// and pre-register a project manager. We don't auto-create a PM here;
// onboarding is two steps so the admin can choose the role and identity.
export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  const { data: profile, error: profErr } = await adminAny
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profErr || !profile) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }
  if (profile.role !== 'platform_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Введите название компании' }, { status: 400 });
  }
  const country = body.country?.trim() || 'Saudi Arabia';
  const language = body.language?.trim() || 'ru';
  const timezone = body.timezone?.trim() || 'Asia/Riyadh';

  const { data: company, error: createErr } = await adminAny
    .from('companies')
    .insert({ name, country, language, timezone })
    .select('id, name, country, language, timezone, created_at')
    .single();
  if (createErr || !company) {
    return NextResponse.json(
      { error: createErr?.message ?? 'Не удалось создать компанию' },
      { status: 500 }
    );
  }

  return NextResponse.json({ company });
}
