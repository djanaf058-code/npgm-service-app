import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json()) as { machine_id: string };
  if (!body.machine_id) return NextResponse.json({ error: 'machine_id_required' }, { status: 400 });

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  const { data: machine, error: mErr } = await adminAny
    .from('machines').select('id, company_id').eq('id', body.machine_id).maybeSingle();
  if (mErr || !machine) return NextResponse.json({ error: 'machine_not_found' }, { status: 404 });

  // Authorize: the machine must belong to the caller's company. The admin
  // client bypasses RLS, so this check is what prevents cross-tenant access
  // (opening an AI chat scoped to another company's machine + manuals).
  const { data: profile } = await adminAny
    .from('profiles').select('company_id').eq('id', user.id).single();
  if (!profile || profile.company_id !== machine.company_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Find existing active conversation or create new
  const { data: existing } = await adminAny
    .from('ai_conversations')
    .select('id')
    .eq('operator_id', user.id)
    .eq('machine_id', body.machine_id)
    .eq('status', 'active')
    .maybeSingle();
  if (existing) return NextResponse.json({ conversation: existing });

  const { data: created, error } = await adminAny
    .from('ai_conversations')
    .insert({
      operator_id: user.id,
      machine_id: body.machine_id,
      company_id: machine.company_id,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: created });
}
