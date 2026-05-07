-- Seed: parts_catalog
-- Run after migration 0013_parts
-- Source: CODE/maintenance_specs/<тип>/ТО для <тип>.docx
-- Safe to re-run (uses ON CONFLICT)
--
-- Two-tier naming (per user's design 2026-05-07):
--   - display_name_ru / display_name_en — friendly, shown to operators
--   - part_number — full artikul, only shown in admin / Tier 2 views
--   - application_ru / application_en — "где используется", helps operator
--     pick the right part without knowing the artikul

insert into parts_catalog
  (display_name_ru, display_name_en, category, application_ru, application_en,
   manufacturer, part_number, unit, compatible_machine_types)
values

-- ============================================================
-- ФИЛЬТРЫ (filter category)
-- ============================================================

  ('Воздушный фильтр (заливная горловина)',
   'Air filter (filler neck)',
   'filter',
   'В заливной горловине бака гидросистемы',
   'On the hydraulic tank filler neck',
   'НИПИГОРМАШ', '081.02.117', 'pcs', '{МЗВ,МСЗ,МСЗУ,МЗУ}'),

  ('Всасывающий фильтр CU-100',
   'Suction filter CU-100',
   'filter',
   'На входе в гидронасос (для МСЗ)',
   'Hydraulic pump suction (МСЗ)',
   'НИПИГОРМАШ', 'CU-100-M60', 'pcs', '{МСЗ}'),

  ('Всасывающий фильтр CU-250',
   'Suction filter CU-250',
   'filter',
   'На входе в гидронасос (для МЗУ)',
   'Hydraulic pump suction (МЗУ)',
   'НИПИГОРМАШ', 'CU-250-M60', 'pcs', '{МЗУ}'),

  ('Всасывающий фильтр (для МСЗУ)',
   'Suction filter (МСЗУ)',
   'filter',
   'На входе в гидронасос (для МСЗУ)',
   'Hydraulic pump suction (МСЗУ)',
   'MP Filtri', 'HE K45-30.210-AS-MP090', 'pcs', '{МСЗУ}'),

  ('Напорный фильтр гидросистемы',
   'Hydraulic pressure filter',
   'filter',
   'На напорной линии гидросистемы',
   'Hydraulic pressure line',
   'MP Filtri', 'HP 135-2-А10-A-N-P01', 'pcs', '{МСЗ,МСЗУ,МЗУ}'),

  ('Сливной фильтр гидросистемы (МСЗ)',
   'Hydraulic return filter (МСЗ)',
   'filter',
   'На сливной линии гидросистемы (для МСЗ)',
   'Hydraulic return line (МСЗ)',
   'MP Filtri', 'MPH 100-2-А25-А', 'pcs', '{МСЗ}'),

  ('Сливной фильтр гидросистемы (МСЗУ/МЗУ)',
   'Hydraulic return filter (МСЗУ/МЗУ)',
   'filter',
   'На сливной линии гидросистемы (для МСЗУ и МЗУ)',
   'Hydraulic return line (МСЗУ/МЗУ)',
   'MP Filtri', 'MPH 100-4-А25-А', 'pcs', '{МСЗУ,МЗУ}'),

-- ============================================================
-- УПЛОТНЕНИЯ И КОЛЬЦА (seal category)
-- ============================================================

  ('Сальниковая набивка', 'Gland packing', 'seal',
   'Уплотнение шнека поворотного питателя',
   'Auger feeder seal',
   'НИПИГОРМАШ', 'СТ.САЛЬН.НАБ', 'm', '{МЗВ,МСЗ,МСЗУ,МЗУ}'),

  ('Кольцо уплотнительное СТ16.03.301',
   'Sealing ring СТ16.03.301',
   'seal',
   'Уплотнение в гидрораспределителе',
   'Hydraulic distributor seal',
   'НИПИГОРМАШ', 'СТ16.03.301', 'pcs', '{МСЗ,МСЗУ,МЗУ}'),

  ('Кольцо уплотнительное СТ16.03.302',
   'Sealing ring СТ16.03.302',
   'seal',
   'Уплотнение в гидрораспределителе',
   'Hydraulic distributor seal',
   'НИПИГОРМАШ', 'СТ16.03.302', 'pcs', '{МСЗ,МСЗУ}'),

  ('Кольцо уплотнительное СТ10.04.005',
   'Sealing ring СТ10.04.005',
   'seal',
   'Уплотнение шнека / насосной группы',
   'Auger / pump seal',
   'НИПИГОРМАШ', 'СТ10.04.005', 'pcs', '{МСЗ,МСЗУ,МЗУ}'),

  ('Кольцо уплотнительное СТ10.04.012',
   'Sealing ring СТ10.04.012',
   'seal',
   'Уплотнение шнека / насосной группы',
   'Auger / pump seal',
   'НИПИГОРМАШ', 'СТ10.04.012', 'pcs', '{МСЗ,МСЗУ,МЗУ}'),

  ('Кольцо уплотнительное СТ24.04.005',
   'Sealing ring СТ24.04.005',
   'seal',
   'Уплотнение в насосной группе',
   'Pump assembly seal',
   'НИПИГОРМАШ', 'СТ24.04.005', 'pcs', '{МСЗУ,МЗУ}'),

  ('Кольцо уплотнительное СТ09.02.202-01',
   'Sealing ring СТ09.02.202-01',
   'seal',
   'Уплотнение шнека / питателя (для МЗУ)',
   'Auger seal (МЗУ)',
   'НИПИГОРМАШ', 'СТ09.02.202-01', 'pcs', '{МЗУ}'),

  ('Уплотнение шнека СТ33.05.232',
   'Auger seal СТ33.05.232',
   'seal',
   'Уплотнение шнека (для МСЗУ)',
   'Auger seal (МСЗУ)',
   'НИПИГОРМАШ', 'СТ33.05.232', 'pcs', '{МСЗУ}'),

  ('Уплотнение шнека СТ33.05.233',
   'Auger seal СТ33.05.233',
   'seal',
   'Уплотнение шнека (для МСЗУ)',
   'Auger seal (МСЗУ)',
   'НИПИГОРМАШ', 'СТ33.05.233', 'pcs', '{МСЗУ}'),

-- ============================================================
-- ДАТЧИКИ (sensor category)
-- ============================================================

  ('Датчик индуктивный TEKO ISBAC2S8',
   'Inductive sensor TEKO ISBAC2S8',
   'sensor',
   'Контроль оборотов / счётные узлы',
   'Speed / counting sensors',
   'TEKO', 'ISBAC2S8-31P-4-LZS4-H', 'pcs', '{МСЗ,МСЗУ,МЗУ}'),

  ('Датчик индуктивный TEKO ISBAC12S',
   'Inductive sensor TEKO ISBAC12S',
   'sensor',
   'Контроль оборотов / счётные узлы',
   'Speed / counting sensors',
   'TEKO', 'ISBAC12S-31P-1,5-LS4-H', 'pcs', '{МСЗ,МСЗУ,МЗУ}'),

-- ============================================================
-- МОДУЛИ И БАРЬЕРЫ (module category)
-- ============================================================

  ('Барьер искрозащиты БИ-006',
   'Spark protection barrier БИ-006',
   'module',
   'Искрозащитный барьер цепей управления',
   'Control circuits spark protection',
   'НИПИГОРМАШ', 'БИ-006', 'pcs', '{МЗВ,МСЗ,МСЗУ,МЗУ}'),

  ('Усилитель сигнала SU-A1',
   'Signal amplifier SU-A1',
   'module',
   'Усилитель в цепи датчиков (для МСЗ)',
   'Sensor signal amplifier (МСЗ)',
   'НИПИГОРМАШ', 'SU-A1', 'pcs', '{МСЗ}'),

  ('Модуль ввода-вывода ICP DAS 7084',
   'I/O module ICP DAS 7084',
   'module',
   'Модуль системы автоматического управления (САУ)',
   'SCADA / control module',
   'ICP DAS', 'I-7084', 'pcs', '{МСЗУ,МЗУ}'),

  ('Модуль ввода-вывода ICP DAS M-7067D',
   'I/O module ICP DAS M-7067D',
   'module',
   'Модуль системы автоматического управления (САУ)',
   'SCADA / control module',
   'ICP DAS', 'M-7067D', 'pcs', '{МСЗУ,МЗУ}'),

-- ============================================================
-- РАСХОДНИКИ (consumable category)
-- ============================================================

  ('Гидравлическое масло',
   'Hydraulic oil',
   'consumable',
   'Замена при ТО (объём по регламенту машины)',
   'Hydraulic oil for periodic refill',
   'НИПИГОРМАШ', 'OIL-HYD-GENERIC', 'l', '{МЗВ,МСЗ,МСЗУ,МЗУ}'),

-- ============================================================
-- НАСОСЫ И УЗЛЫ (pump_part — non-routine, used on ремонте по диагностике)
-- Names placeholder — actual NETZSCH catalogue numbers will be filled
-- in when we cross-reference manuals/<тип>/*.pdf in a follow-up pass.
-- ============================================================

  ('Статор насоса NETZSCH (диагностика)',
   'NETZSCH pump stator (diagnostic replacement)',
   'pump_part',
   'Меняется при выявлении износа в ходе диагностики насоса',
   'Replaced when wear is detected during pump diagnostics',
   'NETZSCH', 'STATOR-PLACEHOLDER', 'pcs', '{МЗВ,МСЗУ,МЗУ}'),

  ('Ротор насоса NETZSCH (диагностика)',
   'NETZSCH pump rotor (diagnostic replacement)',
   'pump_part',
   'Меняется при выявлении износа в ходе диагностики насоса',
   'Replaced when wear is detected during pump diagnostics',
   'NETZSCH', 'ROTOR-PLACEHOLDER', 'pcs', '{МЗВ,МСЗУ,МЗУ}')

on conflict (manufacturer, part_number) do update set
  display_name_ru = excluded.display_name_ru,
  display_name_en = excluded.display_name_en,
  category = excluded.category,
  application_ru = excluded.application_ru,
  application_en = excluded.application_en,
  unit = excluded.unit,
  compatible_machine_types = excluded.compatible_machine_types;
