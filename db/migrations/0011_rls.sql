-- Migration 0011 — Row-Level Security policies (multi-tenant isolation)
-- Depends on: 0001_init, 0002_users, 0003_machines
-- Idempotent: yes (drops policies before creating)
--
-- This migration is the security backbone of the multi-tenant platform.
-- After applying it, a user from Company A cannot read or modify any row
-- belonging to Company B — enforced at the database level, regardless of
-- application-code bugs.
--
-- Helpers used (defined in 0002_users.sql):
--   public.user_company_id()   → uuid of the caller's company (null for tier2/platform)
--   public.user_role()         → 'operator' | 'service_engineer' | 'project_manager'
--                              | 'company_admin' | 'tier2_engineer' | 'platform_admin'
--
-- Service-role connections (from our backend / FastAPI / SQL editor) bypass RLS
-- entirely, which is the intended escape hatch for admin operations.

-- ============================================================
-- 1. companies
-- ============================================================
alter table companies enable row level security;

drop policy if exists companies_member_read on companies;
drop policy if exists companies_admin_update on companies;
drop policy if exists companies_platform_all on companies;

-- Any member of a company can read the company row
create policy companies_member_read on companies
  for select using (id = public.user_company_id());

-- Only the company admin can update the company
create policy companies_admin_update on companies
  for update using (
    id = public.user_company_id()
    and public.user_role() = 'company_admin'
  );

-- Platform admins do everything
create policy companies_platform_all on companies
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- 2. profiles
-- ============================================================
alter table profiles enable row level security;

drop policy if exists profiles_self_read on profiles;
drop policy if exists profiles_company_read on profiles;
drop policy if exists profiles_self_update on profiles;
drop policy if exists profiles_admin_manage on profiles;
drop policy if exists profiles_platform_all on profiles;

-- Read your own profile (works even before onboarding)
create policy profiles_self_read on profiles
  for select using (id = auth.uid());

-- Read profiles of your own company
create policy profiles_company_read on profiles
  for select using (
    company_id is not null
    and company_id = public.user_company_id()
  );

-- Update your own profile (name, language, phone)
create policy profiles_self_update on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Company admins / project managers can manage profiles in their company
-- (assign roles, invite users, etc.)
create policy profiles_admin_manage on profiles
  for update using (
    company_id is not null
    and company_id = public.user_company_id()
    and public.user_role() in ('company_admin', 'project_manager')
  );

-- Platform admins do everything
create policy profiles_platform_all on profiles
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- 3. machine_types  (reference data, mostly read-only)
-- ============================================================
alter table machine_types enable row level security;

drop policy if exists machine_types_authed_read on machine_types;
drop policy if exists machine_types_platform_write on machine_types;

-- Any authenticated user can read the catalogue
create policy machine_types_authed_read on machine_types
  for select using (auth.role() = 'authenticated');

-- Only platform admins can change reference data
create policy machine_types_platform_write on machine_types
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- 4. machines
-- ============================================================
alter table machines enable row level security;

drop policy if exists machines_company_all on machines;
drop policy if exists machines_operator_assigned_read on machines;
drop policy if exists machines_platform_all on machines;

-- Service engineers, project managers, company admins, operators of the
-- company can fully manage machines they own
create policy machines_company_all on machines
  for all using (company_id = public.user_company_id());

-- Operators only see machines they're explicitly assigned to (more
-- restrictive than the previous policy; PostgREST OR-combines them, so
-- this is additive — operators still get reads if any policy allows).
-- Kept separate so we can later tighten machines_company_all to exclude
-- raw operators if needed.
create policy machines_operator_assigned_read on machines
  for select using (
    public.user_role() = 'operator'
    and exists (
      select 1 from machine_assignments ma
      where ma.machine_id = machines.id
        and ma.operator_id = auth.uid()
        and ma.unassigned_at is null
    )
  );

create policy machines_platform_all on machines
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- 5. machine_assignments
-- ============================================================
alter table machine_assignments enable row level security;

drop policy if exists assignments_company_all on machine_assignments;
drop policy if exists assignments_self_read on machine_assignments;
drop policy if exists assignments_platform_all on machine_assignments;

-- Any member of the owning company can manage assignments
create policy assignments_company_all on machine_assignments
  for all using (
    exists (
      select 1 from machines m
      where m.id = machine_assignments.machine_id
        and m.company_id = public.user_company_id()
    )
  );

-- An operator can always see their own assignments (even if the
-- previous policy somehow excluded them)
create policy assignments_self_read on machine_assignments
  for select using (operator_id = auth.uid());

create policy assignments_platform_all on machine_assignments
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- Diagnostic view (optional) — list which tables have RLS enabled
-- ============================================================
-- After applying, run:
--   select schemaname, tablename, rowsecurity from pg_tables
--   where schemaname = 'public' order by tablename;
-- All our tables should show rowsecurity = true.
