-- 0099 — DEMO DATA for the pilot test.
-- Seeds one company with 3 machines, ~14 completed shifts (with actual tonnage),
-- 2 tickets (1 resolved + 1 open) and 1 parts request, so the forecast,
-- filters, summary and AI-history screens have realistic content to show.
--
-- Idempotent: re-running does nothing if the demo machines already exist.
-- Targets the first company that has a non-admin member; override v_company
-- below if you want a specific company.
--
-- tons_pumped is set explicitly (the auto-increment trigger fires only on
-- shift UPDATE→completed, not on INSERT-as-completed, so there is no double
-- counting). Tonnage is tuned so the three machines show three forecast
-- states: due-soon / overdue / healthy.

do $$
declare
  v_company uuid;
  v_ops     uuid[];
  v_op1 uuid; v_op2 uuid; v_op3 uuid;
  v_m1 uuid; v_m2 uuid; v_m3 uuid;
  v_t1 uuid; v_t2 uuid;
  i int;
begin
  -- Target company: first one with a real (non-platform-admin) member.
  select p.company_id into v_company
  from public.profiles p
  where p.company_id is not null
    and p.role in ('operator','service_engineer','project_manager','company_admin')
  order by p.created_at
  limit 1;
  if v_company is null then
    select id into v_company from public.companies order by created_at limit 1;
  end if;
  if v_company is null then
    raise notice 'No company found — register a company first, then re-run.';
    return;
  end if;

  -- Operators = any profiles in that company (cycle through them for variety).
  select array_agg(id order by created_at) into v_ops
  from public.profiles where company_id = v_company;
  v_op1 := v_ops[1];
  v_op2 := coalesce(v_ops[2], v_op1);
  v_op3 := coalesce(v_ops[3], v_op1);
  if v_op1 is null then
    raise notice 'Company % has no profiles.', v_company;
    return;
  end if;

  -- Idempotency guard.
  if exists (
    select 1 from public.machines
    where company_id = v_company and model_code = 'MZU-16-4K' and internal_name = 'Северная-1'
  ) then
    raise notice 'Demo data already present for company %. Nothing to do.', v_company;
    return;
  end if;

  -- ---- Machines (tuned forecast states) ----
  -- МЗУ 1840t → next service at 2000t, ~160t left → DUE SOON
  insert into public.machines
    (company_id, machine_type, model_code, tonnage_t, internal_name, tons_pumped, engine_hours, in_service_since, status)
  values
    (v_company,'МЗУ','MZU-16-4K',16,'Северная-1',1840,560,'2025-01-10','active')
  returning id into v_m1;

  -- МСЗ 3120t → crossed the 2000t threshold with no service logged → OVERDUE
  insert into public.machines
    (company_id, machine_type, model_code, tonnage_t, internal_name, tons_pumped, engine_hours, in_service_since, status)
  values
    (v_company,'МСЗ','MSZ-15',15,'Карьер-2',3120,980,'2024-11-05','active')
  returning id into v_m2;

  -- МСЗУ 760t → far from first service → HEALTHY
  insert into public.machines
    (company_id, machine_type, model_code, tonnage_t, internal_name, tons_pumped, engine_hours, in_service_since, status)
  values
    (v_company,'МСЗУ','MSZU-25',25,'Запад-3',760,240,'2025-04-01','active')
  returning id into v_m3;

  -- ---- 14 completed shifts over the last ~8 weeks ----
  for i in 0..13 loop
    insert into public.shifts
      (company_id, machine_id, operator_id, status, planned_for, started_at, completed_at,
       plan_recipe, plan_tons, plan_emulsion_tons, plan_holes, plan_pit_location,
       actual_tons, actual_emulsion_tons, actual_engine_hours)
    values (
      v_company,
      (array[v_m1, v_m2, v_m3])[1 + (i % 3)],
      (array[v_op1, v_op2, v_op3])[1 + (i % 3)],
      'completed',
      (current_date - (i * 4))::date,
      (current_date - (i * 4))::timestamp + interval '7 hours',
      (current_date - (i * 4))::timestamp + interval '15 hours',
      'EMULSION',
      10 + (i % 5) * 2,
      10 + (i % 5) * 2,
      24 + (i % 6),
      'Block ' || chr(65 + (i % 3)) || ', Pit ' || (1 + (i % 2)),
      9 + (i % 5) * 2,
      9 + (i % 5) * 2,
      7 + (i % 3)
    );
  end loop;

  -- ---- Tickets ----
  insert into public.tickets
    (company_id, machine_id, operator_id, status, priority, title, resolution_summary, resolved_at, created_at)
  values
    (v_company, v_m1, v_op1, 'resolved', 2, 'Течь масла в гидросистеме',
     'Заменили уплотнение НК-25 (арт. 4711-22), течь устранена. ~40 мин, 1 человек.',
     now() - interval '3 days', now() - interval '5 days')
  returning id into v_t1;
  insert into public.ticket_messages (ticket_id, sender_type, sender_id, text, created_at) values
    (v_t1, 'operator', v_op1, 'Подтекает масло у гидрораспределителя, лужа под машиной за смену.', now() - interval '5 days'),
    (v_t1, 'ai', null, 'Заглушите машину и сбросьте давление в системе. Чаще всего это уплотнение НК-25 на линии высокого давления у распределителя — осмотрите его на трещины и подтёки. Если повреждено — замена решает.', now() - interval '5 days' + interval '40 minutes');

  insert into public.tickets
    (company_id, machine_id, operator_id, status, priority, title, created_at)
  values
    (v_company, v_m2, v_op2, 'new', 3, 'Насос не выходит на режим', now() - interval '20 hours')
  returning id into v_t2;
  insert into public.ticket_messages (ticket_id, sender_type, sender_id, text, created_at) values
    (v_t2, 'operator', v_op2, 'При запуске насос гудит, но давление не набирает. Что проверить?', now() - interval '20 hours');

  -- ---- Parts request ----
  insert into public.parts_requests
    (company_id, machine_id, status, urgency, parts_freeform, notes, requested_by, created_at)
  values
    (v_company, v_m1, 'submitted', 'urgent',
     '[{"description":"Уплотнение НК-25","quantity_estimate":4,"category_hint":"seal"}]'::jsonb,
     'Запас на ближайшее ТО Северной-1.', v_op1, now() - interval '2 days');

  raise notice 'Demo seeded for company %: 3 machines, 14 shifts, 2 tickets, 1 parts request.', v_company;
end $$;
