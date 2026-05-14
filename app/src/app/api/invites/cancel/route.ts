import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import type { UserRole } from '@/lib/types';

interface CancelBody {
  id: string;
  reason?: string;
}

const ALLOWED_ROLES: UserRole[] = ['service_engineer', 'project_manager', 'platform_admin'];

// Used both for anonymous-link cancellation and for pre-registered cleanup.
// For pre-registered invites we delete the underlying auth user — the FKs are
// on-delete-cascade so the profile and the invite row vanish together.
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
    .select('role, company_id')
    .eq('id', user.id)
    .single();
  if (profErr || !profile) {
    return NextResponse.json({ error: 'Профиль не найден' }, { status: 404 });
  }
  if (!ALLOWED_ROLES.includes(profile.role as UserRole)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: CancelBody;
  try {
    body = (await request.json()) as CancelBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 });
  }

  const { data: invite, error: lookupErr } = await adminAny
    .from('invites')
    .select('id, company_id, user_id, status')
    .eq('id', body.id)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: 'invite_not_found' }, { status: 404 });
  }
  if (invite.company_id !== profile.company_id && profile.role !== 'platform_admin') {
    return NextResponse.json({ error: 'access_denied_company_mismatch' }, { status: 403 });
  }
  if (invite.status === 'consumed') {
    return NextResponse.json({ error: 'Аккаунт уже активирован — удалите его через карточку сотрудника' }, { status: 400 });
  }

  if (invite.user_id) {
    // Pre-registered — wipe the auth user. Cascade FKs handle the rest.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteErr } = await (admin as any).auth.admin.deleteUser(invite.user_id);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, removed: 'preregistered_user' });
  }

  // Anonymous link — just mark cancelled.
  const { error: updateErr } = await adminAny
    .from('invites')
    .update({
      status: 'cancelled',
      expires_at: new Date(Date.now() - 1000).toISOString(),
      cancel_reason: body.reason ?? null,
    })
    .eq('id', body.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, removed: 'anonymous_invite' });
}
