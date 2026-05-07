-- 0021 — diesel component for ANFO-bearing machines (МСЗ, МСЗУ)
--
-- Why: ANFO is ~95% ammonium nitrate + ~5% diesel fuel. Diesel is
-- loaded into a separate tank, so for МСЗ (pure ANFO) and МСЗУ
-- (universal — can carry diesel for the AN portion) we have to
-- record diesel consumption alongside emulsion / AN.
--
-- МЗВ (pure emulsion) and МЗУ (emulsion + AN, no fuel oil) do not
-- use diesel — leave the column null for those.
-- Idempotent.

alter table shifts
  add column if not exists plan_diesel_tons   numeric(10,3),
  add column if not exists actual_diesel_tons numeric(10,3);

alter table shifts
  drop constraint if exists shifts_plan_diesel_tons_nonneg,
  drop constraint if exists shifts_actual_diesel_tons_nonneg;

alter table shifts
  add constraint shifts_plan_diesel_tons_nonneg
    check (plan_diesel_tons is null or plan_diesel_tons >= 0),
  add constraint shifts_actual_diesel_tons_nonneg
    check (actual_diesel_tons is null or actual_diesel_tons >= 0);
