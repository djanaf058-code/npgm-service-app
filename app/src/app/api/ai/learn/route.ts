// app/src/app/api/ai/learn/route.ts
//
// POST (idempotent) — processes up to 10 unprocessed rows in ai_learning_queue.
// Called by cron (Vercel cron or external scheduler).
//
// For each: load ticket + messages → Claude extracts Q/A pairs → embed → upsert.

import { NextRequest, NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { anthropic, CLAUDE_MODEL } from '@/lib/ai/anthropic';
import { embed } from '@/lib/ai/voyage';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function extractQAPairs(
  conversation: string,
  resolution: string,
  lang: 'ru' | 'en'
): Promise<{ q: string; a: string }[]> {
  const prompt =
    lang === 'ru'
      ? `Изучи диалог + финальное решение. Вытащи 1-3 пары (вопрос, ответ) пригодных для FAQ.
Формат ответа: JSON array, без markdown. Пример: [{"q":"...","a":"..."}]

ДИАЛОГ:
${conversation}

ИТОГОВОЕ РЕШЕНИЕ ИНЖЕНЕРА:
${resolution}`
      : `Examine the dialogue + final resolution. Extract 1-3 (question, answer) pairs suitable for FAQ.
Response format: JSON array, no markdown. Example: [{"q":"...","a":"..."}]

DIALOGUE:
${conversation}

ENGINEER'S FINAL RESOLUTION:
${resolution}`;

  const r = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = r.content[0];
  if (block.type !== 'text') return [];
  try {
    return JSON.parse(block.text) as { q: string; a: string }[];
  } catch {
    return [];
  }
}

// Simple heuristic: detect language by presence of Cyrillic
function detectLanguage(s: string): 'ru' | 'en' {
  return /[А-Яа-яЁё]/.test(s) ? 'ru' : 'en';
}

export async function POST(request: NextRequest) {
  // Trusted endpoint — protected by cron header secret. Set CRON_SECRET in env
  // for production; for pilot, missing CRON_SECRET means anyone can call it.
  const cronSecret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: queue, error: qErr } = await sb
    .from('ai_learning_queue')
    .select('id, ticket_id')
    .is('processed_at', null)
    .limit(10);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!queue?.length) return NextResponse.json({ ok: true, processed: 0 });

  let processed = 0;

  for (const item of queue) {
    try {
      const { data: ticket } = await sb
        .from('tickets')
        .select(
          'id, resolution_summary, resolved_by, machine_id, machine:machines(machine_type)'
        )
        .eq('id', item.ticket_id)
        .single();
      if (!ticket?.resolution_summary) {
        await sb
          .from('ai_learning_queue')
          .update({
            processed_at: new Date().toISOString(),
            error: 'no_resolution_summary',
          })
          .eq('id', item.id);
        continue;
      }

      const { data: messages } = await sb
        .from('ticket_messages')
        .select('sender_type, text')
        .eq('ticket_id', ticket.id)
        .order('created_at');

      const dialog = (messages ?? [])
        .map((m: { sender_type: string; text: string }) => `[${m.sender_type}]: ${m.text}`)
        .join('\n\n');

      const lang = detectLanguage(ticket.resolution_summary + ' ' + dialog);
      const pairs = await extractQAPairs(dialog, ticket.resolution_summary, lang);

      if (pairs.length > 0) {
        const machineType = ticket.machine?.machine_type ?? 'unknown';
        const texts = pairs.map((p) => `Q: ${p.q}\nA: ${p.a}`);
        const embeddings = await embed(texts, 'document');
        const rows = pairs.map((p, idx) => ({
          machine_type: machineType,
          language: lang,
          source: `tier2_resolution:${ticket.id}`,
          page: null,
          section: 'FAQ',
          chunk_text: texts[idx],
          embedding: embeddings[idx],
          verified_at: new Date().toISOString(),
          verified_by: ticket.resolved_by,
        }));
        await sb.from('manual_chunks').insert(rows);
      }

      await sb
        .from('ai_learning_queue')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', item.id);
      processed++;
    } catch (e) {
      await sb
        .from('ai_learning_queue')
        .update({
          processed_at: new Date().toISOString(),
          error: e instanceof Error ? e.message : String(e),
        })
        .eq('id', item.id);
    }
  }

  return NextResponse.json({ ok: true, processed });
}
