-- 0024 — link-based invite system.
--
-- Until SMTP is wired up, the customer's company_admin invites teammates by
-- generating a one-time token and sharing the resulting URL out-of-band
-- (WhatsApp, Telegram, internal email). When the recipient signs up, the
-- profile that the auth trigger creates is patched with the invite's role
-- and company_id by accept_invite() — keeping invite acceptance atomic.
--
-- Idempotent. Safe to re-run.

-- =========================================================================
-- A. Table
-- =========================================================================
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  company_id uuid not null references companies(id) on delete cascade,
  role user_role not null,
  email text,                       -- optional. If set, the invitee must register with that email.
  invited_by uuid references profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references profiles(id),
  cancel_reason text,
  created_at timestamptz not null default now()
);

create index if not exists invites_company_idx on invites (company_id);
create index if not exists invites_pending_idx on invites (token) where accepted_at is null;

-- =========================================================================
-- B. RLS — only the inviting company sees its invites; recipient looks them
--          up by token via the RPC, not via direct SELECT.
-- =========================================================================
alter table invites enable row level security;

drop policy if exists invites_company_select on invites;
create policy invites_company_select on invites
  for select to authenticated
  using (company_id = public.user_company_id());

drop policy if exists invites_company_insert on invites;
create policy invites_company_insert on invites
  for insert to authenticated
  with check (
    public.user_role() in ('company_admin', 'platform_admin')
    and company_id = public.user_company_id()
  );

drop policy if exists invites_company_update on invites;
create policy invites_company_update on invites
  for update to authenticated
  using (
    public.user_role() in ('company_admin', 'platform_admin')
    and company_id = public.user_company_id()
  );

-- =========================================================================
-- C. RPC: accept_invite
--   Called right after the invitee finishes signing up.
--   - Looks up the invite by token (bypasses RLS via SECURITY DEFINER).
--   - Verifies it isn't expired or already used.
--   - If invite.email is set, verifies the caller's auth email matches.
--   - Patches the caller's profile with role + company_id from the invite.
--   - Marks the invite accepted.
-- =========================================================================
create or replace function accept_invite(p_token text)
returns invites
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invites;
  caller_id uuid;
  caller_email text;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into inv from invites where token = p_token for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite_already_used' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  -- If the invite was bound to a specific email, enforce it.
  if inv.email is not null then
    select email into caller_email from auth.users where id = caller_id;
    if lower(caller_email) is distinct from lower(inv.email) then
      raise exception 'invite_email_mismatch' using errcode = '42501';
    end if;
  end if;

  -- Patch the profile that on_auth_user_created already created.
  update profiles
     set company_id = inv.company_id,
         role = inv.role
   where id = caller_id;

  -- Mark accepted.
  update invites
     set accepted_at = now(),
         accepted_by = caller_id
   where id = inv.id
   returning * into inv;

  return inv;
end$$;

grant execute on function accept_invite(text) to authenticated;

-- =========================================================================
-- D. RPC: cancel_invite — admin can revoke a pending invite.
-- =========================================================================
create or replace function cancel_invite(p_id uuid, p_reason text default null)
returns invites
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invites;
begin
  if public.user_role() not in ('company_admin', 'platform_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into inv from invites where id = p_id for update;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;
  if inv.company_id is distinct from public.user_company_id()
     and public.user_role() <> 'platform_admin' then
    raise exception 'access_denied_company_mismatch' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite_already_used' using errcode = 'P0001';
  end if;

  update invites
     set expires_at = now() - interval '1 second',
         cancel_reason = p_reason
   where id = p_id
   returning * into inv;

  return inv;
end$$;

grant execute on function cancel_invite(uuid, text) to authenticated;
