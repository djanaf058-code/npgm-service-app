-- Seed: pre-shift checklist templates per machine type
-- Run after migration 0019_shifts
-- Source: НИПИГОРМАШ РЭ + maintenance_specs (typical pre-shift inspection)
-- Safe to re-run (DELETE + INSERT)

delete from checklist_templates where kind = 'pre_shift';

-- ============================================================
-- МЗВ (100% emulsion) — pre-shift
-- ============================================================
insert into checklist_templates (machine_type, kind, items)
values ('МЗВ', 'pre_shift', '[
  {"id":"oil_hyd","name_ru":"Уровень масла в гидросистеме","severity":"critical"},
  {"id":"coolant","name_ru":"Уровень охлаждающей жидкости","severity":"critical"},
  {"id":"hp_hoses","name_ru":"Состояние шлангов высокого давления","severity":"critical"},
  {"id":"filters_visual","name_ru":"Визуальный осмотр фильтров","severity":"normal"},
  {"id":"fire_system","name_ru":"Работоспособность системы пожаротушения","severity":"critical"},
  {"id":"lights","name_ru":"Освещение, сигналы, проблесковый маячок","severity":"normal"},
  {"id":"brakes","name_ru":"Тормозная система","severity":"critical"},
  {"id":"emulsion_level","name_ru":"Уровень эмульсии в баке","severity":"normal"},
  {"id":"pump_leaks","name_ru":"Утечки в насосной группе NETZSCH","severity":"critical"},
  {"id":"drum","name_ru":"Барабан и зарядный рукав","severity":"normal"},
  {"id":"control_panel","name_ru":"Работоспособность пульта управления","severity":"critical"},
  {"id":"sau_test","name_ru":"Тест системы автоматического управления (САУ)","severity":"normal"}
]');

-- ============================================================
-- МСЗ (100% ANFO) — pre-shift
-- ============================================================
insert into checklist_templates (machine_type, kind, items)
values ('МСЗ', 'pre_shift', '[
  {"id":"oil_hyd","name_ru":"Уровень масла в гидросистеме","severity":"critical"},
  {"id":"coolant","name_ru":"Уровень охлаждающей жидкости","severity":"critical"},
  {"id":"hp_hoses","name_ru":"Состояние шлангов высокого давления","severity":"critical"},
  {"id":"filters_visual","name_ru":"Визуальный осмотр фильтров","severity":"normal"},
  {"id":"fire_system","name_ru":"Работоспособность системы пожаротушения","severity":"critical"},
  {"id":"lights","name_ru":"Освещение, сигналы, проблесковый маячок","severity":"normal"},
  {"id":"brakes","name_ru":"Тормозная система","severity":"critical"},
  {"id":"as_level","name_ru":"Уровень аммиачной селитры в бункере","severity":"normal"},
  {"id":"diesel_level","name_ru":"Уровень дизельного топлива","severity":"normal"},
  {"id":"auger_visual","name_ru":"Визуальный осмотр шнека","severity":"critical"},
  {"id":"control_panel","name_ru":"Работоспособность пульта управления","severity":"critical"},
  {"id":"sau_test","name_ru":"Тест системы автоматического управления (САУ)","severity":"normal"}
]');

-- ============================================================
-- МСЗУ (Universal: ANFO/blend/emulsion) — pre-shift
-- ============================================================
insert into checklist_templates (machine_type, kind, items)
values ('МСЗУ', 'pre_shift', '[
  {"id":"oil_hyd","name_ru":"Уровень масла в гидросистеме","severity":"critical"},
  {"id":"coolant","name_ru":"Уровень охлаждающей жидкости","severity":"critical"},
  {"id":"hp_hoses","name_ru":"Состояние шлангов высокого давления","severity":"critical"},
  {"id":"filters_visual","name_ru":"Визуальный осмотр фильтров","severity":"normal"},
  {"id":"fire_system","name_ru":"Работоспособность системы пожаротушения","severity":"critical"},
  {"id":"lights","name_ru":"Освещение, сигналы, проблесковый маячок","severity":"normal"},
  {"id":"brakes","name_ru":"Тормозная система","severity":"critical"},
  {"id":"emulsion_level","name_ru":"Уровень эмульсии в баке","severity":"normal"},
  {"id":"as_level","name_ru":"Уровень аммиачной селитры в бункере","severity":"normal"},
  {"id":"pump_leaks","name_ru":"Утечки в насосной группе NETZSCH","severity":"critical"},
  {"id":"auger_visual","name_ru":"Визуальный осмотр шнека","severity":"critical"},
  {"id":"drum","name_ru":"Барабан и зарядный рукав","severity":"normal"},
  {"id":"pjd","name_ru":"Система технологического подогрева (ПЖД)","severity":"normal"},
  {"id":"control_panel","name_ru":"Работоспособность пульта управления","severity":"critical"},
  {"id":"sau_test","name_ru":"Тест системы автоматического управления (САУ)","severity":"normal"}
]');

-- ============================================================
-- МЗУ (Blend 70/30) — pre-shift
-- ============================================================
insert into checklist_templates (machine_type, kind, items)
values ('МЗУ', 'pre_shift', '[
  {"id":"oil_hyd","name_ru":"Уровень масла в гидросистеме","severity":"critical"},
  {"id":"coolant","name_ru":"Уровень охлаждающей жидкости","severity":"critical"},
  {"id":"hp_hoses","name_ru":"Состояние шлангов высокого давления","severity":"critical"},
  {"id":"filters_visual","name_ru":"Визуальный осмотр фильтров","severity":"normal"},
  {"id":"fire_system","name_ru":"Работоспособность системы пожаротушения","severity":"critical"},
  {"id":"lights","name_ru":"Освещение, сигналы, проблесковый маячок","severity":"normal"},
  {"id":"brakes","name_ru":"Тормозная система","severity":"critical"},
  {"id":"emulsion_level","name_ru":"Уровень эмульсии в баке","severity":"normal"},
  {"id":"as_level","name_ru":"Уровень аммиачной селитры в бункере","severity":"normal"},
  {"id":"water_level","name_ru":"Уровень воды (при исполнении 4К)","severity":"normal"},
  {"id":"ggd_level","name_ru":"Уровень ГГД (при исполнении 4К)","severity":"normal"},
  {"id":"pump_leaks","name_ru":"Утечки в насосной группе NETZSCH","severity":"critical"},
  {"id":"auger_visual","name_ru":"Визуальный осмотр шнека","severity":"critical"},
  {"id":"pjd","name_ru":"Система технологического подогрева (ПЖД)","severity":"normal"},
  {"id":"control_panel","name_ru":"Работоспособность пульта управления","severity":"critical"},
  {"id":"sau_test","name_ru":"Тест системы автоматического управления (САУ)","severity":"normal"}
]');
