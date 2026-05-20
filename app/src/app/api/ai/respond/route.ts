// app/src/app/api/ai/respond/route.ts
//
// POST { conversation_id }
// - Embed last user message
// - Retrieve top-5 chunks from manual_chunks for the machine
// - Build system prompt + Claude streaming call
// - Stream SSE events back to the browser
// - On stream end: save assistant message + retrieved chunk IDs + confidence

import { NextRequest } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { anthropic, CLAUDE_MODEL } from '@/lib/ai/anthropic';
import { loadMachineContext } from '@/lib/ai/context-loader';
import { buildSystemPrompt, parseConfidence } from '@/lib/ai/prompt-builder';
import { retrieve } from '@/lib/ai/retrieval';

export const runtime = 'nodejs';        // pgvector needs node runtime
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { conversation_id } = (await request.json()) as { conversation_id: string };
  if (!conversation_id) return new Response('Missing conversation_id', { status: 400 });

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: conv } = await sb
    .from('ai_conversations').select('*').eq('id', conversation_id).maybeSingle();
  if (!conv || conv.operator_id !== user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const { data: profile } = await sb
    .from('profiles').select('language').eq('id', user.id).single();
  const lang: 'ru' | 'en' = profile?.language === 'en' ? 'en' : 'ru';

  // Get all messages so far (history)
  const { data: messages } = await sb
    .from('ai_messages')
    .select('role, content, image_url')
    .eq('conversation_id', conversation_id)
    .order('created_at');
  if (!messages?.length) return new Response('No messages', { status: 400 });

  const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
  if (!lastUser) return new Response('No user message', { status: 400 });

  const ctx = await loadMachineContext(conv.machine_id);
  if (!ctx) return new Response('Machine not found', { status: 404 });

  const retrieved = await retrieve(lastUser.content, ctx.machine_type, 5);
  const systemPrompt = buildSystemPrompt(ctx, lang, retrieved);

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = '';
      try {
        const claudeStream = anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          })),
        });

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullText += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
          }
        }

        // Persist assistant message
        const confidence = parseConfidence(fullText);
        await sb.from('ai_messages').insert({
          conversation_id,
          role: 'assistant',
          content: fullText,
          retrieved_chunk_ids: retrieved.map((r) => r.id),
          ai_confidence: confidence,
        });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, confidence })}\n\n`)
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
