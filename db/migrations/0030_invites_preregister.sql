-- 0030 — pre-registered invites.
--
-- Until now an invite was a token that anyone could redeem by signing up
-- with their own email. That worked for the early pilot but it lets the
-- operator type their email wrong, register with a personal address, or
-- skip the full_name field. Real onboarding works the other way: the
-- manager types the operator's email + full name, the system creates the
-- auth user and profile up front, and the operator only sets a password
-- on the first click.
--
-- We keep the old anonymous flow as a fallback (manager just generates a
-- role-bound link without an identity, anyone can claim it). The
-- discriminator is invites.user_id — non-null for pre-registered, null
-- for anonymous.
--
-- Idempotent.

alter table invites
  add column if not exists user_id   uuid references auth.users(id) on delete cascade,
  add column if not exists full_name text,
  add column if not exists status    text;

-- Backfill status from the historical accepted_at / expires_at state.
update invites
   set status = case
     when accepted_at is not null then 'consumed'
     when expires_at < now()      then 'cancelled'
     else 'pending'
   end
 where status is null;

-- pending         — anonymous link, awaiting click
-- pre_registered  — auth user already exists, awaiting password
-- consumed        — used (anonymous: profile patched; pre_registered: password set)
-- cancelled       — revoked, or expired without use
alter table invites
  drop constraint if exists invites_status_check;
alter table invites
  add constraint invites_status_check
    check (status in ('pending','pre_registered','consumed','cancelled'));

create index if not exists invites_user_idx on invites (user_id);

-- ========================================================================
-- accept_invite — anonymous flow only.
-- For pre_registered invites, /api/invites/set-password handles the
-- transition (sets the auth password via admin API and marks invite consumed).
-- We add a clear error here in case someone tries to redeem a pre_registered
-- invite via this path.
-- ========================================================================
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
  if inv.user_id is not null then
    raise exception 'invite_is_preregistered' using errcode = 'P0001';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite_already_used' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;

  if inv.email is not null then
    select email into caller_email from auth.users where id = caller_id;
    if lower(caller_email) is distinct from lower(inv.email) then
      raise exception 'invite_email_mismatch' using errcode = '42501';
    end if;
  end if;

  update profiles
     set company_id = inv.company_id,
         role       = inv.role
   where id = caller_id;

  update invites
     set accepted_at = now(),
         accepted_by = caller_id,
         status      = 'consumed'
   where id = inv.id
   returning * into inv;

  return inv;
end$$;

grant execute on function accept_invite(text) to authenticated;

-- ========================================================================
-- cancel_invite — extend role allow-list to include service_engineer
-- (they can revoke invites they issued), and set status='cancelled'.
-- ========================================================================
create or replace function cancel_invite(p_id uuid, p_reason text default null)
returns invites
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invites;
begin
  if public.user_role() not in ('service_engineer','project_manager','platform_admin') then
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
  if inv.accepted_at is not null or inv.status = 'consumed' then
    raise exception 'invite_already_used' using errcode = 'P0001';
  end if;

  update invites
     set expires_at   = now() - interval '1 second',
         cancel_reason = p_reason,
         status        = 'cancelled'
   where id = p_id
   returning * into inv;

  return inv;
end$$;

grant execute on function cancel_invite(uuid, text) to authenticated;
