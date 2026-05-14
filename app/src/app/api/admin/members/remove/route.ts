import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

interface RemoveBody {
  member_id: string;
}

// Hard-delete a teammate from a company. We delete the auth user — the
// profile cascades and the auth row is gone, so the same email can be
// re-invited cleanly later. PMs can remove anyone in their own tenant;
// platform_admin can remove anyone anywhere; service_engineer cannot
// remove team members.
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
  if (!['project_manager', 'platform_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: RemoveBody;
  try {
    body = (await request.json()) as RemoveBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.member_id) {
    return NextResponse.json({ error: 'member_id_required' }, { status: 400 });
  }
  if (body.member_id === user.id) {
    return NextResponse.json(
      { error: 'Нельзя удалить самого себя через эту кнопку' },
      { status: 400 }
    );
  }

  const { data: target, error: targetErr } = await adminAny
    .from('profiles')
    .select('id, company_id, role')
    .eq('id', body.member_id)
    .maybeSingle();
  if (targetErr) {
    return NextResponse.json({ error: targetErr.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });
  }
  if (target.role === 'platform_admin' && profile.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Платформ-админа может удалить только другой платформ-админ' },
      { status: 403 }
    );
  }
  if (
    profile.role !== 'platform_admin' &&
    target.company_id !== profile.company_id
  ) {
    return NextResponse.json({ error: 'access_denied_company_mismatch' }, { status: 403 });
  }

  // Cascade kills profile + any pre_registered invite rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteErr } = await (admin as any).auth.admin.deleteUser(body.member_id);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
