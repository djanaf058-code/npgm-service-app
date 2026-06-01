import { NextRequest, NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

interface SetPasswordBody {
  token: string;
  password: string;
}

// Public endpoint — the invitee is not signed in yet. We trust the token as
// proof of identity, then update the auth password via the admin API and mark
// the invite consumed. The client immediately signs in with the new password
// to land a normal session.
export async function POST(request: NextRequest) {
  let body: SetPasswordBody;
  try {
    body = (await request.json()) as SetPasswordBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const token = body.token?.trim();
  const password = body.password;
  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'password_too_short' },
      { status: 400 }
    );
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  const { data: invite, error: lookupErr } = await adminAny
    .from('invites')
    .select('id, token, user_id, status, expires_at, email')
    .eq('token', token)
    .maybeSingle();
  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: 'invite_not_found' }, { status: 404 });
  }
  if (!invite.user_id) {
    return NextResponse.json(
      { error: 'anonymous_link' },
      { status: 400 }
    );
  }
  if (invite.status === 'consumed') {
    return NextResponse.json({ error: 'account_already_activated' }, { status: 400 });
  }
  if (invite.status === 'cancelled' || new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'invite_cancelled_or_expired' },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: pwErr } = await (admin as any).auth.admin.updateUserById(invite.user_id, {
    password,
  });
  if (pwErr) {
    return NextResponse.json({ error: pwErr.message }, { status: 500 });
  }

  const { error: markErr } = await adminAny
    .from('invites')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: invite.user_id,
      status: 'consumed',
    })
    .eq('id', invite.id);
  if (markErr) {
    // Password was set but we couldn't mark the invite — the user can still
    // log in, just don't fail loudly. Log on the server side.
    console.warn('[invites/set-password] could not mark invite consumed', markErr);
  }

  return NextResponse.json({ ok: true, email: invite.email });
}
