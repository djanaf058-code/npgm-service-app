import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import type { UserRole } from '@/lib/types';

interface CreateInviteBody {
  role: UserRole;
  email?: string | null; // optional; if set, recipient must register with this email
  // Platform-admin only: target tenant. Ignored for other roles.
  target_company_id?: string;
}

// Who can create what kind of anonymous link. service_engineer and
// project_manager have operational parity, so both hand out the full
// customer-side set. platform_admin additionally registers НПГМ-side
// engineers (tier2_engineer) — see NPGM_INTERNAL_ROLES below.
const ROLES_BY_INVITER: Partial<Record<UserRole, UserRole[]>> = {
  service_engineer: ['operator', 'service_engineer', 'project_manager'],
  project_manager: ['operator', 'service_engineer', 'project_manager'],
  platform_admin: ['operator', 'service_engineer', 'project_manager', 'tier2_engineer'],
};

// НПГМ-internal roles are cross-tenant — they don't belong to a customer
// company. They inherit the inviter's (platform_admin's) own company_id, which
// is NULL by design, so target_company_id is neither required nor accepted.
const NPGM_INTERNAL_ROLES: UserRole[] = ['tier2_engineer'];

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
  const admin = await createServerAdminClient();
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
  const allowed = ROLES_BY_INVITER[profile.role as UserRole] ?? [];
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: 'forbidden_invite' },
      { status: 403 }
    );
  }

  // 3. Parse body.
  let body: CreateInviteBody;
  try {
    body = (await request.json()) as CreateInviteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!allowed.includes(body.role)) {
    return NextResponse.json({ error: 'role_not_allowed' }, { status: 403 });
  }

  // Resolve target company.
  //  - НПГМ-internal role (tier2): cross-tenant, inherits the admin's own
  //    company_id (NULL) — no target needed.
  //  - platform_admin inviting a customer-side role: must pick the tenant.
  //  - everyone else: their own company.
  let targetCompanyId: string | null = profile.company_id ?? null;
  if (NPGM_INTERNAL_ROLES.includes(body.role)) {
    targetCompanyId = profile.company_id ?? null;
  } else if (profile.role === 'platform_admin') {
    targetCompanyId = body.target_company_id ?? null;
    if (!targetCompanyId) {
      return NextResponse.json(
        { error: 'target_company_id_required' },
        { status: 400 }
      );
    }
    const { data: target, error: targetErr } = await adminAny
      .from('companies')
      .select('id')
      .eq('id', targetCompanyId)
      .maybeSingle();
    if (targetErr || !target) {
      return NextResponse.json({ error: 'company_not_found' }, { status: 404 });
    }
  } else if (!targetCompanyId) {
    return NextResponse.json({ error: 'profile_no_company' }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  // 4. Insert invite via admin client (bypasses RLS for safety: we already
  //    verified the caller above).
  const token = generateToken();
  const { data: invite, error: insertErr } = await adminAny
    .from('invites')
    .insert({
      token,
      company_id: targetCompanyId,
      role: body.role,
      email,
      invited_by: user.id,
      status: 'pending',
    })
    .select('id, token, role, email, expires_at, created_at')
    .single();
  if (insertErr || !invite) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'invite_create_failed' },
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
