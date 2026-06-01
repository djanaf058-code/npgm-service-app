-- 0044 — finish tier2 (НПГМ service engineer) RLS for tickets + ticket_messages.
--
-- Code review of 0041 caught a stale assumption: the comment in 0041 said
-- "tickets cross-tenant visibility for tier2 already exists from 0012". But
-- 0031_operator_scoping.sql:195 explicitly dropped `tickets_tier2_active` and
-- never recreated it. Net effect: tier2 currently has NO SELECT policy on
-- tickets at all → /admin/tickets returns an empty list, breaking the whole
-- tier2 ticket-handling flow that 0041's UI was set up for.
--
-- ticket_messages still has `ticket_messages_tier2_active` from 0012, but it
-- is scoped to status in (new, tier2_responding) — too narrow: tier2 loses
-- access the moment status moves to awaiting_operator, and they can never see
-- resolved history for context.
--
-- This migration:
--   1. Grants tier2 cross-tenant SELECT on tickets (read all, for triage + history).
--   2. Replaces ticket_messages_tier2_active with broader SELECT-all +
--      INSERT-on-non-closed policies so tier2 can read history and reply on
--      any still-active status (new / tier2_responding / awaiting_operator).
--   3. Re-affirms grants on the workflow RPCs that 0042 re-created without an
--      explicit grant statement. Postgres preserves grants across CREATE OR
--      REPLACE when the signature matches, but re-stating is belt-and-braces
--      against any future signature drift.
--
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. tickets: tier2 reads any ticket, any tenant.
-- ---------------------------------------------------------------------------
drop policy if exists tickets_tier2_read on tickets;
create policy tickets_tier2_read on tickets
  for select to authenticated
  using (public.user_role() = 'tier2_engineer');

-- ---------------------------------------------------------------------------
-- 2. ticket_messages: replace narrow status-scoped policy with read-all +
--    insert-on-non-closed.
-- ---------------------------------------------------------------------------
drop policy if exists ticket_messages_tier2_active on ticket_messages;
drop policy if exists ticket_messages_tier2_read   on ticket_messages;
drop policy if exists ticket_messages_tier2_write  on ticket_messages;

create policy ticket_messages_tier2_read on ticket_messages
  for select to authenticated
  using (public.user_role() = 'tier2_engineer');

-- Reply allowed on any not-yet-closed ticket. resolved / closed_self are final
-- states — no posthumous replies.
create policy ticket_messages_tier2_write on ticket_messages
  for insert to authenticated
  with check (
    public.user_role() = 'tier2_engineer'
    and exists (
      select 1 from tickets t
      where t.id = ticket_messages.ticket_id
        and t.status not in ('resolved', 'closed_self')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Re-affirm grants on workflow RPCs that 0042 re-created without an
--    explicit grant. CREATE OR REPLACE preserves grants when the signature is
--    unchanged (and here it is), so this is defensive — costs nothing.
-- ---------------------------------------------------------------------------
grant execute on function quote_parts_request(uuid, text, numeric, text) to authenticated;
grant execute on function mark_parts_request_ordered(uuid, date) to authenticated;
grant execute on function cancel_parts_request(uuid, text) to authenticated;
