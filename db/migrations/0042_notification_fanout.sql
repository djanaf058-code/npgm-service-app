-- 0042 — fix notification fan-out for the current role model + parts workflow.
--
-- In-app notifications (table + bell from 0040) stay the only channel. This
-- migration only changes WHO gets notified and on WHICH events:
--
--   Tickets:  operator message → tier2_engineer + platform_admin (НПГМ answers),
--             not the customer's own service_engineer; replies → the operator.
--   Parts:    drop the "notify admin on every INSERT" trigger; instead notify
--             the NEXT actor on each workflow transition (operator-request
--             created → SE+PM; pending_pm → PM; forwarded → admin+tier2;
--             quoted → PM; approved → admin; ordered → operators+SE+PM;
--             received → admin+PM; cancelled → counterpart side).
--
-- Reuses public.notify(...) from 0040. No schema/enum changes — only
-- create-or-replace of trigger functions + the workflow RPCs. Idempotent.

-- =========================================================================
-- 1. Tickets — retarget the operator branch to the НПГМ side.
-- =========================================================================
create or replace function public.notify_on_ticket_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ticket      public.tickets%rowtype;
  v_recipients  uuid[];
  v_type        text;
begin
  select * into v_ticket from public.tickets where id = new.ticket_id;
  if not found then return new; end if;

  if new.sender_type = 'operator' then
    -- Operator wrote → notify НПГМ-side responders: tier2 engineers + admins.
    select array_agg(id) into v_recipients
    from public.profiles
    where role in ('tier2_engineer', 'platform_admin');
    v_type := 'ticket_operator_msg';
  else
    -- Engineer / AI / tier2 / admin replied → notify the operator.
    v_recipients := array[v_ticket.operator_id];
    v_type := 'ticket_answer';
  end if;

  -- Never notify the sender about their own message.
  if new.sender_id is not null then
    v_recipients := array_remove(v_recipients, new.sender_id);
  end if;

  perform public.notify(
    v_recipients, v_ticket.company_id, v_type,
    coalesce(v_ticket.title, ''), '/app/tickets/' || new.ticket_id, new.ticket_id
  );
  return new;
end; $$;

-- =========================================================================
-- 2. Parts — replace the blanket INSERT trigger with per-step notifications.
-- =========================================================================

-- 2a. Drop the old "every insert → all admins" trigger (wrong under consolidation).
drop trigger if exists trg_notify_parts_request on public.parts_requests;

-- 2b. New: operator-level request created → service engineers + PMs of the company.
create or replace function public.notify_on_operator_parts_request()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipients uuid[];
begin
  select array_agg(id) into v_recipients
  from public.profiles
  where company_id = new.company_id
    and role in ('service_engineer', 'project_manager');
  if new.requested_by is not null then
    v_recipients := array_remove(v_recipients, new.requested_by);
  end if;
  perform public.notify(
    v_recipients, new.company_id, 'parts_submitted',
    coalesce(new.notes, ''), '/app/parts/request/' || new.id, new.id
  );
  return new;
end; $$;

drop trigger if exists trg_notify_operator_parts_request on public.parts_requests;
create trigger trg_notify_operator_parts_request
  after insert on public.parts_requests
  for each row when (new.kind = 'operator')
  execute function public.notify_on_operator_parts_request();

-- =========================================================================
-- 3. Workflow RPCs — re-create with a notify() to the next actor.
--    Bodies preserved verbatim from 0028 / 0023b; only the notify block before
--    `return rec` is added.
-- =========================================================================

-- 3a. submit_consolidated_to_pm (drafting → pending_pm) → PM of the company.
create or replace function submit_consolidated_to_pm(p_id uuid)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
  caller_role user_role;
begin
  caller_role := public.user_role();
  if caller_role not in ('service_engineer', 'project_manager', 'platform_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['drafting']::parts_request_status[]);
  if rec.kind <> 'consolidated' then
    raise exception 'not_a_consolidated_request' using errcode = 'P0001';
  end if;
  update parts_requests
     set status = 'pending_pm',
         submitted_to_pm_at = now(),
         submitted_to_pm_by = auth.uid()
   where id = p_id
   returning * into rec;
  perform public.notify(
    array_remove(
      (select array_agg(id) from public.profiles
        where company_id = rec.company_id and role = 'project_manager'),
      auth.uid()),
    rec.company_id, 'parts_pending_pm', coalesce(rec.notes, ''),
    '/app/parts/request/' || rec.id, rec.id
  );
  return rec;
end$$;
grant execute on function submit_consolidated_to_pm(uuid) to authenticated;

-- 3b. pm_approve_scope (pending_pm → forwarded) → НПГМ side (admin + tier2).
create or replace function pm_approve_scope(p_id uuid)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'only_pm_can_approve_scope' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['pending_pm']::parts_request_status[]);
  if rec.kind <> 'consolidated' then
    raise exception 'not_a_consolidated_request' using errcode = 'P0001';
  end if;
  update parts_requests
     set status = 'forwarded',
         forwarded_at = now(),
         forwarded_by = auth.uid()
   where id = p_id
   returning * into rec;
  perform public.notify(
    array_remove(
      (select array_agg(id) from public.profiles
        where role in ('platform_admin', 'tier2_engineer')),
      auth.uid()),
    rec.company_id, 'parts_forwarded', coalesce(rec.notes, ''),
    '/admin/queue/parts', rec.id
  );
  return rec;
end$$;
grant execute on function pm_approve_scope(uuid) to authenticated;

-- 3c. pm_accept_quote (quoted → approved) → platform_admin.
create or replace function pm_accept_quote(p_id uuid)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'only_pm_can_accept_quote' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['quoted']::parts_request_status[]);
  update parts_requests
     set status = 'approved',
         approved_at = now(),
         approved_by = auth.uid()
   where id = p_id
   returning * into rec;
  perform public.notify(
    array_remove(
      (select array_agg(id) from public.profiles where role = 'platform_admin'),
      auth.uid()),
    rec.company_id, 'parts_approved', coalesce(rec.notes, ''),
    '/admin/queue/parts', rec.id
  );
  return rec;
end$$;
grant execute on function pm_accept_quote(uuid) to authenticated;

-- 3d. quote_parts_request (forwarded → quoted) → PM of the company.
create or replace function quote_parts_request(
  p_id uuid, p_notes text,
  p_total_amount numeric default null,
  p_currency text default null
)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() <> 'platform_admin' then
    raise exception 'only_platform_admin_can_quote' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['forwarded']::parts_request_status[]);
  update parts_requests
     set status = 'quoted',
         quoted_at = now(), quoted_by = auth.uid(),
         quote_notes = p_notes,
         quote_total_amount = p_total_amount,
         quote_currency = p_currency
   where id = p_id
   returning * into rec;
  perform public.notify(
    array_remove(
      (select array_agg(id) from public.profiles
        where company_id = rec.company_id and role = 'project_manager'),
      auth.uid()),
    rec.company_id, 'parts_quoted', coalesce(rec.notes, ''),
    '/app/parts/request/' || rec.id, rec.id
  );
  return rec;
end$$;

-- 3e. mark_parts_request_ordered (approved → ordered) → child operators + SE + PM.
create or replace function mark_parts_request_ordered(p_id uuid, p_eta date)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() <> 'platform_admin' then
    raise exception 'only_platform_admin_can_mark_ordered' using errcode = '42501';
  end if;
  if p_eta is null then
    raise exception 'eta_required' using errcode = 'P0001';
  end if;
  rec := _assert_parts_request_state(p_id, array['approved']::parts_request_status[]);
  update parts_requests
     set status = 'ordered',
         ordered_at = now(), ordered_by = auth.uid(),
         expected_delivery_date = p_eta
   where id = p_id
   returning * into rec;
  perform public.notify(
    array_remove((
      select array_agg(uid) from (
        select requested_by as uid from public.parts_requests
          where parent_id = rec.id and kind = 'operator' and requested_by is not null
        union
        select id from public.profiles
          where company_id = rec.company_id and role in ('service_engineer', 'project_manager')
      ) s
    ), auth.uid()),
    rec.company_id, 'parts_ordered', coalesce(rec.notes, ''),
    '/app/parts/request/' || rec.id, rec.id
  );
  return rec;
end$$;

-- 3f. mark_parts_request_received (ordered → received) → platform_admin + PM.
create or replace function mark_parts_request_received(
  p_id uuid,
  p_quantity_text text,
  p_photo_url text,
  p_notes text default null
)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  caller_role user_role;
  rec parts_requests;
begin
  caller_role := public.user_role();
  if caller_role not in ('operator', 'service_engineer', 'project_manager', 'company_admin', 'platform_admin') then
    raise exception 'role_cannot_mark_received' using errcode = '42501';
  end if;
  if p_photo_url is null or length(trim(p_photo_url)) = 0 then
    raise exception 'photo_required' using errcode = 'P0001';
  end if;
  rec := _assert_parts_request_state(p_id, array['ordered']::parts_request_status[]);
  update parts_requests
     set status = 'received',
         received_at = now(),
         received_by = auth.uid(),
         received_quantity_text = p_quantity_text,
         received_photo_url = p_photo_url,
         received_notes = p_notes,
         resolved_at = now()
   where id = p_id
   returning * into rec;
  perform public.notify(
    array_remove((
      select array_agg(id) from public.profiles
        where role = 'platform_admin'
           or (company_id = rec.company_id and role = 'project_manager')
    ), auth.uid()),
    rec.company_id, 'parts_received', coalesce(rec.notes, ''),
    '/admin/queue/parts', rec.id
  );
  return rec;
end$$;
grant execute on function mark_parts_request_received(uuid, text, text, text) to authenticated;

-- 3g. cancel_parts_request → the counterpart side of whoever cancelled.
create or replace function cancel_parts_request(p_id uuid, p_reason text default null)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  caller_role user_role;
  rec parts_requests;
  allowed parts_request_status[];
begin
  caller_role := public.user_role();
  if caller_role = 'operator' then
    allowed := array['submitted']::parts_request_status[];
  elsif caller_role = 'service_engineer' then
    allowed := array['drafting', 'pending_pm']::parts_request_status[];
  elsif caller_role = 'project_manager' then
    allowed := array['submitted', 'consolidated', 'drafting',
                     'pending_pm', 'forwarded', 'quoted', 'approved']::parts_request_status[];
  elsif caller_role = 'platform_admin' then
    allowed := array['submitted', 'consolidated', 'drafting',
                     'pending_pm', 'forwarded', 'quoted', 'approved',
                     'ordered']::parts_request_status[];
  else
    raise exception 'role_cannot_cancel' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, allowed);
  update parts_requests
     set status = 'cancelled',
         cancel_reason = p_reason,
         resolved_at = now()
   where id = p_id
   returning * into rec;
  -- Notify the opposite side so nobody is left waiting on a dead request.
  if caller_role in ('operator', 'service_engineer', 'project_manager') then
    perform public.notify(
      array_remove(
        (select array_agg(id) from public.profiles
          where role in ('platform_admin', 'tier2_engineer')),
        auth.uid()),
      rec.company_id, 'parts_cancelled', coalesce(rec.notes, ''),
      '/admin/queue/parts', rec.id
    );
  else
    perform public.notify(
      array_remove(
        (select array_agg(id) from public.profiles
          where company_id = rec.company_id
            and role in ('service_engineer', 'project_manager')),
        auth.uid()),
      rec.company_id, 'parts_cancelled', coalesce(rec.notes, ''),
      '/app/parts/request/' || rec.id, rec.id
    );
  end if;
  return rec;
end$$;
