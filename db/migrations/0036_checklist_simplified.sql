-- 0036 — simplify pre-shift checklist to 4 items, identical across machine types.
-- Per user feedback (2026-05-21): drop chassis/mounting items, keep only:
--   1) Hydraulic/pneumatic leaks
--   2) Hydraulic oil level
--   3) Components available (AN, emulsion, water, gas generator, controller)
--   4) Automation (SAU) and control panels functional
-- Also: add name_en for each item (English UI showed Russian labels before).
--
-- We do NOT delete existing rows — checklist_executions reference them via
-- template_id FK, and old executions must remain readable. Instead we
-- UPDATE existing pre_shift templates in place and INSERT for any machine
-- type that has no pre_shift template yet.
-- Safe to re-run.

with shared_items as (
  select '[
    {"id":"leaks_hyd_pneu","name_ru":"Утечки в гидро- и пневморазводке","name_en":"Hydraulic/pneumatic leaks","severity":"critical"},
    {"id":"oil_hyd_level","name_ru":"Уровень масла в баке гидросистемы","name_en":"Hydraulic oil tank level","severity":"critical"},
    {"id":"components_available","name_ru":"Наличие компонентов в СЗМ (АС, ЭМ, вода, ГГД и ПК)","name_en":"Components available (AN, emulsion, water, gas generator, controller)","severity":"normal"},
    {"id":"sau_panels_operational","name_ru":"Работоспособность САУ и пультов управления","name_en":"Automation (SAU) and control panels functional","severity":"critical"}
  ]'::jsonb as items
)
update public.checklist_templates t
set items = (select items from shared_items)
where t.kind = 'pre_shift';

with shared_items as (
  select '[
    {"id":"leaks_hyd_pneu","name_ru":"Утечки в гидро- и пневморазводке","name_en":"Hydraulic/pneumatic leaks","severity":"critical"},
    {"id":"oil_hyd_level","name_ru":"Уровень масла в баке гидросистемы","name_en":"Hydraulic oil tank level","severity":"critical"},
    {"id":"components_available","name_ru":"Наличие компонентов в СЗМ (АС, ЭМ, вода, ГГД и ПК)","name_en":"Components available (AN, emulsion, water, gas generator, controller)","severity":"normal"},
    {"id":"sau_panels_operational","name_ru":"Работоспособность САУ и пультов управления","name_en":"Automation (SAU) and control panels functional","severity":"critical"}
  ]'::jsonb as items
)
insert into public.checklist_templates (machine_type, kind, items)
select mt, 'pre_shift', (select items from shared_items)
from unnest(array['МЗВ','МСЗ','МСЗУ','МЗУ']) as mt
where not exists (
  select 1
  from public.checklist_templates ct
  where ct.machine_type = mt
    and ct.kind = 'pre_shift'
);
