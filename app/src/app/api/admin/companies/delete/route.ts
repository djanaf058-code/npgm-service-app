import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

interface DeleteBody {
  company_id: string;
  confirm_name: string;
}

// Platform-admin only. Wipes a tenant: all auth users in the company (the
// auth cascade kills their profiles), then the company row (machines,
// tickets, etc. cascade off companies.id on delete). Profiles have
// on-delete-restrict on company_id, which is why we kill the users first.
//
// We force the caller to retype the company name as a poke-yoke against
// accidental deletes — once this runs, there is no undo.
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

  let body: DeleteBody;
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.company_id) {
    return NextResponse.json({ error: 'company_id_required' }, { status: 400 });
  }

  const { data: company, error: companyErr } = await adminAny
    .from('companies')
    .select('id, name')
    .eq('id', body.company_id)
    .maybeSingle();
  if (companyErr) {
    return NextResponse.json({ error: companyErr.message }, { status: 500 });
  }
  if (!company) {
    return NextResponse.json({ error: 'Компания не найдена' }, { status: 404 });
  }
  if (body.confirm_name !== company.name) {
    return NextResponse.json(
      {
        error: `Введите название компании точно как «${company.name}» для подтверждения`,
      },
      { status: 400 }
    );
  }

  // Phase 1: delete every auth user in this tenant (cascades their profile).
  const { data: members, error: membersErr } = await adminAny
    .from('profiles')
    .select('id')
    .eq('company_id', body.company_id);
  if (membersErr) {
    return NextResponse.json({ error: membersErr.message }, { status: 500 });
  }
  const memberIds: string[] = (members ?? []).map((m: { id: string }) => m.id);
  for (const id of memberIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (admin as any).auth.admin.deleteUser(id);
    if (delErr) {
      return NextResponse.json(
        { error: `Не удалось удалить пользователя ${id}: ${delErr.message}` },
        { status: 500 }
      );
    }
  }

  // Phase 2: the company itself. machines, tickets, parts_requests, etc.
  // cascade off companies.id.
  const { error: deleteErr } = await adminAny
    .from('companies')
    .delete()
    .eq('id', body.company_id);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted_members: memberIds.length });
}
