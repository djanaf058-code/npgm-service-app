import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import type { UserRole } from '@/lib/types';

interface CreatePreRegisterBody {
  email: string;
  full_name: string;
  role: UserRole;
  // Platform-admin only: target company to put the new user in. For other
  // inviters this is ignored — they can only add to their own company.
  target_company_id?: string;
}

// Who can pre-register whom. The list is the inviter's allow-list; missing
// keys (operator, tier2_engineer, deprecated company_admin) get no rights.
const ROLES_BY_INVITER: Partial<Record<UserRole, UserRole[]>> = {
  service_engineer: ['operator', 'service_engineer'],
  project_manager: ['operator', 'service_engineer', 'project_manager'],
  platform_admin: ['operator', 'service_engineer', 'project_manager'],
};

function generateToken(): string {
  return randomBytes(16).toString('base64url');
}

// Random throwaway password — overwritten the moment the invitee sets one.
// Long enough that nobody bothers guessing.
function generateTempPassword(): string {
  return randomBytes(24).toString('base64url');
}

export async function POST(request: NextRequest) {
  // 1. Authenticate caller.
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
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }
  const allowed = ROLES_BY_INVITER[profile.role as UserRole] ?? [];
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: 'У вас нет прав на регистрацию сотрудников' },
      { status: 403 }
    );
  }

  // 3. Parse + validate body.
  let body: CreatePreRegisterBody;
  try {
    body = (await request.json()) as CreatePreRegisterBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3a. Resolve the target company. Platform admins can hand-pick a tenant
  // via target_company_id (they don't belong to a single customer company);
  // everyone else can only invite into their own.
  let targetCompanyId: string | null = profile.company_id ?? null;
  if (profile.role === 'platform_admin') {
    targetCompanyId = body.target_company_id ?? null;
    if (!targetCompanyId) {
      return NextResponse.json(
        { error: 'target_company_id обязателен для platform_admin' },
        { status: 400 }
      );
    }
    const { data: target, error: targetErr } = await adminAny
      .from('companies')
      .select('id')
      .eq('id', targetCompanyId)
      .maybeSingle();
    if (targetErr || !target) {
      return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 });
    }
  } else if (!targetCompanyId) {
    return NextResponse.json({ error: 'Профиль не привязан к компании' }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
  }
  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: 'Укажите ФИО сотрудника' }, { status: 400 });
  }
  if (!allowed.includes(body.role)) {
    return NextResponse.json({ error: 'Эту роль вы не можете назначить' }, { status: 403 });
  }

  // 4. Create the auth user. email_confirm=true skips the (non-existent) SMTP
  // verification step. The temporary password gets overwritten the moment
  // the invitee opens the activation link.
  const tempPassword = generateTempPassword();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: createErr } = await (admin as any).auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'Не удалось создать пользователя';
    // Surface duplicate-email cleanly — most common failure mode.
    const dup = /already (registered|been registered|exists)/i.test(msg);
    return NextResponse.json(
      { error: dup ? 'Пользователь с таким email уже существует' : msg },
      { status: dup ? 409 : 400 }
    );
  }
  const newUserId = created.user.id;

  // 5. The on_auth_user_created trigger has already inserted a stub profile
  // (role='operator', empty company_id). Patch it with the actual role +
  // company so the user lands in the right tenant.
  const { error: patchErr } = await adminAny
    .from('profiles')
    .update({
      company_id: targetCompanyId,
      role: body.role,
      full_name: fullName,
    })
    .eq('id', newUserId);
  if (patchErr) {
    // Roll back the auth user so the email isn't held hostage by a half-built
    // account on retry.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).auth.admin.deleteUser(newUserId).catch(() => null);
    return NextResponse.json({ error: patchErr.message }, { status: 500 });
  }

  // 6. Issue the activation token.
  const token = generateToken();
  const { data: invite, error: insertErr } = await adminAny
    .from('invites')
    .insert({
      token,
      company_id: targetCompanyId,
      role: body.role,
      email,
      full_name: fullName,
      user_id: newUserId,
      invited_by: user.id,
      status: 'pre_registered',
    })
    .select('id, token, role, email, full_name, expires_at, status, user_id, created_at')
    .single();
  if (insertErr || !invite) {
    // Roll back as above.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).auth.admin.deleteUser(newUserId).catch(() => null);
    return NextResponse.json(
      { error: insertErr?.message ?? 'Не удалось создать приглашение' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    invite,
    path: `/auth/set-password/${invite.token}`,
    token: invite.token,
  });
}
