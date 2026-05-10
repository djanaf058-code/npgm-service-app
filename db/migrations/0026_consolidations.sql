-- 0026 — two-level parts requests: operator (per machine) + consolidated.
--
-- An operator-level request is created by an operator for one machine.
-- A service_engineer collects several operator-level requests into a single
-- consolidated request, dedupes catalog items by part_id (sums quantity),
-- and sends the consolidated to the project_manager. The consolidated then
-- continues through pm_approve_scope → forwarded → quoted → approved →
-- ordered → received.
--
-- Schema-only changes here. New enum values land in 0027 (separate
-- transaction; Postgres rule 55P04). RPC functions land in 0028.
--
-- Idempotent.

alter table parts_requests
  add column if not exists kind text not null default 'operator'
    check (kind in ('operator', 'consolidated')),
  add column if not exists parent_id uuid references parts_requests(id) on delete set null,
  add column if not exists consolidated_at      timestamptz,
  add column if not exists submitted_to_pm_at   timestamptz,
  add column if not exists submitted_to_pm_by   uuid references profiles(id);

create index if not exists parts_requests_parent_idx
  on parts_requests (parent_id) where parent_id is not null;

create index if not exists parts_requests_kind_status_idx
  on parts_requests (kind, status);
