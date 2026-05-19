import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = userClient as any;
  const { data: conv, error: cErr } = await sb
    .from('ai_conversations').select('*').eq('id', id).maybeSingle();
  if (cErr || !conv) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: messages, error: mErr } = await sb
    .from('ai_messages').select('*').eq('conversation_id', id).order('created_at');
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({ conversation: conv, messages });
}
