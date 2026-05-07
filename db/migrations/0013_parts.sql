-- Migration 0013 — Spare parts catalog, per-company inventory, usage history
-- Depends on: 0001_init, 0002_users, 0003_machines, 0011_rls
-- Idempotent: yes
--
-- Two-tier naming: every part has both a friendly operator-facing label
-- (display_name_ru / display_name_en) AND an internal SKU + manufacturer
-- part_number that platform admins / Tier 2 see. Operators never see the
-- raw artikul on a request form — they pick by friendly name + где
-- используется, we map internally.

-- ============================================================
-- parts_catalog — central reference (one row per unique part)
-- ============================================================
create table if not exists parts_catalog (
  id                    uuid primary key default gen_random_uuid(),

  -- public-facing names (shown to operators / company users)
  display_name_ru       text not null,
  display_name_en       text,
  category              text not null,        -- 'filter', 'seal', 'sensor', 'module', 'pump_part', 'consumable'
  application_ru        text,                 -- "Используется в гидросистеме"
  application_en        text,

  -- internal / supplier-facing identifiers (Tier 2 / admin only via UI)
  manufacturer          text not null default 'НИПИГОРМАШ',
  part_number           text not null,        -- artikul: 081.02.117, MPH 100-4-А25-А, СТ16.03.301, ...
  internal_sku          text,                 -- our own short code if we mint one

  unit                  text not null default 'pcs' check (unit in ('pcs', 'm', 'kg', 'l', 'set')),

  -- which machine types this part is compatible with (subset of МЗВ/МСЗ/МСЗУ/МЗУ)
  compatible_machine_types text[] not null default '{}',

  -- known prices (for our own forecasting; not shown to clients in MVP)
  last_known_price_rub  numeric(12,2),
  last_known_price_usd  numeric(12,2),
  price_updated_at      timestamptz,

  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (manufacturer, part_number)
);

drop trigger if exists parts_catalog_set_updated_at on parts_catalog;
create trigger parts_catalog_set_updated_at
  before update on parts_catalog
  for each row execute function set_updated_at();

create index if not exists parts_catalog_category_idx on parts_catalog (category);
create index if not exists parts_catalog_compat_idx on parts_catalog using gin (compatible_machine_types);

-- ============================================================
-- parts_inventory — "Гараж": per-company stock levels
-- ============================================================
create table if not exists parts_inventory (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  part_id               uuid not null references parts_catalog(id) on delete restrict,

  -- machine_id IS NULL → general-purpose stock for the whole company
  -- machine_id IS NOT NULL → reserved for a specific machine
  machine_id            uuid references machines(id) on delete set null,

  quantity              numeric(10,3) not null default 0 check (quantity >= 0),
  reorder_threshold     numeric(10,3),       -- show 🟡 alert when quantity < this
  last_replenished_at   timestamptz,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- one row per (company, part, machine|general) — prevents duplicates
  unique (company_id, part_id, machine_id)
);

drop trigger if exists parts_inventory_set_updated_at on parts_inventory;
create trigger parts_inventory_set_updated_at
  before update on parts_inventory
  for each row execute function set_updated_at();

create index if not exists parts_inventory_company_idx on parts_inventory (company_id);
create index if not exists parts_inventory_low_stock_idx
  on parts_inventory (company_id, part_id)
  where reorder_threshold is not null and quantity < reorder_threshold;

-- ============================================================
-- parts_usage — append-only log of consumption
-- ============================================================
create table if not exists parts_usage (
  id                    uuid primary key default gen_random_uuid(),
  inventory_id          uuid not null references parts_inventory(id) on delete restrict,
  ticket_id             uuid references tickets(id) on delete set null,
  -- maintenance_event_id will be added in 0014 once the table exists
  maintenance_event_id  uuid,
  quantity_used         numeric(10,3) not null check (quantity_used > 0),
  used_at               timestamptz not null default now(),
  used_by               uuid references profiles(id),
  notes                 text
);

create index if not exists parts_usage_inventory_idx on parts_usage (inventory_id, used_at desc);
create index if not exists parts_usage_ticket_idx on parts_usage (ticket_id) where ticket_id is not null;

-- ============================================================
-- RLS
-- ============================================================
alter table parts_catalog enable row level security;
alter table parts_inventory enable row level security;
alter table parts_usage enable row level security;

-- ----- parts_catalog: read by any authenticated user, write by platform_admin
drop policy if exists parts_catalog_authed_read on parts_catalog;
drop policy if exists parts_catalog_platform_write on parts_catalog;

create policy parts_catalog_authed_read on parts_catalog
  for select using (auth.role() = 'authenticated');

create policy parts_catalog_platform_write on parts_catalog
  for all using (public.user_role() = 'platform_admin');

-- ----- parts_inventory: company members manage own; tier2 / platform see all
drop policy if exists parts_inventory_company_all on parts_inventory;
drop policy if exists parts_inventory_tier2_read on parts_inventory;
drop policy if exists parts_inventory_platform_all on parts_inventory;

create policy parts_inventory_company_all on parts_inventory
  for all using (company_id = public.user_company_id());

-- Tier 2 sees inventory of any client to plan supply / advise
create policy parts_inventory_tier2_read on parts_inventory
  for select using (public.user_role() = 'tier2_engineer');

create policy parts_inventory_platform_all on parts_inventory
  for all using (public.user_role() = 'platform_admin');

-- ----- parts_usage: same pattern as inventory
drop policy if exists parts_usage_company_all on parts_usage;
drop policy if exists parts_usage_tier2_read on parts_usage;
drop policy if exists parts_usage_platform_all on parts_usage;

create policy parts_usage_company_all on parts_usage
  for all using (
    exists (
      select 1 from parts_inventory inv
      where inv.id = parts_usage.inventory_id
        and inv.company_id = public.user_company_id()
    )
  );

create policy parts_usage_tier2_read on parts_usage
  for select using (public.user_role() = 'tier2_engineer');

create policy parts_usage_platform_all on parts_usage
  for all using (public.user_role() = 'platform_admin');
