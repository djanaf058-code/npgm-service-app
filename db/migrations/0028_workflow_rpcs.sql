-- 0028 — RPC functions for the new 3-step parts workflow.
--
-- Cycle:
--   operator submits  → service collects into 'drafting'
--   service submits to PM (drafting → pending_pm)
--   PM approves scope (pending_pm → forwarded)        — no prices yet
--   platform_admin quotes (forwarded → quoted)         — price visible to PM
--   PM accepts quote (quoted → approved)
--   platform_admin places order (approved → ordered + ETA)
--   operator/service/PM marks received (ordered → received + photo)
--   any party at their step → cancelled (with reason)
--
-- All transitions are SECURITY DEFINER, check role + tenant + state.
--
-- PREREQUISITE: 0027 must already be committed (uses new enum values).
-- Idempotent.

-- =========================================================================
-- A. _assert_parts_request_state already exists from 0023b — reuse as-is.
-- =========================================================================

-- =========================================================================
-- B. create_consolidated_request — service: create empty 'drafting'.
-- =========================================================================
create or replace function create_consolidated_request(p_notes text default null)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  rec parts_requests;
  caller_role user_role;
  caller_company uuid;
begin
  caller_role := public.user_role();
  if caller_role not in ('service_engineer', 'project_manager', 'platform_admin') then
    raise exception 'role_cannot_create_consolidated' using errcode = '42501';
  end if;
  caller_company := public.user_company_id();
  if caller_company is null and caller_role <> 'platform_admin' then
    raise exception 'caller_has_no_company' using errcode = 'P0001';
  end if;

  insert into parts_requests (
    company_id, kind, status, urgency,
    parts_requested, parts_freeform,
    notes, requested_by,
    consolidated_at, submitted_at
  ) values (
    caller_company,
    'consolidated', 'drafting', 'normal',
    '[]'::jsonb, '[]'::jsonb,
    p_notes, auth.uid(),
    now(), now()
  )
  returning * into rec;
  return rec;
end$$;
grant execute on function create_consolidated_request(text) to authenticated;

-- =========================================================================
-- C. consolidate_operator_requests — link operator-rows under a consolidated.
--    Idempotent: pass the full set of operator IDs the consolidated should
--    include and the function recomputes the merged item lists each time.
--
--    Catalog dedupe rule: rows in parts_requested with non-null part_id are
--    grouped by part_id; quantity is summed; display_name_ru and source are
--    taken from any one of the rows (max() picks deterministically).
--    Freeform items (no part_id) just concatenate.
-- =========================================================================
create or replace function consolidate_operator_requests(
  p_consolidated_id uuid,
  p_operator_ids uuid[]
)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  cons parts_requests;
  caller_role user_role;
  caller_company uuid;
  merged_catalog jsonb;
  merged_freeform jsonb;
begin
  caller_role := public.user_role();
  if caller_role not in ('service_engineer', 'project_manager', 'platform_admin') then
    raise exception 'role_cannot_consolidate' using errcode = '42501';
  end if;
  caller_company := public.user_company_id();

  select * into cons from parts_requests where id = p_consolidated_id for update;
  if not found then
    raise exception 'consolidated_not_found' using errcode = 'P0001';
  end if;
  if cons.kind <> 'consolidated' then
    raise exception 'not_a_consolidated_request' using errcode = 'P0001';
  end if;
  if cons.status <> 'drafting' then
    raise exception 'consolidated_already_submitted' using errcode = 'P0001';
  end if;
  if cons.company_id is distinct from caller_company and caller_role <> 'platform_admin' then
    raise exception 'company_mismatch' using errcode = '42501';
  end if;

  -- Re-parent operator rows (only those that belong to the same company,
  -- are still operator-kind, and haven't been claimed by another consolidated).
  update parts_requests
     set parent_id = p_consolidated_id,
         status = 'consolidated'
   where id = any(p_operator_ids)
     and kind = 'operator'
     and company_id = cons.company_id
     and (parent_id is null or parent_id = p_consolidated_id);

  -- Recompute catalog from ALL the consolidated's current children.
  with children as (
    select parts_requested
      from parts_requests
     where parent_id = p_consolidated_id and kind = 'operator'
  ),
  catalog_rows as (
    select jsonb_array_elements(parts_requested) as item from children
  ),
  catalog_grouped as (
    select item->>'part_id' as part_id,
           max(item->>'display_name_ru') as display_name_ru,
           sum((item->>'quantity')::numeric) as quantity,
           coalesce(max(item->>'source'), 'consolidated') as source
      from catalog_rows
     where item->>'part_id' is not null
     group by item->>'part_id'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
              'part_id',         g.part_id,
              'display_name_ru', g.display_name_ru,
              'quantity',        g.quantity,
              'source',          g.source
         )), '[]'::jsonb)
    into merged_catalog
    from catalog_grouped g;

  -- Concat freeform (no dedup — texts vary).
  with children as (
    select parts_freeform
      from parts_requests
     where parent_id = p_consolidated_id and kind = 'operator'
  ),
  freeform_rows as (
    select jsonb_array_elements(parts_freeform) as item from children
  )
  select coalesce(jsonb_agg(item), '[]'::jsonb)
    into merged_freeform
    from freeform_rows;

  update parts_requests
     set parts_requested = merged_catalog,
         parts_freeform = merged_freeform
   where id = p_consolidated_id
   returning * into cons;
  return cons;
end$$;
grant execute on function consolidate_operator_requests(uuid, uuid[]) to authenticated;

-- =========================================================================
-- D. submit_consolidated_to_pm — service: drafting → pending_pm.
-- =========================================================================
create or replace function submit_consolidated_to_pm(p_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
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
  return rec;
end$$;
grant execute on function submit_consolidated_to_pm(uuid) to authenticated;

-- =========================================================================
-- E. pm_approve_scope — PM: pending_pm → forwarded.
-- =========================================================================
create or replace function pm_approve_scope(p_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
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
  return rec;
end$$;
grant execute on function pm_approve_scope(uuid) to authenticated;

-- =========================================================================
-- F. pm_accept_quote — PM: quoted → approved.
-- =========================================================================
create or replace function pm_accept_quote(p_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
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
  return rec;
end$$;
grant execute on function pm_accept_quote(uuid) to authenticated;

-- =========================================================================
-- G. Rewrite existing RPCs from 0023b under the new role taxonomy.
--    quote_parts_request: only platform_admin can quote (was tier2).
--    mark_parts_request_ordered: only platform_admin (was tier2).
--    forward_parts_request: was company_admin only; now PM only and accepts
--      both 'submitted' (legacy single-step) and 'pending_pm' (new path).
--    approve_parts_request: was company_admin; now PM.
-- =========================================================================
create or replace function quote_parts_request(
  p_id uuid, p_notes text,
  p_total_amount numeric default null,
  p_currency text default null
)
returns parts_requests
language plpgsql
security definer
set search_path = public
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
  return rec;
end$$;

create or replace function mark_parts_request_ordered(p_id uuid, p_eta date)
returns parts_requests
language plpgsql
security definer
set search_path = public
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
  return rec;
end$$;

create or replace function forward_parts_request(p_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id,
    array['submitted', 'pending_pm']::parts_request_status[]);
  update parts_requests
     set status = 'forwarded',
         forwarded_at = now(),
         forwarded_by = auth.uid()
   where id = p_id
   returning * into rec;
  return rec;
end$$;

create or replace function approve_parts_request(p_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['quoted']::parts_request_status[]);
  update parts_requests
     set status = 'approved',
         approved_at = now(),
         approved_by = auth.uid()
   where id = p_id
   returning * into rec;
  return rec;
end$$;

-- =========================================================================
-- H. cancel_parts_request — refresh allow-list under new taxonomy.
-- =========================================================================
create or replace function cancel_parts_request(p_id uuid, p_reason text default null)
returns parts_requests
language plpgsql
security definer
set search_path = public
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
  return rec;
end$$;
