-- Seed: maintenance_schedules
-- Run after migration 0014_maintenance + seed/0002_parts_catalog
-- Source: CODE/maintenance_specs/<тип>/ТО для <тип>.docx
-- Safe to re-run (DELETE + INSERT pattern)
--
-- Pattern observed across all four machine types: ТО is triggered every
-- 2000 tons of explosive pumped. МСЗ/МСЗУ/МЗУ alternate ТО-1 and ТО-2,
-- so within one schedule for a single kind the cadence is 4000 tons.
-- МЗВ has only one ТО kind, cadence 2000 tons.
--
-- Each schedule embeds:
--   work_items: list of operations + hours_norm
--   parts_required: BOM by part_id, with display_name_ru duplicated
--                   for the operator-facing UI

-- Clean slate (idempotent re-runs)
delete from maintenance_schedules;

-- ============================================================
-- МЗВ — one ТО, every 2000 tons
-- ============================================================
insert into maintenance_schedules
  (machine_type, kind, interval_tons, alternates_with, work_items, total_hours_norm, parts_required)
select
  'МЗВ', 'TO', 2000, null,
  '[
    {"name_ru":"Замена напорного, сливного фильтров","hours_norm":2},
    {"name_ru":"Замена всасывающего фильтра","hours_norm":1},
    {"name_ru":"Замена воздушного фильтра (в заливной горловине)","hours_norm":2},
    {"name_ru":"Диагностика главного гидронасоса, настройка LS линии, давления ХХ","hours_norm":4},
    {"name_ru":"Регулировка максимального давления гидросистемы","hours_norm":1},
    {"name_ru":"Диагностика гидросистемы","hours_norm":6},
    {"name_ru":"Регулировка блоков управления гидрораспределителя","hours_norm":8},
    {"name_ru":"Диагностика гидромоторов всех потребителей","hours_norm":8},
    {"name_ru":"Замена сальниковых уплотнений шнека","hours_norm":6},
    {"name_ru":"Смазка опорных подшипников шнеков","hours_norm":1},
    {"name_ru":"Диагностика насосов NETZSCH","hours_norm":12},
    {"name_ru":"Обновление программного обеспечения МЗВ","hours_norm":4},
    {"name_ru":"Диагностика и калибровка работы системы управления (САУ)","hours_norm":6},
    {"name_ru":"Проверка технического состояния искрозащитного барьера","hours_norm":2},
    {"name_ru":"Диагностика модулей дискретного и аналогового ввода/вывода","hours_norm":10},
    {"name_ru":"Диагностика контроллера и CAN линии","hours_norm":4},
    {"name_ru":"Диагностика НПТ, проверка соответствия температуры","hours_norm":2},
    {"name_ru":"Диагностика датчиков загрязнённости фильтров","hours_norm":3},
    {"name_ru":"Диагностика датчиков оборотов потребителей","hours_norm":8},
    {"name_ru":"Калибровка датчиков давления и уровня","hours_norm":5},
    {"name_ru":"Диагностика выносного пульта","hours_norm":4},
    {"name_ru":"Диагностика и испытание электрооборудования","hours_norm":6},
    {"name_ru":"Калибровка оборотов потребителей","hours_norm":6},
    {"name_ru":"Испытание работы СЗМ в ручном режиме","hours_norm":6},
    {"name_ru":"Испытание работы СЗМ в автоматическом режиме","hours_norm":6},
    {"name_ru":"Калибровка компонентов ВВ","hours_norm":12},
    {"name_ru":"Калибровка сматывания рукава барабана при зарядке от устья скважины","hours_norm":2},
    {"name_ru":"Комплексная проверка оборудования на блоке","hours_norm":24}
  ]'::jsonb,
  160,
  -- МЗВ minimal kit not specified in DOCX; we keep a sensible baseline
  (select coalesce(jsonb_agg(jsonb_build_object(
            'part_id', pc.id,
            'display_name_ru', pc.display_name_ru,
            'quantity', q.quantity)), '[]'::jsonb)
   from (values
     ('081.02.117', 1)
   ) q(part_number, quantity)
   join parts_catalog pc on pc.part_number = q.part_number);

-- ============================================================
-- МСЗ — ТО-1 (alternates with ТО-2), every 2000 tons
-- ============================================================
insert into maintenance_schedules
  (machine_type, kind, interval_tons, alternates_with, work_items, total_hours_norm, parts_required)
select
  'МСЗ', 'TO-1', 2000, 'TO-2',
  '[
    {"name_ru":"Замена масла","hours_norm":4},
    {"name_ru":"Замена всасывающего фильтра","hours_norm":1},
    {"name_ru":"Чистка всасывающих фильтров баков","hours_norm":1},
    {"name_ru":"Замена фторопластовых уплотнений поворотного шнека","hours_norm":8},
    {"name_ru":"Замена фторопластовых уплотнений донного шнека","hours_norm":12},
    {"name_ru":"Замена сальниковой набивки шнека поворотного питателя","hours_norm":1},
    {"name_ru":"Проверка и смазка опорных подшипников шнеков","hours_norm":1},
    {"name_ru":"Диагностика и настройка датчиков оборотов","hours_norm":4},
    {"name_ru":"Диагностика и настройка гидравлического распределителя","hours_norm":2},
    {"name_ru":"Диагностика и калибровка датчиков давления","hours_norm":4},
    {"name_ru":"Диагностика и настройка САУ","hours_norm":8},
    {"name_ru":"Диагностика и программирование модулей ввода-вывода","hours_norm":4},
    {"name_ru":"Диагностика искрозащитного барьера","hours_norm":1},
    {"name_ru":"Проверка изоляции проводов и фиксации в клеммных коробках","hours_norm":3},
    {"name_ru":"Диагностика вентилятора гидросистемы","hours_norm":1},
    {"name_ru":"Диагностика датчика уровня ДТ","hours_norm":1},
    {"name_ru":"Обновление программного обеспечения","hours_norm":4},
    {"name_ru":"Настройка и проверка работы установки в ручном режиме","hours_norm":4},
    {"name_ru":"Настройка и проверка работы установки в автоматическом режиме","hours_norm":4},
    {"name_ru":"Калибровка компонентов","hours_norm":8},
    {"name_ru":"Комплексная проверка оборудования на блоке","hours_norm":28}
  ]'::jsonb,
  104,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'part_id', pc.id,
            'display_name_ru', pc.display_name_ru,
            'quantity', q.quantity)), '[]'::jsonb)
   from (values
     ('CU-100-M60', 1),
     ('СТ.САЛЬН.НАБ', 2),
     ('ISBAC2S8-31P-4-LZS4-H', 2),
     ('ISBAC12S-31P-1,5-LS4-H', 2),
     ('СТ16.03.301', 1),
     ('СТ16.03.302', 1),
     ('СТ10.04.005', 2),
     ('СТ10.04.012', 2),
     ('БИ-006', 1),
     ('SU-A1', 1)
   ) q(part_number, quantity)
   join parts_catalog pc on pc.part_number = q.part_number);

-- ============================================================
-- МСЗ — ТО-2, every 2000 tons (alternates with ТО-1)
-- ============================================================
insert into maintenance_schedules
  (machine_type, kind, interval_tons, alternates_with, work_items, total_hours_norm, parts_required)
select
  'МСЗ', 'TO-2', 2000, 'TO-1',
  '[
    {"name_ru":"Замена масла","hours_norm":4},
    {"name_ru":"Замена всасывающего, напорного и сливного фильтра","hours_norm":4},
    {"name_ru":"Чистка всасывающих фильтров баков","hours_norm":1},
    {"name_ru":"Замена фторопластовых уплотнений поворотного шнека","hours_norm":8},
    {"name_ru":"Замена фторопластовых уплотнений донного шнека","hours_norm":12},
    {"name_ru":"Замена сальниковой набивки шнека поворотного питателя","hours_norm":1},
    {"name_ru":"Проверка и смазка опорных подшипников шнеков","hours_norm":1},
    {"name_ru":"Диагностика и настройка датчиков оборотов","hours_norm":4},
    {"name_ru":"Диагностика и настройка гидравлического распределителя","hours_norm":2},
    {"name_ru":"Диагностика и калибровка датчиков давления","hours_norm":4},
    {"name_ru":"Диагностика и настройка САУ","hours_norm":8},
    {"name_ru":"Диагностика и программирование модулей ввода-вывода","hours_norm":4},
    {"name_ru":"Диагностика искрозащитного барьера","hours_norm":1},
    {"name_ru":"Проверка изоляции проводов и фиксации в клеммных коробках","hours_norm":3},
    {"name_ru":"Диагностика вентилятора гидросистемы","hours_norm":1},
    {"name_ru":"Диагностика датчика уровня ДТ","hours_norm":1},
    {"name_ru":"Обновление программного обеспечения","hours_norm":4},
    {"name_ru":"Диагностика приводов гидросистемы","hours_norm":3},
    {"name_ru":"Настройка оборотов шнеков и ограничение давления гидросистемы","hours_norm":5},
    {"name_ru":"Настройка и проверка работы установки в ручном режиме","hours_norm":4},
    {"name_ru":"Настройка и проверка работы установки в автоматическом режиме","hours_norm":4},
    {"name_ru":"Калибровка компонентов","hours_norm":8},
    {"name_ru":"Комплексная проверка оборудования на блоке","hours_norm":28}
  ]'::jsonb,
  115,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'part_id', pc.id,
            'display_name_ru', pc.display_name_ru,
            'quantity', q.quantity)), '[]'::jsonb)
   from (values
     ('CU-100-M60', 1),
     ('HP 135-2-А10-A-N-P01', 1),
     ('MPH 100-2-А25-А', 1),
     ('СТ.САЛЬН.НАБ', 2),
     ('ISBAC2S8-31P-4-LZS4-H', 2),
     ('ISBAC12S-31P-1,5-LS4-H', 2),
     ('081.02.117', 1),
     ('СТ16.03.301', 1),
     ('СТ16.03.302', 1),
     ('СТ10.04.005', 2),
     ('СТ10.04.012', 2),
     ('БИ-006', 1),
     ('SU-A1', 1)
   ) q(part_number, quantity)
   join parts_catalog pc on pc.part_number = q.part_number);

-- ============================================================
-- МСЗУ — ТО-1
-- ============================================================
insert into maintenance_schedules
  (machine_type, kind, interval_tons, alternates_with, work_items, total_hours_norm, parts_required)
select
  'МСЗУ', 'TO-1', 2000, 'TO-2',
  '[
    {"name_ru":"Замена масла, промывка системы","hours_norm":3},
    {"name_ru":"Замена всасывающего фильтра / воздушного фильтра в горловине","hours_norm":1},
    {"name_ru":"Регулировка максимального давления гидросистемы","hours_norm":1},
    {"name_ru":"Диагностика гидросистемы","hours_norm":6},
    {"name_ru":"Регулировка блоков управления гидрораспределителя","hours_norm":6},
    {"name_ru":"Замена сальниковых уплотнений шнеков","hours_norm":16},
    {"name_ru":"Замена фторопластовых уплотнений шнеков","hours_norm":14},
    {"name_ru":"Смазка опорных подшипников шнеков","hours_norm":1},
    {"name_ru":"Диагностика системы технологического подогрева (ПЖД)","hours_norm":1},
    {"name_ru":"Диагностика насосов NETZSCH","hours_norm":6},
    {"name_ru":"Обновление программного обеспечения МСЗУ","hours_norm":2},
    {"name_ru":"Диагностика и калибровка работы системы управления (САУ)","hours_norm":10},
    {"name_ru":"Проверка технического состояния искрозащитного барьера","hours_norm":2},
    {"name_ru":"Диагностика модулей дискретного и аналогового ввода/вывода","hours_norm":10},
    {"name_ru":"Диагностика НПТ, проверка соответствия температуры","hours_norm":2},
    {"name_ru":"Диагностика датчиков загрязнённости фильтров","hours_norm":3},
    {"name_ru":"Диагностика датчиков оборотов и счётных узлов","hours_norm":8},
    {"name_ru":"Диагностика контроллера САУ","hours_norm":6},
    {"name_ru":"Диагностика выносного пульта","hours_norm":1},
    {"name_ru":"Диагностика и испытание электрооборудования","hours_norm":1},
    {"name_ru":"Калибровка оборотов потребителей","hours_norm":4},
    {"name_ru":"Испытание работы СЗМ в ручном режиме","hours_norm":6},
    {"name_ru":"Испытание работы СЗМ в автоматическом режиме","hours_norm":12},
    {"name_ru":"Калибровка компонентов ВВ","hours_norm":12},
    {"name_ru":"Комплексная проверка оборудования на блоке","hours_norm":24}
  ]'::jsonb,
  158,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'part_id', pc.id,
            'display_name_ru', pc.display_name_ru,
            'quantity', q.quantity)), '[]'::jsonb)
   from (values
     ('HE K45-30.210-AS-MP090', 2),
     ('СТ16.03.301', 1),
     ('СТ16.03.302', 1),
     ('СТ10.04.005', 1),
     ('СТ10.04.012', 2),
     ('СТ24.04.005', 1),
     ('СТ33.05.232', 2),
     ('СТ33.05.233', 1),
     ('СТ.САЛЬН.НАБ', 2),
     ('ISBAC12S-31P-1,5-LS4-H', 2),
     ('ISBAC2S8-31P-4-LZS4-H', 2),
     ('I-7084', 1),
     ('БИ-006', 1)
   ) q(part_number, quantity)
   join parts_catalog pc on pc.part_number = q.part_number);

-- ============================================================
-- МСЗУ — ТО-2
-- ============================================================
insert into maintenance_schedules
  (machine_type, kind, interval_tons, alternates_with, work_items, total_hours_norm, parts_required)
select
  'МСЗУ', 'TO-2', 2000, 'TO-1',
  '[
    {"name_ru":"Замена масла, промывка системы","hours_norm":3},
    {"name_ru":"Замена напорного, сливного фильтров","hours_norm":1},
    {"name_ru":"Замена всасывающего фильтра / воздушного в горловине","hours_norm":1},
    {"name_ru":"Диагностика главного гидронасоса, настройка LS линии","hours_norm":3},
    {"name_ru":"Регулировка максимального давления гидросистемы","hours_norm":1},
    {"name_ru":"Диагностика гидросистемы","hours_norm":6},
    {"name_ru":"Регулировка блоков управления гидрораспределителя","hours_norm":6},
    {"name_ru":"Диагностика гидромоторов всех потребителей","hours_norm":2},
    {"name_ru":"Замена сальниковых уплотнений шнеков","hours_norm":16},
    {"name_ru":"Замена фторопластовых уплотнений шнеков","hours_norm":14},
    {"name_ru":"Смазка опорных подшипников шнеков","hours_norm":1},
    {"name_ru":"Диагностика системы технологического подогрева (ПЖД)","hours_norm":1},
    {"name_ru":"Диагностика насосов NETZSCH","hours_norm":6},
    {"name_ru":"Обновление программного обеспечения МСЗУ","hours_norm":2},
    {"name_ru":"Диагностика и калибровка работы системы управления (САУ)","hours_norm":10},
    {"name_ru":"Проверка технического состояния искрозащитного барьера","hours_norm":2},
    {"name_ru":"Диагностика модулей дискретного и аналогового ввода/вывода","hours_norm":10},
    {"name_ru":"Диагностика НПТ, проверка соответствия температуры","hours_norm":2},
    {"name_ru":"Диагностика датчиков загрязнённости фильтров","hours_norm":3},
    {"name_ru":"Диагностика датчиков оборотов и счётных узлов","hours_norm":8},
    {"name_ru":"Диагностика контроллера САУ","hours_norm":6},
    {"name_ru":"Диагностика выносного пульта","hours_norm":1},
    {"name_ru":"Диагностика и испытание электрооборудования","hours_norm":1},
    {"name_ru":"Калибровка оборотов потребителей","hours_norm":4},
    {"name_ru":"Испытание работы СЗМ в ручном режиме","hours_norm":6},
    {"name_ru":"Испытание работы СЗМ в автоматическом режиме","hours_norm":12},
    {"name_ru":"Калибровка компонентов ВВ","hours_norm":12},
    {"name_ru":"Калибровка сматывания рукава барабана","hours_norm":2},
    {"name_ru":"Комплексная проверка оборудования на блоке","hours_norm":24}
  ]'::jsonb,
  166,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'part_id', pc.id,
            'display_name_ru', pc.display_name_ru,
            'quantity', q.quantity)), '[]'::jsonb)
   from (values
     ('081.02.117', 1),
     ('MPH 100-4-А25-А', 1),
     ('HP 135-2-А10-A-N-P01', 2),
     ('HE K45-30.210-AS-MP090', 2),
     ('СТ16.03.301', 1),
     ('СТ16.03.302', 1),
     ('СТ10.04.005', 1),
     ('СТ10.04.012', 2),
     ('СТ24.04.005', 1),
     ('СТ33.05.232', 2),
     ('СТ33.05.233', 1),
     ('СТ.САЛЬН.НАБ', 2),
     ('ISBAC12S-31P-1,5-LS4-H', 2),
     ('ISBAC2S8-31P-4-LZS4-H', 2),
     ('I-7084', 1),
     ('БИ-006', 1),
     ('M-7067D', 1)
   ) q(part_number, quantity)
   join parts_catalog pc on pc.part_number = q.part_number);

-- ============================================================
-- МЗУ — ТО-1
-- ============================================================
insert into maintenance_schedules
  (machine_type, kind, interval_tons, alternates_with, work_items, total_hours_norm, parts_required)
select
  'МЗУ', 'TO-1', 2000, 'TO-2',
  '[
    {"name_ru":"Замена масла, промывка системы","hours_norm":3},
    {"name_ru":"Замена всасывающего / воздушного фильтра","hours_norm":1},
    {"name_ru":"Регулировка максимального давления гидросистемы","hours_norm":1},
    {"name_ru":"Диагностика гидросистемы","hours_norm":6},
    {"name_ru":"Регулировка блоков управления гидрораспределителя","hours_norm":6},
    {"name_ru":"Замена сальниковых уплотнений шнеков","hours_norm":16},
    {"name_ru":"Замена фторопластовых уплотнений шнеков","hours_norm":14},
    {"name_ru":"Смазка опорных подшипников шнеков","hours_norm":1},
    {"name_ru":"Диагностика системы технологического подогрева (ПЖД)","hours_norm":1},
    {"name_ru":"Диагностика насосов NETZSCH","hours_norm":6},
    {"name_ru":"Обновление программного обеспечения МЗУ","hours_norm":2},
    {"name_ru":"Диагностика и калибровка САУ","hours_norm":10},
    {"name_ru":"Проверка искрозащитного барьера","hours_norm":2},
    {"name_ru":"Диагностика модулей ввода/вывода","hours_norm":10},
    {"name_ru":"Диагностика НПТ","hours_norm":2},
    {"name_ru":"Диагностика датчиков загрязнённости фильтров","hours_norm":3},
    {"name_ru":"Диагностика датчиков оборотов","hours_norm":8},
    {"name_ru":"Диагностика контроллера САУ","hours_norm":6},
    {"name_ru":"Диагностика выносного пульта","hours_norm":1},
    {"name_ru":"Диагностика электрооборудования","hours_norm":1},
    {"name_ru":"Калибровка оборотов потребителей","hours_norm":4},
    {"name_ru":"Испытание работы МЗУ в ручном режиме","hours_norm":6},
    {"name_ru":"Испытание работы МЗУ в автоматическом режиме","hours_norm":12},
    {"name_ru":"Калибровка компонентов ВВ","hours_norm":12},
    {"name_ru":"Комплексная проверка оборудования на блоке","hours_norm":24}
  ]'::jsonb,
  158,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'part_id', pc.id,
            'display_name_ru', pc.display_name_ru,
            'quantity', q.quantity)), '[]'::jsonb)
   from (values
     ('CU-250-M60', 1),
     ('СТ09.02.202-01', 2),
     ('СТ24.04.005', 2),
     ('СТ10.04.005', 1),
     ('СТ10.04.012', 1),
     ('СТ.САЛЬН.НАБ', 2),
     ('ISBAC12S-31P-1,5-LS4-H', 2),
     ('ISBAC2S8-31P-4-LZS4-H', 2),
     ('I-7084', 1),
     ('БИ-006', 1)
   ) q(part_number, quantity)
   join parts_catalog pc on pc.part_number = q.part_number);

-- ============================================================
-- МЗУ — ТО-2
-- ============================================================
insert into maintenance_schedules
  (machine_type, kind, interval_tons, alternates_with, work_items, total_hours_norm, parts_required)
select
  'МЗУ', 'TO-2', 2000, 'TO-1',
  '[
    {"name_ru":"Замена масла, промывка системы","hours_norm":3},
    {"name_ru":"Замена напорного, сливного фильтров","hours_norm":1},
    {"name_ru":"Замена всасывающего / воздушного фильтра","hours_norm":1},
    {"name_ru":"Диагностика главного гидронасоса, настройка LS линии","hours_norm":3},
    {"name_ru":"Регулировка максимального давления гидросистемы","hours_norm":1},
    {"name_ru":"Диагностика гидросистемы","hours_norm":6},
    {"name_ru":"Регулировка блоков управления гидрораспределителя","hours_norm":6},
    {"name_ru":"Диагностика гидромоторов","hours_norm":2},
    {"name_ru":"Замена сальниковых уплотнений шнеков","hours_norm":16},
    {"name_ru":"Замена фторопластовых уплотнений шнеков","hours_norm":14},
    {"name_ru":"Смазка опорных подшипников шнеков","hours_norm":1},
    {"name_ru":"Диагностика системы технологического подогрева (ПЖД)","hours_norm":1},
    {"name_ru":"Диагностика насосов NETZSCH","hours_norm":6},
    {"name_ru":"Обновление программного обеспечения МЗУ","hours_norm":2},
    {"name_ru":"Диагностика и калибровка САУ","hours_norm":10},
    {"name_ru":"Проверка искрозащитного барьера","hours_norm":2},
    {"name_ru":"Диагностика модулей ввода/вывода","hours_norm":10},
    {"name_ru":"Диагностика НПТ","hours_norm":2},
    {"name_ru":"Диагностика датчиков загрязнённости фильтров","hours_norm":3},
    {"name_ru":"Диагностика датчиков оборотов","hours_norm":8},
    {"name_ru":"Диагностика контроллера САУ","hours_norm":6},
    {"name_ru":"Диагностика выносного пульта","hours_norm":1},
    {"name_ru":"Диагностика электрооборудования","hours_norm":1},
    {"name_ru":"Калибровка оборотов потребителей","hours_norm":4},
    {"name_ru":"Испытание работы МЗУ в ручном режиме","hours_norm":6},
    {"name_ru":"Испытание работы МЗУ в автоматическом режиме","hours_norm":12},
    {"name_ru":"Калибровка компонентов ВВ","hours_norm":12},
    {"name_ru":"Калибровка сматывания рукава барабана","hours_norm":2},
    {"name_ru":"Комплексная проверка оборудования на блоке","hours_norm":24}
  ]'::jsonb,
  166,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'part_id', pc.id,
            'display_name_ru', pc.display_name_ru,
            'quantity', q.quantity)), '[]'::jsonb)
   from (values
     ('081.02.117', 1),
     ('MPH 100-4-А25-А', 1),
     ('HP 135-2-А10-A-N-P01', 2),
     ('CU-250-M60', 1),
     ('СТ09.02.202-01', 2),
     ('СТ24.04.005', 2),
     ('СТ10.04.005', 1),
     ('СТ10.04.012', 2),
     ('СТ.САЛЬН.НАБ', 2),
     ('ISBAC12S-31P-1,5-LS4-H', 2),
     ('ISBAC2S8-31P-4-LZS4-H', 2),
     ('I-7084', 1),
     ('БИ-006', 1),
     ('M-7067D', 1)
   ) q(part_number, quantity)
   join parts_catalog pc on pc.part_number = q.part_number);
