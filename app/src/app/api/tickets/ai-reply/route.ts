// app/src/app/api/tickets/ai-reply/route.ts
//
// POST { ticket_id }
// Called every time an operator sends a message in a ticket. AI reads the
// full ticket history and posts a reply — UNLESS the last message is not
// from the operator (e.g. a service engineer just replied — let the human
// drive). Language is detected from the operator's last text, so AI replies
// in the language they wrote in, regardless of profile setting.

import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { anthropic, CLAUDE_MODEL } from '@/lib/ai/anthropic';
import { loadMachineContext } from '@/lib/ai/context-loader';
import { buildTicketReplyPrompt, detectLang } from '@/lib/ai/prompt-builder';
import { retrieve } from '@/lib/ai/retrieval';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface MsgRow {
  id: string;
  sender_type: 'operator' | 'service_engineer' | 'tier2' | 'ai' | 'platform_admin';
  text: string | null;
  image_url: string | null;
  created_at: string;
}

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
    .select('id, company_id, machine_id, title, status')
    .eq('id', ticketId)
    .maybeSingle();
  if (ticketErr || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  if (ticket.status === 'resolved' || ticket.status === 'closed_self') {
    return NextResponse.json({ skipped: 'ticket_closed' });
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  if (!profile || profile.company_id !== ticket.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!ticket.machine_id) {
    return NextResponse.json({ skipped: 'no_machine' });
  }

  const { data: messages } = await sb
    .from('ticket_messages')
    .select('id, sender_type, text, image_url, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  const msgs: MsgRow[] = messages ?? [];
  if (msgs.length === 0) return NextResponse.json({ skipped: 'no_messages' });

  const last = msgs[msgs.length - 1];
  // AI only replies when the operator is the last to speak. If a human
  // engineer (or AI itself) wrote last — stay out of the way.
  if (last.sender_type !== 'operator') {
    return NextResponse.json({ skipped: 'not_operator_turn' });
  }

  const lastText = last.text?.trim() ?? '';
  if (!lastText && !last.image_url) {
    return NextResponse.json({ skipped: 'no_content' });
  }

  // Language follows the operator's actual writing, not their profile.
  const lang = lastText ? detectLang(lastText) : 'en';

  try {
    const ctx = await loadMachineContext(ticket.machine_id);
    if (!ctx) return NextResponse.json({ skipped: 'machine_ctx_missing' });

    // Retrieve manual chunks relevant to the latest question (or fall back
    // to title if it's a photo-only message).
    const retrievalQuery = lastText || ticket.title || ctx.model_code;
    const retrieved = await retrieve(retrievalQuery, ctx.machine_type, 5);
    const systemPrompt = buildTicketReplyPrompt(ctx, lang, retrieved);

    // Build Claude messages from ticket history.
    // operator → user;  everyone else (engineer / ai / tier2 / admin) → assistant.
    // This keeps the alternating roles Claude expects while preserving
    // context of what humans already said.
    const claudeMessages = msgs
      .filter((m) => (m.text && m.text.trim()) || m.image_url)
      .map((m) => {
        const role: 'user' | 'assistant' =
          m.sender_type === 'operator' ? 'user' : 'assistant';
        const textContent = m.text?.trim() ?? '';
        if (m.image_url && /^https?:\/\//.test(m.image_url) && role === 'user') {
          return {
            role,
            content: [
              { type: 'image' as const, source: { type: 'url' as const, url: m.image_url } },
              { type: 'text' as const, text: textContent || (lang === 'ru' ? '(фото от оператора)' : '(operator photo)') },
            ],
          };
        }
        return { role, content: textContent };
      });

    // Edge case: Claude requires the conversation to start with a user turn.
    // If our first message happens to be from a non-operator (rare), drop it.
    while (claudeMessages.length && claudeMessages[0].role !== 'user') {
      claudeMessages.shift();
    }
    if (claudeMessages.length === 0) {
      return NextResponse.json({ skipped: 'no_user_turn' });
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const textBlocks = response.content.filter(
      (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text'
    );
    const replyText = textBlocks.map((b) => b.text).join('\n').trim();
    if (!replyText) return NextResponse.json({ skipped: 'empty_response' });

    const { error: insertErr } = await sb.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_type: 'ai',
      sender_id: null,
      text: replyText,
    });
    if (insertErr) throw insertErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[tickets/ai-reply] failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
