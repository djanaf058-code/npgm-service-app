-- 0038 — second recipe per shift (mixed shifts).
-- Per pilot feedback (2026-05-21): in one shift some holes get 100% emulsion
-- and others get 70/30 blend. We don't model individual holes yet — we just
-- store an optional "recipe B" + how many holes use it. The remaining holes
-- (plan_holes - plan_recipe_b_holes) use the primary plan_recipe.
-- Tons accounting stays on the primary recipe for now; precise per-hole tons
-- can be added later if customers ask.
-- Safe to re-run.

alter table public.shifts
  add column if not exists plan_recipe_b        charging_recipe,
  add column if not exists plan_recipe_b_holes  integer,
  add column if not exists actual_recipe_b      charging_recipe,
  add column if not exists actual_recipe_b_holes integer;

-- Defence-in-depth: recipe_b_holes must not exceed plan_holes (when both set).
alter table public.shifts
  drop constraint if exists shifts_plan_recipe_b_holes_within_total;
alter table public.shifts
  add constraint shifts_plan_recipe_b_holes_within_total
  check (
    plan_recipe_b_holes is null
    or plan_holes is null
    or plan_recipe_b_holes <= plan_holes
  );
