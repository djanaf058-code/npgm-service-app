-- Migration 0017 — Fix RLS infinite recursion between machines & machine_assignments
-- Depends on: 0011_rls
-- Idempotent: yes
--
-- Bug introduced in 0011: the policy `machines_operator_assigned_read`
-- on `machines` selects from `machine_assignments`, whose own policy
-- `assignments_company_all` selects back from `machines`. Postgres
-- detects the infinite recursion and aborts every INSERT/SELECT on
-- machines with:
--   ERROR: infinite recursion detected in policy for relation "machines"
--
-- Fix: drop the operator-specific machines policy. Operators are
-- members of their company, so `machines_company_all` already grants
-- them access to the company's fleet. Tightening to only their assigned
-- machines can be re-introduced later via a SECURITY DEFINER helper
-- (e.g. public.machine_assigned_to_me) that bypasses the assignments
-- RLS and therefore breaks the cycle.

drop policy if exists machines_operator_assigned_read on machines;

-- Sanity: keep the other three policies on machines unchanged
-- (machines_company_all, machines_platform_all). No-op alters below
-- just confirm they exist; CREATE POLICY would error if not present,
-- so we use DROP IF EXISTS + CREATE for idempotence.

drop policy if exists machines_company_all on machines;
create policy machines_company_all on machines
  for all using (company_id = public.user_company_id());

drop policy if exists machines_platform_all on machines;
create policy machines_platform_all on machines
  for all using (public.user_role() = 'platform_admin');
