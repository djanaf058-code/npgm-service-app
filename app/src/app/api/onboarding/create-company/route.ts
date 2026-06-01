import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

interface CreateCompanyBody {
  name: string;
  country: string;
  full_name: string;
  language?: string;
  timezone?: string;
}

const SUPPORTED_LANGUAGES = ['ru', 'en'];
const SUPPORTED_COUNTRIES_HINT = ['RU', 'KZ', 'KG', 'BY', 'SA', 'AE', 'OM', 'KW', 'QA', 'BH', 'IQ', 'EG', 'JO', 'LB']; // not strict, just suggestions

export async function POST(request: NextRequest) {
  // 1. Authenticate the user via the SSR client (reads JWT from cookies)
  const userClient = await createSSRClient();
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // 2. Parse + validate input
  let body: CreateCompanyBody;
  try {
    body = (await request.json()) as CreateCompanyBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  const country = body.country?.trim().toUpperCase();
  const fullName = body.full_name?.trim();
  const language = SUPPORTED_LANGUAGES.includes(body.language ?? '') ? body.language! : 'ru';
  const timezone = body.timezone?.trim() || 'UTC';

  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'company_name_too_short' }, { status: 400 });
  }
  if (!country || country.length !== 2) {
    return NextResponse.json(
      { error: 'country_format_invalid' },
      { status: 400 }
    );
  }
  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: 'full_name_too_short' }, { status: 400 });
  }

  // 3. Use admin client to bypass RLS (we're handling onboarding for this user only)
  const admin = await createServerAdminClient();

  // Type assertions: Supabase JS generic inference is brittle when Database is
  // hand-written. Cast `from()` to a permissive type at each call site. Once we
  // regenerate `lib/types.ts` via Supabase CLI, these can be removed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  // 4. Check user doesn't already belong to a company
  const { data: existingProfile, error: profileErr } = await adminAny
    .from('profiles')
    .select('id, company_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    console.error('Failed to fetch profile:', profileErr);
    return NextResponse.json({ error: 'profile_load_failed' }, { status: 500 });
  }
  if (existingProfile?.company_id) {
    return NextResponse.json(
      { error: 'already_in_company' },
      { status: 409 }
    );
  }

  // 5. Insert the company
  const { data: company, error: companyErr } = await adminAny
    .from('companies')
    .insert({
      name,
      country,
      language,
      timezone,
    })
    .select('id')
    .single();

  if (companyErr || !company) {
    console.error('Failed to create company:', companyErr);
    return NextResponse.json(
      { error: 'company_create_failed' },
      { status: 500 }
    );
  }

  // 6. Update the profile (created by the on_auth_user_created trigger) with
  //    company_id, role=company_admin, and the actual full name
  const { error: updateErr } = await adminAny
    .from('profiles')
    .update({
      company_id: company.id,
      role: 'project_manager',
      full_name: fullName,
      language,
    })
    .eq('id', user.id);

  if (updateErr) {
    console.error('Failed to update profile:', updateErr);
    // Best-effort: try to delete the orphan company so we can retry cleanly
    await adminAny.from('companies').delete().eq('id', company.id);
    return NextResponse.json(
      { error: 'profile_link_failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    company_id: company.id,
    redirect: '/app',
  });
}

// Hint to the linter — keeps the constant referenced even if we lint strictly:
void SUPPORTED_COUNTRIES_HINT;
