import { NextRequest, NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import type { UserRole } from '@/lib/types';

// Public endpoint — anyone with a token can preview the invite (company name +
// role + email constraint + expiry). No auth required so unregistered
// recipients can land on /auth/invite/<token> before signing up.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;
  const { data, error } = await adminAny
    .from('invites')
    .select(
      'id, role, email, full_name, user_id, status, expires_at, accepted_at, company:companies(name)'
    )
    .eq('token', token)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'invite_not_found' }, { status: 404 });
  }

  const expired = new Date(data.expires_at).getTime() < Date.now();
  const accepted = !!data.accepted_at || data.status === 'consumed';
  const isPreregistered = !!data.user_id;

  return NextResponse.json({
    role: data.role as UserRole,
    email: data.email as string | null,
    full_name: data.full_name as string | null,
    is_preregistered: isPreregistered,
    company_name: data.company?.name as string | undefined,
    expires_at: data.expires_at,
    expired,
    accepted,
  });
}
