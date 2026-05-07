-- Migration 0003 — Machines and operator assignments
-- Depends on: 0001_init, 0002_users
-- Idempotent: yes

-- ============================================================
-- auger_position enum
-- ============================================================
do $$ begin
  create type auger_position as enum ('upper', 'lower', 'none');
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- machines
-- ============================================================
create table if not exists machines (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies(id) on delete cascade,
  machine_type      text not null references machine_types(id) on delete restrict,
  model_code        text not null,
  tonnage_t         numeric(5,1) not null,
  auger_position    auger_position not null default 'none',
  has_drum          boolean not null default false,
  component_count   smallint not null default 2 check (component_count between 2 and 4),
  ggd_type          text check (ggd_type in ('SN', 'acetic_acid')),
  serial_number     text,
  in_service_since  date,
  pit_location      text,
  engine_hours      numeric(10,2) not null default 0,
  tons_pumped       numeric(12,2) not null default 0,
  status            text not null default 'active' check (status in ('active', 'maintenance', 'decommissioned')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint machines_company_serial_unique unique (company_id, serial_number)
);

drop trigger if exists machines_set_updated_at on machines;
create trigger machines_set_updated_at
  before update on machines
  for each row execute function set_updated_at();

create index if not exists machines_company_idx on machines (company_id);
create index if not exists machines_company_status_idx on machines (company_id, status);

-- ============================================================
-- machine_assignments (operators ↔ machines, M:N)
-- ============================================================
create table if not exists machine_assignments (
  machine_id    uuid not null references machines(id) on delete cascade,
  operator_id   uuid not null references profiles(id) on delete cascade,
  assigned_at   timestamptz not null default now(),
  unassigned_at timestamptz,
  primary key (machine_id, operator_id)
);

create index if not exists machine_assignments_operator_active_idx
  on machine_assignments (operator_id) where unassigned_at is null;
