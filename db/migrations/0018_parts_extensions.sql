-- Migration 0018 — Custom parts + photos + standalone parts_requests
-- Depends on: 0013_parts, 0014_maintenance, 0011_rls
-- Idempotent: yes
--
-- Three user-driven additions on top of Sprint 1.10:
--
-- 1) Custom parts in the catalog. Operators / engineers often need to
--    stock something that's not in the НИПИГОРМАШ regulation. We keep
--    one parts_catalog table but tag custom rows with the company that
--    created them. RLS makes them visible only to that company (plus
--    Tier 2 / platform_admin for support).
--
-- 2) Photos on inventory entries. When someone receives a delivery and
--    photos the box / artikul tag for verification, we attach it to
--    the parts_inventory row.
--
-- 3) Standalone parts requests. Until now a request was bundled into a
--    maintenance event. Operators also need "just order me this part
--    ASAP" without the ТО context. New parts_requests table mirrors
--    maintenance_events on the parts side but without schedule/work
--    semantics.

-- ============================================================
-- 1) parts_catalog extensions
-- ============================================================
alter table parts_catalog
  add column if not exists is_custom boolean not null default false,
  add column if not exists created_by_company_id uuid references companies(id) on delete cascade,
  add column if not exists image_url text;

-- Allow custom rows to share part_number across tenants (the unique
-- constraint on (manufacturer, part_number) was sensible for the
-- НИПИГОРМАШ baseline catalog but breaks "Acme Co. and BoreCo each
-- entered the same НПК ТЕКО sensor as a custom part"). Keep the
-- baseline rows globally unique, but allow custom rows to coexist.
do $$ begin
  alter table parts_catalog drop constraint parts_catalog_manufacturer_part_number_key;
exception when undefined_object then null;
end $$;

create unique index if not exists parts_catalog_baseline_unique
  on parts_catalog (manufacturer, part_number)
  where is_custom = false;

create unique index if not exists parts_catalog_custom_unique
  on parts_catalog (created_by_company_id, manufacturer, part_number)
  where is_custom = true;

create index if not exists parts_catalog_custom_lookup
  on parts_catalog (created_by_company_id) where is_custom = true;

-- Replace the read policy so a company sees baseline + its own customs;
-- writes for non-platform users are restricted to their own custom rows.
drop policy if exists parts_catalog_authed_read on parts_catalog;
drop policy if exists parts_catalog_company_custom_write on parts_catalog;
drop policy if exists parts_catalog_platform_write on parts_catalog;

create policy parts_catalog_baseline_or_own_read on parts_catalog
  for select using (
    is_custom = false
    or created_by_company_id = public.user_company_id()
    or public.user_role() in ('tier2_engineer', 'platform_admin')
  );

create policy parts_catalog_company_custom_write on parts_catalog
  for all using (
    is_custom = true and created_by_company_id = public.user_company_id()
  )
  with check (
    is_custom = true and created_by_company_id = public.user_company_id()
  );

create policy parts_catalog_platform_write on parts_catalog
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- 2) parts_inventory photo
-- ============================================================
alter table parts_inventory
  add column if not exists image_url text;

-- ============================================================
-- 3) parts_requests — standalone "buy me this part" requests
-- ============================================================
do $$ begin
  create type parts_request_status as enum (
    'new',         -- just submitted by the operator
    'approved',    -- platform admin acknowledged, vendor selected
    'ordered',     -- PO sent to supplier
    'delivered',   -- received and added to inventory
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type parts_request_urgency as enum (
    'normal',      -- default, weeks
    'urgent',      -- same week
    'critical'     -- machine down, ASAP
  );
exception when duplicate_object then null;
end $$;

create table if not exists parts_requests (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  machine_id         uuid references machines(id) on delete set null,
  status             parts_request_status not null default 'new',
  urgency            parts_request_urgency not null default 'normal',

  -- BOM-like array of catalog parts: [{part_id, display_name_ru, quantity, source}]
  parts_requested    jsonb not null default '[]',

  -- Free-form items: [{description, photo_url, quantity_estimate, category_hint}]
  parts_freeform     jsonb not null default '[]',

  notes              text,
  requested_by       uuid references profiles(id),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  resolved_at        timestamptz
);

drop trigger if exists parts_requests_set_updated_at on parts_requests;
create trigger parts_requests_set_updated_at
  before update on parts_requests
  for each row execute function set_updated_at();

create index if not exists parts_requests_company_status_idx
  on parts_requests (company_id, status, created_at desc);
create index if not exists parts_requests_active_idx
  on parts_requests (company_id, urgency, created_at desc)
  where status in ('new', 'approved', 'ordered');

alter table parts_requests enable row level security;

drop policy if exists parts_requests_company_all on parts_requests;
drop policy if exists parts_requests_tier2_read on parts_requests;
drop policy if exists parts_requests_platform_all on parts_requests;

create policy parts_requests_company_all on parts_requests
  for all using (company_id = public.user_company_id());

create policy parts_requests_tier2_read on parts_requests
  for all using (public.user_role() = 'tier2_engineer');

create policy parts_requests_platform_all on parts_requests
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- Storage bucket for parts photos (custom parts + receipt photos +
-- freeform photos in maintenance/parts requests)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('parts-photos', 'parts-photos', false)
on conflict (id) do nothing;

drop policy if exists parts_photos_member_read on storage.objects;
drop policy if exists parts_photos_company_write on storage.objects;

-- Path convention: <company_id>/<context>/<filename>
-- Read: same company OR Tier 2 / platform_admin
create policy parts_photos_member_read on storage.objects
  for select using (
    bucket_id = 'parts-photos'
    and (
      (storage.foldername(name))[1] = public.user_company_id()::text
      or public.user_role() in ('tier2_engineer', 'platform_admin')
    )
  );

create policy parts_photos_company_write on storage.objects
  for insert with check (
    bucket_id = 'parts-photos'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );
