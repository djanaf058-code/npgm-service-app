import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import type { UserRole } from '@/lib/types';

interface CreateInviteBody {
  role: UserRole;
  email?: string | null; // optional; if set, recipient must register with this email
}

const ALLOWED_INVITE_ROLES: UserRole[] = [
  'operator',
  'service_engineer',
  'project_manager',
  'company_admin',
];

// Cryptographically random URL-safe token, ~22 chars from 16 bytes.
function generateToken(): string {
  return randomBytes(16).toString('base64url');
}

export async function POST(request: NextRequest) {
  // 1. Authenticate caller from cookies.
  const userClient = await createSSRClient();
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // 2. Validate caller role + load company.
  const admin = createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;
  const { data: profile, error: profErr } = await adminAny
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();
  if (profErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!['company_admin', 'platform_admin'].includes(profile.role)) {
    return NextResponse.json(
      { error: 'Только руководитель компании может создавать приглашения' },
      { status: 403 }
    );
  }
  if (!profile.company_id) {
    return NextResponse.json({ error: 'Профиль не привязан к компании' }, { status: 400 });
  }

  // 3. Parse body.
  let body: CreateInviteBody;
  try {
    body = (await request.json()) as CreateInviteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!ALLOWED_INVITE_ROLES.includes(body.role)) {
    return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
  }

  // 4. Insert invite via admin client (bypasses RLS for safety: we already
  //    verified the caller above).
  const token = generateToken();
  const { data: invite, error: insertErr } = await adminAny
    .from('invites')
    .insert({
      token,
      company_id: profile.company_id,
      role: body.role,
      email,
      invited_by: user.id,
    })
    .select('id, token, role, email, expires_at, created_at')
    .single();
  if (insertErr || !invite) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'Не удалось создать приглашение' },
      { status: 500 }
    );
  }

  // The client builds the full absolute URL from window.location.origin —
  // dev/staging/prod each have their own and the server can't reliably tell.
  return NextResponse.json({
    invite,
    path: `/auth/invite/${invite.token}`,
    token: invite.token,
  });
}
