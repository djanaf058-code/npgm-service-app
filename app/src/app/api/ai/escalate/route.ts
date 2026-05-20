// app/src/app/api/ai/escalate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { anthropic, CLAUDE_MODEL } from '@/lib/ai/anthropic';

export const runtime = 'nodejs';

async function generateTitle(
  messages: { role: string; content: string }[],
  lang: 'ru' | 'en'
) {
  const dialog = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const r = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 60,
    system:
      lang === 'ru'
        ? 'Ты помощник для НПГМ-сервиса. Сгенерируй короткий заголовок тикета (5-7 слов) на русском. Без кавычек, без точки в конце.'
        : 'You are an NPGM service assistant. Generate a short ticket title (5-7 words) in English. No quotes, no trailing period.',
    messages: [
      { role: 'user', content: `${dialog}\n\nGenerate ticket title only:` },
    ],
  });
  const block = r.content[0];
  return block.type === 'text' ? block.text.trim() : 'AI escalated issue';
}

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { conversation_id } = (await request.json()) as {
    conversation_id: string;
  };
  if (!conversation_id) {
    return NextResponse.json(
      { error: 'conversation_id_required' },
      { status: 400 }
    );
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: conv } = await sb
    .from('ai_conversations')
    .select('*')
    .eq('id', conversation_id)
    .maybeSingle();
  if (!conv || conv.operator_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (conv.status !== 'active') {
    return NextResponse.json({ error: 'already_handled' }, { status: 400 });
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('language')
    .eq('id', user.id)
    .single();
  const lang: 'ru' | 'en' = profile?.language === 'en' ? 'en' : 'ru';

  const { data: messages } = await sb
    .from('ai_messages')
    .select('role, content, image_url')
    .eq('conversation_id', conversation_id)
    .order('created_at');
  if (!messages?.length) {
    return NextResponse.json({ error: 'empty' }, { status: 400 });
  }

  const title = await generateTitle(messages, lang);

  // 1. Insert ticket
  const { data: ticket, error: tErr } = await sb
    .from('tickets')
    .insert({
      company_id: conv.company_id,
      operator_id: conv.operator_id,
      machine_id: conv.machine_id,
      title,
      status: 'new',
      priority: 3,
      originated_from: 'ai_escalation',
    })
    .select('id')
    .single();
  if (tErr || !ticket) {
    return NextResponse.json(
      { error: tErr?.message ?? 'ticket_insert_failed' },
      { status: 500 }
    );
  }

  // 2. Copy messages to ticket_messages
  const ticketMessages = messages.map(
    (m: { role: string; content: string; image_url: string | null }) => ({
      ticket_id: ticket.id,
      sender_type: m.role === 'user' ? 'operator' : 'ai',
      sender_id: m.role === 'user' ? conv.operator_id : null,
      text: m.content,
      image_url: m.image_url,
    })
  );
  const { error: msgErr } = await sb
    .from('ticket_messages')
    .insert(ticketMessages);
  if (msgErr) {
    // Don't abort — ticket still exists, just messages didn't copy fully
    console.warn('[ai/escalate] copying messages failed', msgErr);
  }

  // 3. Update conversation
  await sb
    .from('ai_conversations')
    .update({
      status: 'escalated',
      ticket_id: ticket.id,
      escalated_at: new Date().toISOString(),
    })
    .eq('id', conversation_id);

  // 4. Notify — Realtime broadcast happens automatically via tickets.INSERT subscription
  //    (set up in Task D.3). Email via SMTP is a separate task.

  return NextResponse.json({ ticket_id: ticket.id });
}
