-- 0027 — new statuses for the two-level parts workflow.
--
-- 'consolidated' — operator-level row that has been absorbed into a sweep.
-- 'drafting'     — consolidated row, service_engineer is still building it.
-- 'pending_pm'   — consolidated row, awaiting project_manager scope review.
--
-- MUST run in its own transaction, separately from 0026 (Postgres rule:
-- 55P04 unsafe use of new value of enum type — fresh enum labels can't be
-- referenced in the same tx that adds them, and Supabase SQL Editor wraps
-- each Run in one tx).
--
-- Idempotent.

do $$
begin
  if not exists (select 1 from pg_enum e
                 join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'parts_request_status' and e.enumlabel = 'consolidated') then
    alter type parts_request_status add value 'consolidated';
  end if;
  if not exists (select 1 from pg_enum e
                 join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'parts_request_status' and e.enumlabel = 'drafting') then
    alter type parts_request_status add value 'drafting';
  end if;
  if not exists (select 1 from pg_enum e
                 join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'parts_request_status' and e.enumlabel = 'pending_pm') then
    alter type parts_request_status add value 'pending_pm';
  end if;
end$$;
