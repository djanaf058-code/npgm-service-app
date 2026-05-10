-- 0029 — finalise RLS for the new workflow.
--
-- Tier 2 НПГМ engineers handle tickets only — they no longer need any
-- visibility on parts_requests. Platform_admin gets cross-tenant SELECT
-- on consolidated requests that have been forwarded to them.
--
-- Idempotent.

-- Drop tier2 visibility on parts_requests entirely.
drop policy if exists parts_requests_tier2_visible on parts_requests;
drop policy if exists parts_requests_tier2_read on parts_requests;

-- Platform_admin sees forwarded+ consolidated requests across all tenants.
drop policy if exists parts_requests_platform_visible on parts_requests;
create policy parts_requests_platform_visible on parts_requests
  for select to authenticated
  using (
    public.user_role() = 'platform_admin'
    and kind = 'consolidated'
    and status in ('forwarded', 'quoted', 'approved', 'ordered', 'received', 'cancelled')
  );

-- Note: parts_requests_company_all from 0018 still grants in-company members
-- (operator + service_engineer + project_manager) full access to their own
-- company's rows, both kind='operator' and kind='consolidated'. The UI is
-- responsible for showing each role only what's relevant.
