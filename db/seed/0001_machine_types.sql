-- Seed: machine_types
-- Run after migration 0001_init
-- Safe to re-run (uses ON CONFLICT)

insert into machine_types (id, name_ru, name_en, description, recipe_modes) values
  (
    'МЗВ',
    'Машина зарядная эмульсионная',
    'Emulsion charging unit',
    'Заряжает 100% эмульсию. Однокомпонентная (только эмульсия).',
    array['EMULSION']
  ),
  (
    'МСЗ',
    'Машина смесительно-зарядная (сухогруз)',
    'ANFO charging unit (dry mix)',
    'Заряжает 100% ANFO (аммиачная селитра + дизельное топливо). Двухкомпонентная.',
    array['ANFO']
  ),
  (
    'МСЗУ',
    'Машина смесительно-зарядная универсальная',
    'Universal mixing-and-charging unit',
    'Универсал: 100% ANFO, смесевой 70/30 (70% эмульсии + 30% AS), 100% эмульсия.',
    array['ANFO', 'BLEND_70_30', 'EMULSION']
  ),
  (
    'МЗУ',
    'Машина зарядная универсальная (смесевая 70/30)',
    'Blend charging unit (70/30 mix)',
    'Смесевой рецепт 70/30 (70% эмульсии + 30% аммиачной селитры). При исполнении 4К — 4 компонента: AS, эмульсия, вода, ГГД (SN или Acetic Acid).',
    array['BLEND_70_30']
  )
on conflict (id) do update set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  description = excluded.description,
  recipe_modes = excluded.recipe_modes;
