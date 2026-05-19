import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json()) as {
    conversation_id: string;
    content: string;
    image_url?: string;
  };
  if (!body.conversation_id || !body.content?.trim()) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  // Verify caller is the conversation's operator
  const { data: conv } = await adminAny
    .from('ai_conversations').select('id, operator_id, status')
    .eq('id', body.conversation_id).maybeSingle();
  if (!conv || conv.operator_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (conv.status !== 'active') {
    return NextResponse.json({ error: 'conversation_closed' }, { status: 400 });
  }

  const { data, error } = await adminAny
    .from('ai_messages')
    .insert({
      conversation_id: body.conversation_id,
      role: 'user',
      content: body.content.trim(),
      image_url: body.image_url ?? null,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
