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
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
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
    return NextResponse.json({ error: 'company_not_found' }, { status: 404 });
  }
  if (body.confirm_name !== company.name) {
    return NextResponse.json(
      {
        error: `Введите название компании точно как «${company.name}» для подтверждения`,
      },
      { status: 400 }
    );
  }

  // Phase 0: clear tenant-scoped tables that have RESTRICT (or NO ACTION) FK
  // to profiles. Without this we hit a circular block: companies can't be
  // deleted while their profiles exist (profiles.company_id RESTRICT), and
  // profiles can't be deleted while tickets / shifts / ai_conversations /
  // maintenance_events / parts_requests / invites point at them. All these
  // tables ARE company-scoped with ON DELETE CASCADE off the company — we
  // just fire that cascade ahead of time, by company_id, so the user delete
  // in Phase 1 stops hitting FK violations bubbling up as Supabase Auth's
  // "Database error deleting user".
  //
  // ai_conversations cascades ai_messages; tickets cascade ticket_messages;
  // shifts cascade checklist_executions — no need to delete those children
  // explicitly. machine_assignments / tickets.resolved_by /
  // manual_chunks.verified_by all CASCADE / SET NULL off profiles so they
  // resolve themselves when the user actually gets deleted.
  const cascadeFirst = [
    'ai_conversations',
    'tickets',
    'shifts',
    'maintenance_events',
    'parts_requests',
    'invites',
  ] as const;
  for (const tbl of cascadeFirst) {
    const { error: clearErr } = await adminAny
      .from(tbl)
      .delete()
      .eq('company_id', body.company_id);
    if (clearErr) {
      return NextResponse.json(
        { error: `Не удалось очистить ${tbl}: ${clearErr.message}` },
        { status: 500 }
      );
    }
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

  // Phase 2: the company itself. machines, parts catalog rows, etc. cascade
  // off companies.id (the rest was wiped in Phase 0).
  const { error: deleteErr } = await adminAny
    .from('companies')
    .delete()
    .eq('id', body.company_id);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted_members: memberIds.length });
}
