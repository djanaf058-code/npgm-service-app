-- 0020 — split blend tonnages into emulsion + AN (ammonium nitrate) components
--
-- Why: МЗУ / МСЗУ work with blends (70/30 or 30/70). Operators load
-- emulsion and AN into separate tanks/bunkers, so the plan and the
-- actuals must record both components independently — single
-- plan_tons / actual_tons doesn't reflect the real consumption.
--
-- For pure recipes (ANFO, EMULSION) only the existing plan_tons /
-- actual_tons are used. For OTHER, the operator can use whichever.
-- Idempotent.

alter table shifts
  add column if not exists plan_emulsion_tons   numeric(10,3),
  add column if not exists plan_an_tons         numeric(10,3),
  add column if not exists actual_emulsion_tons numeric(10,3),
  add column if not exists actual_an_tons       numeric(10,3);

-- Sanity: components must be non-negative when set.
alter table shifts
  drop constraint if exists shifts_plan_emulsion_tons_nonneg,
  drop constraint if exists shifts_plan_an_tons_nonneg,
  drop constraint if exists shifts_actual_emulsion_tons_nonneg,
  drop constraint if exists shifts_actual_an_tons_nonneg;

alter table shifts
  add constraint shifts_plan_emulsion_tons_nonneg
    check (plan_emulsion_tons is null or plan_emulsion_tons >= 0),
  add constraint shifts_plan_an_tons_nonneg
    check (plan_an_tons is null or plan_an_tons >= 0),
  add constraint shifts_actual_emulsion_tons_nonneg
    check (actual_emulsion_tons is null or actual_emulsion_tons >= 0),
  add constraint shifts_actual_an_tons_nonneg
    check (actual_an_tons is null or actual_an_tons >= 0);
