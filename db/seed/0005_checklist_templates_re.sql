-- Seed 0005 — checklist templates aligned with НИПИГОРМАШ РЭ.
-- Run AFTER migration 0022 (which adds 'monthly' to checklist_kind).
-- Source: РЭ МСЗУ-14-НПБ §5.5, РЭ МЗВ-16 §5.6, Operation Manual MZU-16-4K §5.5.
-- Replaces seed 0004 entirely. Safe to re-run.

delete from checklist_templates;

-- ============================================================
-- ЕЖЕСМЕННЫЕ (pre_shift) — каждую смену
-- Структура: А. Шасси (общая часть) + Б. Технологическое оборудование (по РЭ).
-- ============================================================

-- ------------------------------- МЗВ (100% эмульсия) -------------------------------
insert into checklist_templates (machine_type, kind, items)
values ('МЗВ', 'pre_shift', '[
  {"id":"chassis_engine_oil","name_ru":"Шасси: уровень масла двигателя","severity":"critical"},
  {"id":"chassis_coolant","name_ru":"Шасси: уровень охлаждающей жидкости","severity":"critical"},
  {"id":"chassis_brakes","name_ru":"Шасси: тормозная система","severity":"critical"},
  {"id":"chassis_tyres","name_ru":"Шасси: давление и состояние шин","severity":"normal"},
  {"id":"chassis_lights","name_ru":"Шасси: освещение, проблесковый маячок, звуковой сигнал","severity":"normal"},
  {"id":"chassis_fuel","name_ru":"Шасси: уровень дизельного топлива","severity":"normal"},
  {"id":"chassis_fire","name_ru":"Шасси: проверка системы пожаротушения","severity":"critical"},
  {"id":"tech_clean","name_ru":"Очистка оборудования от грязи и остатков ВВ","severity":"normal"},
  {"id":"tech_loading_grids","name_ru":"Крепление сеток в загрузочных люках бункера","severity":"critical"},
  {"id":"tech_emulsion_tank_mount","name_ru":"Крепление бункера жидкого компонента к надрамнику","severity":"critical"},
  {"id":"tech_bolted","name_ru":"Надёжность всех болтовых соединений","severity":"critical"},
  {"id":"tech_manipulator_cyl","name_ru":"Крепление цилиндра манипулятора","severity":"critical"},
  {"id":"tech_leaks","name_ru":"Утечки в гидро- и пневморазводке (резьбовые соединения)","severity":"critical"},
  {"id":"tech_hyd_oil","name_ru":"Уровень масла в баке гидросистемы","severity":"critical"},
  {"id":"tech_emulsion_level","name_ru":"Уровень эмульсии в баке","severity":"normal"},
  {"id":"tech_drum","name_ru":"Барабан и зарядный рукав — визуальный осмотр","severity":"normal"},
  {"id":"tech_control","name_ru":"Пульт управления и САУ","severity":"critical"}
]');

-- ------------------------------- МСЗ (100% ANFO) -------------------------------
insert into checklist_templates (machine_type, kind, items)
values ('МСЗ', 'pre_shift', '[
  {"id":"chassis_engine_oil","name_ru":"Шасси: уровень масла двигателя","severity":"critical"},
  {"id":"chassis_coolant","name_ru":"Шасси: уровень охлаждающей жидкости","severity":"critical"},
  {"id":"chassis_brakes","name_ru":"Шасси: тормозная система","severity":"critical"},
  {"id":"chassis_tyres","name_ru":"Шасси: давление и состояние шин","severity":"normal"},
  {"id":"chassis_lights","name_ru":"Шасси: освещение, проблесковый маячок, звуковой сигнал","severity":"normal"},
  {"id":"chassis_fuel","name_ru":"Шасси: уровень дизельного топлива","severity":"normal"},
  {"id":"chassis_fire","name_ru":"Шасси: проверка системы пожаротушения","severity":"critical"},
  {"id":"tech_clean","name_ru":"Очистка оборудования от грязи и остатков селитры","severity":"normal"},
  {"id":"tech_loading_grids","name_ru":"Крепление сеток в загрузочных люках бункера","severity":"critical"},
  {"id":"tech_an_bunker_mount","name_ru":"Крепление бункера AN к раме","severity":"critical"},
  {"id":"tech_bolted","name_ru":"Надёжность всех болтовых соединений","severity":"critical"},
  {"id":"tech_feeder_cyl","name_ru":"Крепление цилиндра подъёма питателя","severity":"critical"},
  {"id":"tech_leaks","name_ru":"Утечки в гидро- и пневморазводке","severity":"critical"},
  {"id":"tech_hyd_oil","name_ru":"Уровень масла в баке гидросистемы","severity":"critical"},
  {"id":"tech_an_level","name_ru":"Уровень аммиачной селитры (AN) в бункере","severity":"normal"},
  {"id":"tech_diesel_level","name_ru":"Уровень дизельного топлива в технологическом баке","severity":"normal"},
  {"id":"tech_auger","name_ru":"Шнек — визуальный осмотр","severity":"critical"},
  {"id":"tech_control","name_ru":"Пульт управления и САУ","severity":"critical"}
]');

-- ------------------------------- МСЗУ (универсал) -------------------------------
insert into checklist_templates (machine_type, kind, items)
values ('МСЗУ', 'pre_shift', '[
  {"id":"chassis_engine_oil","name_ru":"Шасси: уровень масла двигателя","severity":"critical"},
  {"id":"chassis_coolant","name_ru":"Шасси: уровень охлаждающей жидкости","severity":"critical"},
  {"id":"chassis_brakes","name_ru":"Шасси: тормозная система","severity":"critical"},
  {"id":"chassis_tyres","name_ru":"Шасси: давление и состояние шин","severity":"normal"},
  {"id":"chassis_lights","name_ru":"Шасси: освещение, проблесковый маячок, звуковой сигнал","severity":"normal"},
  {"id":"chassis_fuel","name_ru":"Шасси: уровень дизельного топлива","severity":"normal"},
  {"id":"chassis_fire","name_ru":"Шасси: проверка системы пожаротушения","severity":"critical"},
  {"id":"tech_clean","name_ru":"Очистка оборудования от грязи и остатков ВВ/AN","severity":"normal"},
  {"id":"tech_loading_grids","name_ru":"Крепление сеток в загрузочных люках бункера","severity":"critical"},
  {"id":"tech_emulsion_tank_mount","name_ru":"Крепление бункера жидкого компонента","severity":"critical"},
  {"id":"tech_bunker_to_frame","name_ru":"Крепление бункера к лонжеронам шасси","severity":"critical"},
  {"id":"tech_bolted","name_ru":"Надёжность всех болтовых соединений","severity":"critical"},
  {"id":"tech_feeder_cyl","name_ru":"Крепление цилиндра подъёма питателя","severity":"critical"},
  {"id":"tech_leaks","name_ru":"Утечки в гидро- и пневморазводке","severity":"critical"},
  {"id":"tech_hyd_oil","name_ru":"Уровень масла в баке гидросистемы","severity":"critical"},
  {"id":"tech_pneumo_seal","name_ru":"Герметичность пневмозадвижек","severity":"critical"},
  {"id":"tech_emulsion_level","name_ru":"Уровень эмульсии в баке","severity":"normal"},
  {"id":"tech_an_level","name_ru":"Уровень аммиачной селитры (AN) в бункере","severity":"normal"},
  {"id":"tech_auger","name_ru":"Шнек — визуальный осмотр","severity":"critical"},
  {"id":"tech_drum","name_ru":"Барабан и зарядный рукав — визуальный осмотр","severity":"normal"},
  {"id":"tech_control","name_ru":"Пульт управления и САУ","severity":"critical"}
]');

-- ------------------------------- МЗУ (Em + AN, без дизеля) -------------------------------
insert into checklist_templates (machine_type, kind, items)
values ('МЗУ', 'pre_shift', '[
  {"id":"chassis_engine_oil","name_ru":"Шасси: уровень масла двигателя","severity":"critical"},
  {"id":"chassis_coolant","name_ru":"Шасси: уровень охлаждающей жидкости","severity":"critical"},
  {"id":"chassis_brakes","name_ru":"Шасси: тормозная система","severity":"critical"},
  {"id":"chassis_tyres","name_ru":"Шасси: давление и состояние шин","severity":"normal"},
  {"id":"chassis_lights","name_ru":"Шасси: освещение, проблесковый маячок, звуковой сигнал","severity":"normal"},
  {"id":"chassis_fuel","name_ru":"Шасси: уровень дизельного топлива","severity":"normal"},
  {"id":"chassis_fire","name_ru":"Шасси: проверка системы пожаротушения","severity":"critical"},
  {"id":"tech_clean","name_ru":"Очистка оборудования от грязи и остатков","severity":"normal"},
  {"id":"tech_loading_grids","name_ru":"Крепление сеток в загрузочных люках бункера","severity":"critical"},
  {"id":"tech_emulsion_tank_mount","name_ru":"Крепление бункера жидкого компонента к раме","severity":"critical"},
  {"id":"tech_an_bunker_mount","name_ru":"Крепление бункера AN к раме","severity":"critical"},
  {"id":"tech_bolted","name_ru":"Надёжность всех болтовых соединений","severity":"critical"},
  {"id":"tech_manipulator_cyl","name_ru":"Крепление цилиндра манипулятора","severity":"critical"},
  {"id":"tech_leaks","name_ru":"Утечки в гидро- и пневморазводке","severity":"critical"},
  {"id":"tech_hyd_oil","name_ru":"Уровень масла в баке гидросистемы","severity":"critical"},
  {"id":"tech_emulsion_level","name_ru":"Уровень эмульсии в баке","severity":"normal"},
  {"id":"tech_an_level","name_ru":"Уровень аммиачной селитры (AN) в бункере","severity":"normal"},
  {"id":"tech_water_4k","name_ru":"Уровень воды (исполнение 4К)","severity":"normal"},
  {"id":"tech_ggd_4k","name_ru":"Уровень ГГД (исполнение 4К)","severity":"normal"},
  {"id":"tech_auger","name_ru":"Шнек — визуальный осмотр","severity":"critical"},
  {"id":"tech_control","name_ru":"Пульт управления и САУ","severity":"critical"}
]');

-- ============================================================
-- ЕЖЕМЕСЯЧНЫЕ (monthly) — раз в 30 дней
-- По РЭ: совмещается с ежесменным, но добавляет смазку, контроль колец,
-- проверку датчиков, тарировку, чистку фильтров.
-- ============================================================

-- ------------------------------- МЗВ ежемесячное -------------------------------
insert into checklist_templates (machine_type, kind, items)
values ('МЗВ', 'monthly', '[
  {"id":"m_lubrication","name_ru":"Смазка подшипниковых опор донного шнека эмульсии, барабана, манипулятора (ЦИАТИМ-201/203)","severity":"critical"},
  {"id":"m_ceramic_rings","name_ru":"Контроль состояния керамических колец-уплотнений донного шнека эмульсии","severity":"critical"},
  {"id":"m_counter_screw","name_ru":"Проверка счётного узла донного шнека (без пропуска зубьев)","severity":"critical"},
  {"id":"m_pump_rpm","name_ru":"Проверка счёта оборотов всех насосов (сравнение с тахометром)","severity":"normal"},
  {"id":"m_calibration","name_ru":"Тарировка калибровочных коэффициентов","severity":"critical"},
  {"id":"m_pump_filters","name_ru":"Прочистка фильтров на всасывающих магистралях насосов ГГД, ПКД, ВОДЫ","severity":"normal"}
]');

-- ------------------------------- МСЗ ежемесячное -------------------------------
insert into checklist_templates (machine_type, kind, items)
values ('МСЗ', 'monthly', '[
  {"id":"m_lubrication","name_ru":"Смазка подшипниковых опор шнека питателя AN (ЦИАТИМ-201/203)","severity":"critical"},
  {"id":"m_fluoro_rings","name_ru":"Контроль фторопластовых колец-уплотнений шнека (зазор ≤ 0,2 мм)","severity":"critical"},
  {"id":"m_counter_screw","name_ru":"Проверка счётного узла шнека (без пропуска зубьев)","severity":"critical"},
  {"id":"m_pump_rpm","name_ru":"Проверка счёта оборотов насоса дизеля","severity":"normal"},
  {"id":"m_calibration","name_ru":"Тарировка калибровочных коэффициентов","severity":"critical"},
  {"id":"m_pump_filters","name_ru":"Прочистка сетчатых у-фильтров на всасывающих магистралях","severity":"normal"}
]');

-- ------------------------------- МСЗУ ежемесячное -------------------------------
insert into checklist_templates (machine_type, kind, items)
values ('МСЗУ', 'monthly', '[
  {"id":"m_lubrication","name_ru":"Смазка подшипниковых опор шнеков всех питателей (ЦИАТИМ-201/203)","severity":"critical"},
  {"id":"m_fluoro_rings","name_ru":"Контроль фторопластовых колец-уплотнений всех шнеков (зазор ≤ 0,2 мм)","severity":"critical"},
  {"id":"m_counter_screws","name_ru":"Проверка счётных узлов питателей (без пропуска зубьев)","severity":"critical"},
  {"id":"m_pump_rpm","name_ru":"Проверка счёта оборотов всех насосов","severity":"normal"},
  {"id":"m_calibration","name_ru":"Тарировка калибровочных коэффициентов","severity":"critical"},
  {"id":"m_pump_filters","name_ru":"Прочистка сетчатых у-фильтров на всасывающих магистралях, промывка ёмкостей","severity":"normal"}
]');

-- ------------------------------- МЗУ ежемесячное -------------------------------
insert into checklist_templates (machine_type, kind, items)
values ('МЗУ', 'monthly', '[
  {"id":"m_lubrication","name_ru":"Смазка подшипниковых опор бункера AN, питателей AN/EM, манипулятора, барабана (ЦИАТИМ-201/203)","severity":"critical"},
  {"id":"m_fluoro_rings","name_ru":"Контроль фторопластовых колец-уплотнений шнека AN (зазор ≤ 0,2 мм)","severity":"critical"},
  {"id":"m_feeder_seals","name_ru":"Проверка масляных уплотнений питателей AN и EM (подтяжка/долив)","severity":"normal"},
  {"id":"m_counter_screws","name_ru":"Проверка счётных узлов питателей (без пропуска зубьев)","severity":"critical"},
  {"id":"m_pump_rpm","name_ru":"Проверка счёта оборотов всех насосов","severity":"normal"},
  {"id":"m_calibration","name_ru":"Тарировка калибровочных коэффициентов","severity":"critical"},
  {"id":"m_pump_filters","name_ru":"Прочистка у-фильтров насосов ВОДЫ, ГГД-1, ГГД-2","severity":"normal"}
]');
