-- 0023a — enum extensions + columns for the new parts request workflow.
--
-- IMPORTANT: run this file FIRST (commit it), then run 0023b in a *separate*
-- query/transaction. Postgres rejects using a freshly-added enum value
-- inside the same transaction that added it (55P04: unsafe use of new value),
-- and Supabase SQL Editor wraps each Run in a single transaction.
--
-- Idempotent. Safe to re-run.

-- 1) Extend the parts_request_status enum.
do $$
begin
  if not exists (select 1 from pg_enum e
                 join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'parts_request_status' and e.enumlabel = 'submitted') then
    alter type parts_request_status add value 'submitted';
  end if;
  if not exists (select 1 from pg_enum e
                 join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'parts_request_status' and e.enumlabel = 'forwarded') then
    alter type parts_request_status add value 'forwarded';
  end if;
  if not exists (select 1 from pg_enum e
                 join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'parts_request_status' and e.enumlabel = 'quoted') then
    alter type parts_request_status add value 'quoted';
  end if;
  if not exists (select 1 from pg_enum e
                 join pg_type t on e.enumtypid = t.oid
                 where t.typname = 'parts_request_status' and e.enumlabel = 'received') then
    alter type parts_request_status add value 'received';
  end if;
end$$;

-- 2) Per-step audit columns. Setting them is null-safe; the RPCs in 0023b
--    fill the right one when status changes.
alter table parts_requests
  add column if not exists submitted_at           timestamptz,
  add column if not exists forwarded_at           timestamptz,
  add column if not exists forwarded_by           uuid references profiles(id),
  add column if not exists quoted_at              timestamptz,
  add column if not exists quoted_by              uuid references profiles(id),
  add column if not exists quote_notes            text,
  add column if not exists quote_total_amount     numeric(12,2),
  add column if not exists quote_currency         text,
  add column if not exists approved_at            timestamptz,
  add column if not exists approved_by            uuid references profiles(id),
  add column if not exists ordered_at             timestamptz,
  add column if not exists ordered_by             uuid references profiles(id),
  add column if not exists expected_delivery_date date,
  add column if not exists received_at            timestamptz,
  add column if not exists received_by            uuid references profiles(id),
  add column if not exists received_quantity_text text,
  add column if not exists received_photo_url     text,
  add column if not exists received_notes         text,
  add column if not exists cancel_reason          text;

-- 3) Backfill submitted_at so the timeline renders for old rows.
update parts_requests
   set submitted_at = coalesce(submitted_at, created_at)
 where submitted_at is null;
