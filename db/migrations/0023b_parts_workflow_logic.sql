-- 0023b — RPC transition functions + RLS for the two-step parts workflow.
--
-- PREREQUISITE: 0023a must already be committed (it adds the enum values
-- 'submitted', 'forwarded', 'quoted', 'received' that this file references).
-- Running 0023b in the same Supabase SQL Editor query as 0023a will fail
-- with 55P04 "unsafe use of new value" — that's a Postgres rule, not a bug.
--
-- All transitions go through SECURITY DEFINER functions that
--   (a) check the caller's role and tenant,
--   (b) check the current status,
--   (c) atomically update status + the corresponding *_at / *_by stamps.
--
-- Idempotent.

-- =========================================================================
-- A. Helper: pre-check + lock the row before any transition.
-- =========================================================================
create or replace function _assert_parts_request_state(
  p_id uuid,
  p_expected_statuses parts_request_status[]
)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  rec parts_requests;
  caller_company uuid;
  caller_role user_role;
begin
  select * into rec from parts_requests where id = p_id for update;
  if not found then
    raise exception 'parts_request_not_found' using errcode = 'P0001';
  end if;
  caller_company := public.user_company_id();
  caller_role := public.user_role();
  if caller_role not in ('tier2_engineer', 'platform_admin')
     and rec.company_id is distinct from caller_company then
    raise exception 'access_denied_company_mismatch' using errcode = '42501';
  end if;
  if not rec.status = any(p_expected_statuses) then
    raise exception 'invalid_status_transition: % is not in %',
      rec.status, p_expected_statuses
      using errcode = 'P0001';
  end if;
  return rec;
end$$;

grant execute on function _assert_parts_request_state(uuid, parts_request_status[]) to authenticated;

-- =========================================================================
-- B. Per-transition functions
-- =========================================================================

-- ----- forward_parts_request: admin: submitted → forwarded ----------------
create or replace function forward_parts_request(p_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role user_role;
  rec parts_requests;
begin
  caller_role := public.user_role();
  if caller_role not in ('company_admin', 'platform_admin') then
    raise exception 'only company_admin can forward requests' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['submitted']::parts_request_status[]);
  update parts_requests
     set status = 'forwarded',
         forwarded_at = now(),
         forwarded_by = auth.uid()
   where id = p_id
   returning * into rec;
  return rec;
end$$;
grant execute on function forward_parts_request(uuid) to authenticated;

-- ----- quote_parts_request: tier2: forwarded → quoted ---------------------
create or replace function quote_parts_request(
  p_id uuid,
  p_notes text,
  p_total_amount numeric default null,
  p_currency text default null
)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role user_role;
  rec parts_requests;
begin
  caller_role := public.user_role();
  if caller_role not in ('tier2_engineer', 'platform_admin') then
    raise exception 'only tier2 can quote requests' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['forwarded']::parts_request_status[]);
  update parts_requests
     set status = 'quoted',
         quoted_at = now(),
         quoted_by = auth.uid(),
         quote_notes = p_notes,
         quote_total_amount = p_total_amount,
         quote_currency = p_currency
   where id = p_id
   returning * into rec;
  return rec;
end$$;
grant execute on function quote_parts_request(uuid, text, numeric, text) to authenticated;

-- ----- approve_parts_request: admin: quoted → approved --------------------
create or replace function approve_parts_request(p_id uuid)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role user_role;
  rec parts_requests;
begin
  caller_role := public.user_role();
  if caller_role not in ('company_admin', 'platform_admin') then
    raise exception 'only company_admin can approve quotes' using errcode = '42501';
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
grant execute on function approve_parts_request(uuid) to authenticated;

-- ----- mark_parts_request_ordered: tier2: approved → ordered + ETA --------
create or replace function mark_parts_request_ordered(
  p_id uuid,
  p_eta date
)
returns parts_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role user_role;
  rec parts_requests;
begin
  caller_role := public.user_role();
  if caller_role not in ('tier2_engineer', 'platform_admin') then
    raise exception 'only tier2 can mark orders' using errcode = '42501';
  end if;
  if p_eta is null then
    raise exception 'eta_required' using errcode = 'P0001';
  end if;
  rec := _assert_parts_request_state(p_id, array['approved']::parts_request_status[]);
  update parts_requests
     set status = 'ordered',
         ordered_at = now(),
         ordered_by = auth.uid(),
         expected_delivery_date = p_eta
   where id = p_id
   returning * into rec;
  return rec;
end$$;
grant execute on function mark_parts_request_ordered(uuid, date) to authenticated;

-- ----- mark_parts_request_received: operator/admin: ordered → received -----
create or replace function mark_parts_request_received(
  p_id uuid,
  p_quantity_text text,
  p_photo_url text,
  p_notes text default null
)
returns parts_requests
language plpgsql
security definer
set search_path = public
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
  return rec;
end$$;
grant execute on function mark_parts_request_received(uuid, text, text, text) to authenticated;

-- ----- cancel_parts_request: any party at their step ----------------------
create or replace function cancel_parts_request(
  p_id uuid,
  p_reason text default null
)
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
  elsif caller_role in ('company_admin') then
    allowed := array['submitted', 'forwarded', 'quoted', 'approved', 'ordered']::parts_request_status[];
  elsif caller_role in ('tier2_engineer') then
    allowed := array['forwarded', 'quoted', 'approved', 'ordered']::parts_request_status[];
  elsif caller_role = 'platform_admin' then
    allowed := array['submitted', 'forwarded', 'quoted', 'approved', 'ordered']::parts_request_status[];
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
grant execute on function cancel_parts_request(uuid, text) to authenticated;

-- =========================================================================
-- C. RLS adjustments
-- =========================================================================

-- The original migration 0018 created a buggy parts_requests_tier2_read with
-- FOR ALL (allowed mutations across tenants). Drop it; replace with a
-- SELECT-only policy that also hides 'submitted' rows from tier2 — they
-- only see what's already been forwarded by company_admin.
drop policy if exists parts_requests_tier2_read on parts_requests;
drop policy if exists parts_requests_tier2_visible on parts_requests;

create policy parts_requests_tier2_visible on parts_requests
  for select
  to authenticated
  using (
    public.user_role() = 'tier2_engineer'
    and status in ('forwarded', 'quoted', 'approved', 'ordered', 'received', 'cancelled')
  );

-- Operators inside a company keep SELECT via parts_requests_company_all
-- (they see their own + colleagues' for transparency). Direct UPDATE is
-- still allowed by company_all, but the UI no longer offers a status
-- dropdown — only RPC paths. Hardening (split SELECT/INSERT/UPDATE
-- policies) can be done in a later migration if needed.
