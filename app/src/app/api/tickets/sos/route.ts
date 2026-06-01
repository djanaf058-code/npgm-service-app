// SOS escalation: anyone with access to a ticket can press the red button
// and force-route the ticket to the НПГМ team with priority 1. We:
//   - flip status to 'tier2_responding' and priority to 1 (top of queue);
//   - insert notifications directly for every tier2_engineer + platform_admin
//     profile, so they get the alert immediately in the bell (and via the
//     0042 Telegram fan-out if/when that channel goes live).
//
// We bypass the existing message-trigger fan-out path because that path only
// notifies НПГМ on operator-typed messages — SOS can be pressed by SE/PM too,
// so we route the alerts ourselves.

import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { ticket_id?: string };
  const ticketId = body.ticket_id;
  if (!ticketId) return NextResponse.json({ error: 'Missing ticket_id' }, { status: 400 });

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: ticket, error: ticketErr } = await sb
    .from('tickets')
    .select('id, company_id, title, status, priority')
    .eq('id', ticketId)
    .maybeSingle();
  if (ticketErr || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  if (ticket.status === 'resolved' || ticket.status === 'closed_self') {
    return NextResponse.json({ error: 'Ticket already closed' }, { status: 400 });
  }

  // Caller must belong to the ticket's company OR be НПГМ-side.
  const { data: profile } = await sb
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
  const isNpgm = profile.role === 'platform_admin' || profile.role === 'tier2_engineer';
  if (!isNpgm && profile.company_id !== ticket.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1. Bump ticket to НПГМ team queue at top priority.
  const { error: updErr } = await sb
    .from('tickets')
    .update({ status: 'tier2_responding', priority: 1 })
    .eq('id', ticketId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // 2. Find every НПГМ-side recipient, exclude the actor, and insert a
  //    notification per recipient.
  const { data: recipients } = await sb
    .from('profiles')
    .select('id')
    .in('role', ['tier2_engineer', 'platform_admin']);
  const ids = ((recipients ?? []) as { id: string }[])
    .map((r) => r.id)
    .filter((id) => id !== user.id);
  if (ids.length > 0) {
    const rows = ids.map((rid) => ({
      recipient_id: rid,
      company_id: ticket.company_id,
      type: 'ticket_sos',
      title: ticket.title ?? 'SOS',
      link: `/app/tickets/${ticketId}`,
      entity_id: ticketId,
    }));
    await sb.from('notifications').insert(rows);
  }

  return NextResponse.json({ ok: true, recipients: ids.length });
}
