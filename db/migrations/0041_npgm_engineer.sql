-- 0041 — activate the НПГМ service engineer (tier2_engineer).
--
-- Two kinds of "service engineer" exist:
--   * customer-side service_engineer — full operational parity with the
--     project_manager inside their own tenant (handled purely in the UI /
--     existing tenant RLS; no DB change needed here);
--   * НПГМ-side tier2_engineer — cross-tenant support: sees tickets and the
--     consolidated parts queue across ALL companies, but never prices/КП
--     (price masking is enforced in the UI via PriceField; pricing RPCs already
--     reject non-platform_admin callers).
--
-- This migration gives tier2 the cross-tenant SELECT it needs for the /admin
-- Tickets + Parts views, and lets platform_admin register company-less НПГМ
-- staff via invites.
--
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Company-less invites for НПГМ-internal staff.
--    platform_admin has company_id = NULL by design (0031). tier2 engineers are
--    cross-tenant too, so their invite carries a NULL company_id.
-- ---------------------------------------------------------------------------
alter table invites alter column company_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. tier2 cross-tenant reads.
--    All SELECT-only; tier2 mutates nothing directly. These mirror the joins
--    used by /admin/tickets and /admin/queue/parts (company name, machine,
--    operator name) so the cross-tenant lists render fully for tier2.
-- ---------------------------------------------------------------------------

-- companies: read every tenant's name/country for cross-tenant labels.
drop policy if exists companies_tier2_read on companies;
create policy companies_tier2_read on companies
  for select to authenticated
  using (public.user_role() = 'tier2_engineer');

-- machines: read-only, all tenants (model_code / type for ticket context).
drop policy if exists machines_tier2_read on machines;
create policy machines_tier2_read on machines
  for select to authenticated
  using (public.user_role() = 'tier2_engineer');

-- profiles: read names of operators/members so ticket cards show who reported.
drop policy if exists profiles_tier2_read on profiles;
create policy profiles_tier2_read on profiles
  for select to authenticated
  using (public.user_role() = 'tier2_engineer');

-- parts_requests: re-grant the visibility 0029 stripped. tier2 sees the
-- consolidated queue once it reaches НПГМ (forwarded+). Prices live in
-- quote_* columns but are never rendered to tier2 (PriceField).
drop policy if exists parts_requests_tier2_visible on parts_requests;
create policy parts_requests_tier2_visible on parts_requests
  for select to authenticated
  using (
    public.user_role() = 'tier2_engineer'
    and kind = 'consolidated'
    and status in ('forwarded', 'quoted', 'approved', 'ordered', 'received', 'cancelled')
  );

-- Note: tickets cross-tenant visibility for tier2 already exists from 0012
-- (tickets_tier2_active + ticket_messages_tier2_active, scoped to active
-- statuses new/tier2_responding). No change needed here.
