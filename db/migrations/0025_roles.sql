-- 0025 — collapse company_admin into project_manager.
--
-- The current taxonomy mixes "руководитель компании" (one person who set up
-- the tenant) with "руководитель сервисной службы" (operational lead who
-- approves parts requests). The user-facing model has only three roles
-- inside a customer company — operator, service_engineer, project_manager —
-- and project_manager is the closest fit for what company_admin used to do.
--
-- This migration moves existing rows and rewrites every RLS policy / RPC
-- that referenced 'company_admin'. The enum value itself stays for audit
-- (Postgres doesn't allow dropping enum labels easily); UI/API/RPC paths
-- no longer produce or expect it.
--
-- Idempotent.

-- =========================================================================
-- A. Migrate existing rows.
-- =========================================================================
update profiles
   set role = 'project_manager'
 where role = 'company_admin';

-- =========================================================================
-- B. RLS policies that referenced company_admin.
-- =========================================================================

-- profiles_admin_manage from 0011 used (company_admin, project_manager).
drop policy if exists profiles_admin_manage on profiles;
create policy profiles_admin_manage on profiles
  for all to authenticated
  using (
    public.user_role() in ('project_manager', 'platform_admin')
    and (company_id = public.user_company_id() or public.user_role() = 'platform_admin')
  )
  with check (
    public.user_role() in ('project_manager', 'platform_admin')
    and (company_id = public.user_company_id() or public.user_role() = 'platform_admin')
  );

-- companies_admin_update from 0011: only the owner role can edit company row.
drop policy if exists companies_admin_update on companies;
create policy companies_admin_update on companies
  for update to authenticated
  using (
    (id = public.user_company_id() and public.user_role() = 'project_manager')
    or public.user_role() = 'platform_admin'
  );

-- invites RLS from 0024: company_admin → project_manager.
drop policy if exists invites_company_insert on invites;
create policy invites_company_insert on invites
  for insert to authenticated
  with check (
    public.user_role() in ('project_manager', 'platform_admin')
    and company_id = public.user_company_id()
  );

drop policy if exists invites_company_update on invites;
create policy invites_company_update on invites
  for update to authenticated
  using (
    public.user_role() in ('project_manager', 'platform_admin')
    and company_id = public.user_company_id()
  );

-- =========================================================================
-- C. cancel_invite RPC: rewrite role allow-list.
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
  if public.user_role() not in ('project_manager', 'platform_admin') then
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
