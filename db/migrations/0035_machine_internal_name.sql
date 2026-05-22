-- 0035 — Internal company name/number for machines
--
-- Customers don't refer to machines by factory serial — they have their own
-- naming: "Северная-3", "Машина 2 на Pit B", "Малыш" и т.п.
-- serial_number stays for warranty / NIPIGORMASH side; internal_name is what
-- operators / dispatchers actually call the machine.
--
-- Idempotent. Apply after 0034.

alter table public.machines
  add column if not exists internal_name text;

comment on column public.machines.internal_name is
  'Customer-side identifier — what the operator/dispatcher calls this machine. Independent of factory serial_number.';
