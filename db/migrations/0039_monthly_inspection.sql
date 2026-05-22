-- 0039 — gate monthly inspection by "30 days after first shift".
-- Per user feedback (2026-05-21): monthly inspection appears as a separate
-- step ONLY 30 days after the first shift. Until then, only the pre-shift
-- checklist runs. After 30 days, the existing last_monthly_check_at logic
-- takes over.
--
-- Also seeds default monthly checklist items per machine type.
-- Safe to re-run.

-- 1) Column to track when the machine entered service (first shift).
alter table public.machines
  add column if not exists first_shift_at timestamptz;

comment on column public.machines.first_shift_at is
  'Timestamp of the first non-cancelled shift on this machine. Used to gate the monthly inspection: it only appears 30 days after this point.';

-- 2) Backfill: earliest shift.started_at (or planned_for) per machine.
update public.machines m
set first_shift_at = sub.first_at
from (
  select machine_id,
         min(coalesce(started_at, planned_for::timestamptz)) as first_at
  from public.shifts
  where status <> 'cancelled'
  group by machine_id
) sub
where m.id = sub.machine_id
  and m.first_shift_at is null;

-- 3) Trigger to keep first_shift_at fresh: set it once when the first
--    non-cancelled shift lands.
create or replace function public.set_machine_first_shift_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'cancelled' then
    update public.machines
       set first_shift_at = coalesce(first_shift_at,
                                     coalesce(new.started_at,
                                              new.planned_for::timestamptz,
                                              now()))
     where id = new.machine_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shifts_set_machine_first_shift on public.shifts;
create trigger trg_shifts_set_machine_first_shift
  after insert on public.shifts
  for each row
  execute function public.set_machine_first_shift_at();

-- 4) Seed monthly checklist templates for each machine type.
--    Items chosen as common for СЗМ-type equipment without touching chassis
--    / mounting (those were explicitly dropped from pre-shift in 0036).
--    UPDATE existing first (FK from checklist_executions blocks DELETE),
--    then INSERT for any machine type that has no monthly template yet.

with monthly_items as (
  select '[
    {"id":"hyd_pressure","name_ru":"Давление в гидросистеме (рабочие режимы)","name_en":"Hydraulic system pressure (operational modes)","severity":"critical"},
    {"id":"filters_check","name_ru":"Фильтры (масляный, воздушный, гидравлический) — проверка и замена при необходимости","name_en":"Filters (oil, air, hydraulic) — inspect and replace as needed","severity":"normal"},
    {"id":"belts_drives","name_ru":"Клиновые ремни и приводы насосной группы","name_en":"Drive belts and pump drives","severity":"normal"},
    {"id":"hp_hoses_monthly","name_ru":"Шланги высокого давления — трещины, протечки, износ","name_en":"High-pressure hoses — cracks, leaks, wear","severity":"critical"},
    {"id":"hyd_oil_quality","name_ru":"Уровень и качество масла в гидросистеме","name_en":"Hydraulic oil level and condition","severity":"critical"},
    {"id":"battery","name_ru":"АКБ — уровень электролита, состояние клемм","name_en":"Battery — electrolyte level and terminal condition","severity":"normal"},
    {"id":"fire_pressure","name_ru":"Система пожаротушения — давление в баллоне","name_en":"Fire-suppression system — cylinder pressure","severity":"critical"},
    {"id":"sau_sensors","name_ru":"Тест датчиков САУ и калибровка дозаторов","name_en":"Automation sensors test and dosing calibration","severity":"normal"}
  ]'::jsonb as items
)
update public.checklist_templates t
set items = (select items from monthly_items)
where t.kind = 'monthly';

with monthly_items as (
  select '[
    {"id":"hyd_pressure","name_ru":"Давление в гидросистеме (рабочие режимы)","name_en":"Hydraulic system pressure (operational modes)","severity":"critical"},
    {"id":"filters_check","name_ru":"Фильтры (масляный, воздушный, гидравлический) — проверка и замена при необходимости","name_en":"Filters (oil, air, hydraulic) — inspect and replace as needed","severity":"normal"},
    {"id":"belts_drives","name_ru":"Клиновые ремни и приводы насосной группы","name_en":"Drive belts and pump drives","severity":"normal"},
    {"id":"hp_hoses_monthly","name_ru":"Шланги высокого давления — трещины, протечки, износ","name_en":"High-pressure hoses — cracks, leaks, wear","severity":"critical"},
    {"id":"hyd_oil_quality","name_ru":"Уровень и качество масла в гидросистеме","name_en":"Hydraulic oil level and condition","severity":"critical"},
    {"id":"battery","name_ru":"АКБ — уровень электролита, состояние клемм","name_en":"Battery — electrolyte level and terminal condition","severity":"normal"},
    {"id":"fire_pressure","name_ru":"Система пожаротушения — давление в баллоне","name_en":"Fire-suppression system — cylinder pressure","severity":"critical"},
    {"id":"sau_sensors","name_ru":"Тест датчиков САУ и калибровка дозаторов","name_en":"Automation sensors test and dosing calibration","severity":"normal"}
  ]'::jsonb as items
)
insert into public.checklist_templates (machine_type, kind, items)
select mt, 'monthly', (select items from monthly_items)
from unnest(array['МЗВ','МСЗ','МСЗУ','МЗУ']) as mt
where not exists (
  select 1
  from public.checklist_templates ct
  where ct.machine_type = mt
    and ct.kind = 'monthly'
);
