-- 0022 — periodic checklists per RE (ежесменный + ежемесячный)
--
-- НИПИГОРМАШ РЭ section 5.5 / 5.6 defines "ежесменное" (pre-shift) and
-- "ежемесячное" (monthly) maintenance checks separately. We already
-- have pre_shift; this migration adds 'monthly' to the enum and a
-- per-machine "last monthly check" timestamp so the shift wizard can
-- decide when to bolt the monthly section onto the pre-shift one.
--
-- Idempotent.

-- 1) Extend the checklist_kind enum.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'checklist_kind' and e.enumlabel = 'monthly'
  ) then
    alter type checklist_kind add value 'monthly';
  end if;
end$$;

-- 2) Track when each machine last had its monthly check.
alter table machines
  add column if not exists last_monthly_check_at timestamptz;

-- 3) When a monthly checklist execution is recorded, bump the machine's
--    last_monthly_check_at to the execution time. Latest wins.
create or replace function update_last_monthly_check_at()
returns trigger
language plpgsql
security definer
as $$
declare
  m_id uuid;
  k checklist_kind;
begin
  -- Resolve machine_id and kind from the parent shift.
  select s.machine_id, t.kind
    into m_id, k
  from shifts s
  join checklist_templates t on t.id = new.template_id
  where s.id = new.shift_id;

  if k = 'monthly' and m_id is not null then
    update machines
       set last_monthly_check_at = new.completed_at
     where id = m_id
       and (last_monthly_check_at is null
            or last_monthly_check_at < new.completed_at);
  end if;

  return new;
end$$;

drop trigger if exists trg_update_last_monthly_check on checklist_executions;
create trigger trg_update_last_monthly_check
  after insert or update on checklist_executions
  for each row
  execute function update_last_monthly_check_at();
