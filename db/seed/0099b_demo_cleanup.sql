-- 0099b — REMOVE demo data seeded by 0099_demo_data.sql.
-- Deletes only the three demo machines (Северная-1 / Карьер-2 / Запад-3) and
-- everything that hangs off them (shifts, tickets + messages, parts requests).
-- Does NOT touch any other machine (e.g. your own test machine with no
-- internal_name). Idempotent — safe to run if nothing is there.

do $$
declare
  v_ids uuid[];
begin
  select array_agg(id) into v_ids
  from public.machines
  where internal_name in ('Северная-1', 'Карьер-2', 'Запад-3');

  if v_ids is null then
    raise notice 'No demo machines found — nothing to remove.';
    return;
  end if;

  delete from public.shifts          where machine_id = any(v_ids);
  delete from public.tickets         where machine_id = any(v_ids); -- ticket_messages cascade
  delete from public.parts_requests  where machine_id = any(v_ids);
  delete from public.machines        where id = any(v_ids);

  raise notice 'Demo data removed: % machines and their shifts/tickets/requests.', array_length(v_ids, 1);
end $$;
