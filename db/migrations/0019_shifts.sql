-- Migration 0019 — Shifts (смены), checklists, charging plan, auto-increment
-- Depends on: 0003_machines, 0011_rls, 0013_parts (no FK; just sequence)
-- Idempotent: yes
--
-- A "смена" is the operator's working shift on a specific machine. It
-- carries:
--   1) the pre-shift checklist (Pass/Fail/Skip per item, optionally with
--      photo), which blocks shift start if a critical item fails
--   2) the charging plan (планируемые тонны + рецептура)
--   3) the actuals on completion (фактические тонны → auto-increment of
--      machines.tons_pumped, which drives the maintenance forecast)

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type shift_status as enum (
    'planned',       -- created with checklist + plan, not started yet
    'in_progress',   -- checklist passed, charging in progress
    'completed',     -- shift closed with actuals
    'cancelled',     -- never started or aborted
    'blocked'        -- critical checklist item failed, can't start
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type charging_recipe as enum (
    'ANFO',
    'EMULSION',
    'BLEND_70_30',   -- 70% эмульсия + 30% AS
    'BLEND_30_70',   -- 30% эмульсия + 70% AS
    'OTHER'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type checklist_kind as enum (
    'pre_shift',     -- daily, before each shift
    'weekly',        -- expanded version once per week
    'maintenance'    -- after-maintenance acceptance check
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- checklist_templates
-- One row per (machine_type, kind). Items are JSONB so we don't have
-- to pre-create rows for every checklist line — operators only see the
-- result, not the schema.
-- Item shape: { id, name_ru, name_en?, severity: 'critical'|'normal' }
-- ============================================================
create table if not exists checklist_templates (
  id              uuid primary key default gen_random_uuid(),
  machine_type    text not null references machine_types(id) on delete cascade,
  kind            checklist_kind not null default 'pre_shift',
  items           jsonb not null default '[]',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (machine_type, kind)
);

drop trigger if exists checklist_templates_set_updated_at on checklist_templates;
create trigger checklist_templates_set_updated_at
  before update on checklist_templates
  for each row execute function set_updated_at();

create index if not exists checklist_templates_type_idx on checklist_templates (machine_type);

-- ============================================================
-- shifts
-- ============================================================
create table if not exists shifts (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  machine_id          uuid not null references machines(id) on delete cascade,
  operator_id         uuid not null references profiles(id) on delete restrict,
  status              shift_status not null default 'planned',

  -- timestamps
  planned_for         date,                -- shift's scheduled date
  started_at          timestamptz,         -- when checklist passed and shift kicked off
  completed_at        timestamptz,         -- when shift closed

  -- charging plan (filled at start)
  plan_recipe         charging_recipe,
  plan_tons           numeric(10,3),       -- planned tons of explosive to be pumped
  plan_holes          int,                 -- planned number of holes
  plan_pit_location   text,                -- block/pit identifier
  plan_notes          text,

  -- actuals (filled at end)
  actual_tons         numeric(10,3),       -- accepted actuals; trigger uses this
  actual_engine_hours numeric(10,2),       -- hours added to the engine counter
  actual_notes        text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists shifts_set_updated_at on shifts;
create trigger shifts_set_updated_at
  before update on shifts
  for each row execute function set_updated_at();

create index if not exists shifts_company_status_idx on shifts (company_id, status, planned_for desc);
create index if not exists shifts_machine_idx on shifts (machine_id, planned_for desc);
create index if not exists shifts_operator_idx on shifts (operator_id, planned_for desc);
create index if not exists shifts_active_idx on shifts (company_id, planned_for desc)
  where status in ('planned', 'in_progress');

-- ============================================================
-- checklist_executions
-- One row per (shift, template) — i.e. a single run of a specific
-- checklist within a shift. items_status is the operator's answers.
-- Item answer shape:
--   { item_id, status: 'pass'|'fail'|'skip', photo_url?, comment? }
-- ============================================================
create table if not exists checklist_executions (
  id                  uuid primary key default gen_random_uuid(),
  shift_id            uuid not null references shifts(id) on delete cascade,
  template_id         uuid not null references checklist_templates(id) on delete restrict,
  -- snapshot of the items at the time of execution (for historical audit
  -- if the template changes later)
  items_snapshot      jsonb not null,
  -- operator's answers
  items_status        jsonb not null default '[]',
  -- did any critical item fail?
  has_critical_fail   boolean not null default false,
  notes               text,
  performed_by        uuid references profiles(id),
  completed_at        timestamptz not null default now()
);

create index if not exists checklist_executions_shift_idx on checklist_executions (shift_id);

-- ============================================================
-- Trigger: auto-increment machines.tons_pumped when shift completes
-- ============================================================
create or replace function public.increment_machine_tons_on_shift_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only fire on transition into 'completed' with non-null actual_tons
  if (new.status = 'completed' and (old.status is distinct from new.status))
     and new.actual_tons is not null and new.actual_tons > 0 then
    update machines
       set tons_pumped = tons_pumped + new.actual_tons,
           engine_hours = engine_hours + coalesce(new.actual_engine_hours, 0)
     where id = new.machine_id;
  end if;
  return new;
end;
$$;

drop trigger if exists shifts_increment_machine_counters on shifts;
create trigger shifts_increment_machine_counters
  after update on shifts
  for each row execute function public.increment_machine_tons_on_shift_complete();

-- ============================================================
-- RLS
-- ============================================================
alter table checklist_templates enable row level security;
alter table shifts enable row level security;
alter table checklist_executions enable row level security;

-- ----- checklist_templates: read by anyone authenticated, write only by platform_admin
drop policy if exists checklist_templates_authed_read on checklist_templates;
drop policy if exists checklist_templates_platform_write on checklist_templates;

create policy checklist_templates_authed_read on checklist_templates
  for select using (auth.role() = 'authenticated');

create policy checklist_templates_platform_write on checklist_templates
  for all using (public.user_role() = 'platform_admin');

-- ----- shifts: company members manage own; tier2/platform read all
drop policy if exists shifts_company_all on shifts;
drop policy if exists shifts_tier2_read on shifts;
drop policy if exists shifts_platform_all on shifts;

create policy shifts_company_all on shifts
  for all using (company_id = public.user_company_id());

create policy shifts_tier2_read on shifts
  for select using (public.user_role() = 'tier2_engineer');

create policy shifts_platform_all on shifts
  for all using (public.user_role() = 'platform_admin');

-- ----- checklist_executions: same pattern via shift's company
drop policy if exists checklist_executions_company_all on checklist_executions;
drop policy if exists checklist_executions_tier2_read on checklist_executions;
drop policy if exists checklist_executions_platform_all on checklist_executions;

create policy checklist_executions_company_all on checklist_executions
  for all using (
    exists (
      select 1 from shifts s
      where s.id = checklist_executions.shift_id
        and s.company_id = public.user_company_id()
    )
  );

create policy checklist_executions_tier2_read on checklist_executions
  for select using (public.user_role() = 'tier2_engineer');

create policy checklist_executions_platform_all on checklist_executions
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- Storage: shift-photos bucket (для фото с чек-листа на критичных провалах)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('shift-photos', 'shift-photos', false)
on conflict (id) do nothing;

drop policy if exists shift_photos_member_read on storage.objects;
drop policy if exists shift_photos_company_write on storage.objects;

create policy shift_photos_member_read on storage.objects
  for select using (
    bucket_id = 'shift-photos'
    and (
      (storage.foldername(name))[1] = public.user_company_id()::text
      or public.user_role() in ('tier2_engineer', 'platform_admin')
    )
  );

create policy shift_photos_company_write on storage.objects
  for insert with check (
    bucket_id = 'shift-photos'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );
