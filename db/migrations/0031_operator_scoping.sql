-- 0031 — operator data scoping by machine assignment + legacy cleanup.
--
-- Background: until now every member of a company saw every record in
-- their tenant — machines, shifts, tickets, parts, maintenance. That worked
-- when each pilot company had one operator, but real customers run a
-- shared fleet and operators must NOT see what's happening on their
-- coworkers' machines. The machine_assignments junction table has existed
-- since 0003 but the RLS never used it.
--
-- This migration:
-- 1. Adds public.user_machine_ids() → uuid[] (active assignments of caller).
-- 2. Splits every "company_all" policy into "internal_all" (SE/PM)
--    + "operator_scoped" (operator filtered by machine).
-- 3. Drops dead "tier2_*" policies — that role was retired in B2.
-- 4. Sets platform_admin profiles' company_id = NULL — they're cross-tenant
--    by definition; carrying a leftover tenant id from old onboarding
--    confuses every RLS expression that uses user_company_id().
--
-- Idempotent.

-- =========================================================================
-- A. Helper: machines currently assigned to the caller.
-- =========================================================================
create or replace function public.user_machine_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(machine_id), '{}')
    from machine_assignments
   where operator_id = auth.uid()
     and unassigned_at is null;
$$;

grant execute on function public.user_machine_ids() to authenticated;

-- =========================================================================
-- B. machines — drop catch-all, split by role.
-- =========================================================================
drop policy if exists machines_company_all          on machines;
drop policy if exists machines_operator_assigned_read on machines;
drop policy if exists machines_platform_all         on machines;

create policy machines_internal_all on machines
  for all
  using (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  )
  with check (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  );

-- Operator reads only assigned machines. Write rights live with SE/PM.
create policy machines_operator_scoped on machines
  for select
  using (
    public.user_role() = 'operator'
    and id = any(public.user_machine_ids())
  );

create policy machines_platform_all on machines
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- =========================================================================
-- C. machine_assignments — only SE/PM/admin manage; operator reads self.
-- =========================================================================
drop policy if exists assignments_company_all   on machine_assignments;
drop policy if exists assignments_self_read     on machine_assignments;
drop policy if exists assignments_platform_all  on machine_assignments;

create policy assignments_internal_all on machine_assignments
  for all
  using (
    public.user_role() in ('service_engineer','project_manager')
    and exists (
      select 1 from machines m
       where m.id = machine_assignments.machine_id
         and m.company_id = public.user_company_id()
    )
  )
  with check (
    public.user_role() in ('service_engineer','project_manager')
    and exists (
      select 1 from machines m
       where m.id = machine_assignments.machine_id
         and m.company_id = public.user_company_id()
    )
  );

create policy assignments_self_read on machine_assignments
  for select using (operator_id = auth.uid());

create policy assignments_platform_all on machine_assignments
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- =========================================================================
-- D. shifts — operator sees only assigned-machine shifts.
-- =========================================================================
drop policy if exists shifts_company_all   on shifts;
drop policy if exists shifts_tier2_read    on shifts;
drop policy if exists shifts_platform_all  on shifts;
drop policy if exists shifts_internal_all  on shifts;
drop policy if exists shifts_operator_scoped on shifts;

create policy shifts_internal_all on shifts
  for all
  using (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  )
  with check (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  );

create policy shifts_operator_scoped on shifts
  for all
  using (
    public.user_role() = 'operator'
    and machine_id = any(public.user_machine_ids())
  )
  with check (
    public.user_role() = 'operator'
    and machine_id = any(public.user_machine_ids())
  );

create policy shifts_platform_all on shifts
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- =========================================================================
-- E. checklist_executions — inherit scope from parent shift.
-- =========================================================================
drop policy if exists checklist_executions_company_all  on checklist_executions;
drop policy if exists checklist_executions_tier2_read   on checklist_executions;
drop policy if exists checklist_executions_platform_all on checklist_executions;
drop policy if exists checklist_executions_internal_all on checklist_executions;
drop policy if exists checklist_executions_operator_scoped on checklist_executions;

create policy checklist_executions_internal_all on checklist_executions
  for all
  using (
    public.user_role() in ('service_engineer','project_manager')
    and exists (
      select 1 from shifts s
       where s.id = checklist_executions.shift_id
         and s.company_id = public.user_company_id()
    )
  )
  with check (
    public.user_role() in ('service_engineer','project_manager')
    and exists (
      select 1 from shifts s
       where s.id = checklist_executions.shift_id
         and s.company_id = public.user_company_id()
    )
  );

create policy checklist_executions_operator_scoped on checklist_executions
  for all
  using (
    public.user_role() = 'operator'
    and exists (
      select 1 from shifts s
       where s.id = checklist_executions.shift_id
         and s.machine_id = any(public.user_machine_ids())
    )
  )
  with check (
    public.user_role() = 'operator'
    and exists (
      select 1 from shifts s
       where s.id = checklist_executions.shift_id
         and s.machine_id = any(public.user_machine_ids())
    )
  );

create policy checklist_executions_platform_all on checklist_executions
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- =========================================================================
-- F. tickets — operator sees own tickets OR tickets on their machines.
--    (The OR with operator_id handles tickets with machine_id IS NULL —
--    e.g. "general issue" submissions.)
-- =========================================================================
drop policy if exists tickets_company_all     on tickets;
drop policy if exists tickets_operator_self   on tickets;
drop policy if exists tickets_tier2_active    on tickets;
drop policy if exists tickets_platform_all    on tickets;
drop policy if exists tickets_internal_all    on tickets;
drop policy if exists tickets_operator_scoped on tickets;

create policy tickets_internal_all on tickets
  for all
  using (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  )
  with check (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  );

create policy tickets_operator_scoped on tickets
  for all
  using (
    public.user_role() = 'operator'
    and (
      operator_id = auth.uid()
      or (machine_id is not null and machine_id = any(public.user_machine_ids()))
    )
  )
  with check (
    public.user_role() = 'operator'
    and operator_id = auth.uid()
    and (
      machine_id is null
      or machine_id = any(public.user_machine_ids())
    )
  );

create policy tickets_platform_all on tickets
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- =========================================================================
-- G. maintenance_events — operator READS history of assigned machines only.
--    Writes belong to SE/PM/admin (already enforced by 0014).
-- =========================================================================
drop policy if exists maintenance_events_company_all   on maintenance_events;
drop policy if exists maintenance_events_tier2_read    on maintenance_events;
drop policy if exists maintenance_events_platform_all  on maintenance_events;
drop policy if exists maintenance_events_internal_all  on maintenance_events;
drop policy if exists maintenance_events_operator_read on maintenance_events;

create policy maintenance_events_internal_all on maintenance_events
  for all
  using (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  )
  with check (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  );

create policy maintenance_events_operator_read on maintenance_events
  for select
  using (
    public.user_role() = 'operator'
    and machine_id = any(public.user_machine_ids())
  );

create policy maintenance_events_platform_all on maintenance_events
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- =========================================================================
-- H. parts_requests — operator sees own submissions OR rows on their
--    machines. Consolidations created by SE inherit a machine_id, so
--    they show up too.
-- =========================================================================
drop policy if exists parts_requests_company_all     on parts_requests;
drop policy if exists parts_requests_tier2_read      on parts_requests;
drop policy if exists parts_requests_platform_all    on parts_requests;
drop policy if exists parts_requests_internal_all    on parts_requests;
drop policy if exists parts_requests_operator_scoped on parts_requests;

create policy parts_requests_internal_all on parts_requests
  for all
  using (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  )
  with check (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  );

create policy parts_requests_operator_scoped on parts_requests
  for all
  using (
    public.user_role() = 'operator'
    and (
      requested_by = auth.uid()
      or (machine_id is not null and machine_id = any(public.user_machine_ids()))
    )
  )
  with check (
    public.user_role() = 'operator'
    and requested_by = auth.uid()
  );

create policy parts_requests_platform_all on parts_requests
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- =========================================================================
-- I. Misc cleanup of tier2 policies that survived on adjacent tables.
-- =========================================================================
drop policy if exists parts_inventory_tier2_read on parts_inventory;

-- =========================================================================
-- J. Detach platform_admin profiles from any tenant.
-- The admin lives "above" companies — they pick a tenant explicitly via
-- target_company_id when they invite, and they never read data through
-- user_company_id(). A non-null company_id here was just legacy from old
-- onboarding and confused every RLS read on tables we don't filter by role.
-- =========================================================================
update profiles
   set company_id = null
 where role = 'platform_admin'
   and company_id is not null;
