-- Migration 0014 — Maintenance schedules and events (with parts BOM)
-- Depends on: 0001_init, 0003_machines, 0011_rls, 0013_parts
-- Idempotent: yes

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type maintenance_kind as enum ('TO', 'TO-1', 'TO-2', 'annual', 'unscheduled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type maintenance_status as enum (
    'forecast',          -- system-generated forecast based on tons_pumped
    'requested',         -- operator/engineer submitted request, awaiting confirmation
    'planned',           -- confirmed, parts reserved
    'in_progress',       -- currently being performed
    'completed',         -- finished, parts deducted from inventory
    'cancelled'          -- cancelled before execution
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- maintenance_schedules — one row per (machine_type, kind)
-- "Регламент ТО": every Х tons pumped, do this list of works,
-- with this BOM of parts.
-- ============================================================
create table if not exists maintenance_schedules (
  id                    uuid primary key default gen_random_uuid(),
  machine_type          text not null references machine_types(id) on delete cascade,
  kind                  maintenance_kind not null,

  -- trigger: every N tons of explosive pumped (the only trigger we have data for
  -- right now; calendar/engine-hours triggers can be added later)
  interval_tons         numeric(10,2) not null,

  -- alternation logic: МСЗ/МСЗУ/МЗУ alternate ТО-1 and ТО-2 every 2000 tons,
  -- so for the same kind the actual cadence is 4000 tons. Captured by:
  --   alternates_with: the *other* kind ('TO-1' alternates with 'TO-2')
  alternates_with       maintenance_kind,

  -- list of work items: [{name_ru, name_en?, hours_norm}, ...]
  work_items            jsonb not null default '[]',
  total_hours_norm      numeric(8,2),

  -- BOM: array of {part_id (uuid), quantity (numeric)} — references parts_catalog
  parts_required        jsonb not null default '[]',

  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (machine_type, kind)
);

drop trigger if exists maintenance_schedules_set_updated_at on maintenance_schedules;
create trigger maintenance_schedules_set_updated_at
  before update on maintenance_schedules
  for each row execute function set_updated_at();

create index if not exists maintenance_schedules_type_idx on maintenance_schedules (machine_type);

-- ============================================================
-- maintenance_events — concrete planned/completed events per machine
-- ============================================================
create table if not exists maintenance_events (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  machine_id            uuid not null references machines(id) on delete cascade,
  schedule_id           uuid references maintenance_schedules(id) on delete set null,
  kind                  maintenance_kind not null,
  status                maintenance_status not null default 'forecast',

  -- forecast inputs
  tons_at_creation      numeric(12,2),       -- machine.tons_pumped at the time event was created
  forecast_tons         numeric(12,2),       -- absolute tons_pumped at which event is due
  planned_date          date,                -- estimated calendar date for the event
  completed_at          timestamptz,         -- actual completion timestamp

  -- requested / planned parts (operator-facing list, friendly names + qty)
  -- shape: [{part_id (uuid), display_name_ru, quantity, source}]
  --        source: 'schedule_default' | 'manual_freeform' | 'photo_request'
  parts_requested       jsonb not null default '[]',

  -- free-text additions from the operator (parts they don't know the name of)
  -- shape: [{description, photo_url, quantity_estimate}]
  parts_freeform        jsonb not null default '[]',

  -- which works were actually performed at completion (subset of schedule.work_items)
  works_performed       jsonb,

  performed_by          uuid references profiles(id),  -- service engineer
  requested_by          uuid references profiles(id),  -- whoever submitted the request
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists maintenance_events_set_updated_at on maintenance_events;
create trigger maintenance_events_set_updated_at
  before update on maintenance_events
  for each row execute function set_updated_at();

create index if not exists maintenance_events_machine_idx
  on maintenance_events (machine_id, status, planned_date);
create index if not exists maintenance_events_company_status_idx
  on maintenance_events (company_id, status, created_at desc);
create index if not exists maintenance_events_active_idx
  on maintenance_events (company_id, planned_date)
  where status in ('forecast', 'requested', 'planned', 'in_progress');

-- Now we can wire the FK from parts_usage to maintenance_events
do $$ begin
  alter table parts_usage
    add constraint parts_usage_maintenance_event_id_fkey
    foreign key (maintenance_event_id) references maintenance_events(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table maintenance_schedules enable row level security;
alter table maintenance_events enable row level security;

-- ----- maintenance_schedules: read by anyone authenticated (it's reference data),
-- write only by platform_admin
drop policy if exists maintenance_schedules_authed_read on maintenance_schedules;
drop policy if exists maintenance_schedules_platform_write on maintenance_schedules;

create policy maintenance_schedules_authed_read on maintenance_schedules
  for select using (auth.role() = 'authenticated');

create policy maintenance_schedules_platform_write on maintenance_schedules
  for all using (public.user_role() = 'platform_admin');

-- ----- maintenance_events: company manages own; tier2/platform see all
drop policy if exists maintenance_events_company_all on maintenance_events;
drop policy if exists maintenance_events_tier2_read on maintenance_events;
drop policy if exists maintenance_events_platform_all on maintenance_events;

create policy maintenance_events_company_all on maintenance_events
  for all using (company_id = public.user_company_id());

create policy maintenance_events_tier2_read on maintenance_events
  for select using (public.user_role() = 'tier2_engineer');

create policy maintenance_events_platform_all on maintenance_events
  for all using (public.user_role() = 'platform_admin');
