-- Seed: pre-shift checklist templates per machine type
-- Run after migration 0019_shifts
-- Simplified per user feedback (2026-05-21): 4 items, identical across machine types,
-- with both RU and EN labels.
-- Safe to re-run (DELETE + INSERT).

delete from public.checklist_templates where kind = 'pre_shift';

with shared_items as (
  select '[
    {"id":"leaks_hyd_pneu","name_ru":"Утечки в гидро- и пневморазводке","name_en":"Hydraulic/pneumatic leaks","severity":"critical"},
    {"id":"oil_hyd_level","name_ru":"Уровень масла в баке гидросистемы","name_en":"Hydraulic oil tank level","severity":"critical"},
    {"id":"components_available","name_ru":"Наличие компонентов в СЗМ (АС, ЭМ, вода, ГГД и ПК)","name_en":"Components available (AN, emulsion, water, gas generator, controller)","severity":"normal"},
    {"id":"sau_panels_operational","name_ru":"Работоспособность САУ и пультов управления","name_en":"Automation (SAU) and control panels functional","severity":"critical"}
  ]'::jsonb as items
)
insert into public.checklist_templates (machine_type, kind, items)
select mt, 'pre_shift', items
from shared_items, unnest(array['МЗВ','МСЗ','МСЗУ','МЗУ']) as mt;
