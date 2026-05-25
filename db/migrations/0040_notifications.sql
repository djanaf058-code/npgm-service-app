-- 0040 — In-app notifications.
-- A `notifications` table + SECURITY DEFINER triggers that fan out rows to the
-- right recipients on key events:
--   * ticket message from an operator → service engineers (same company) + platform admins
--   * ticket message from engineer/AI/admin → the ticket's operator
--   * parts request created → platform admins (they issue the quote)
-- The row stores a `type` (UI localizes the label) + `title` (user content,
-- e.g. the ticket title) + a `link`. No RU/EN text is stored in the DB.
-- Safe to re-run.

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete cascade,
  type          text not null,
  title         text,
  link          text,
  entity_id     uuid,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications
  for select using (recipient_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- Inserts only happen through the SECURITY DEFINER trigger functions below.

-- Realtime for the live unread badge.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Fan-out helper.
create or replace function public.notify(
  p_recipients uuid[],
  p_company    uuid,
  p_type       text,
  p_title      text,
  p_link       text,
  p_entity     uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_recipients is null then return; end if;
  insert into public.notifications (recipient_id, company_id, type, title, link, entity_id)
  select rid, p_company, p_type, p_title, p_link, p_entity
  from unnest(p_recipients) as rid
  where rid is not null;
end; $$;

-- ---- Trigger: ticket messages ----
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
    -- Operator wrote → notify the company's service engineers + all platform admins.
    select array_agg(id) into v_recipients
    from public.profiles
    where (company_id = v_ticket.company_id and role = 'service_engineer')
       or role = 'platform_admin';
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

drop trigger if exists trg_notify_ticket_message on public.ticket_messages;
create trigger trg_notify_ticket_message
  after insert on public.ticket_messages
  for each row execute function public.notify_on_ticket_message();

-- ---- Trigger: parts requests ----
create or replace function public.notify_on_parts_request()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_recipients uuid[];
begin
  -- New parts request → platform admins (they issue the quote / КП).
  select array_agg(id) into v_recipients
  from public.profiles where role = 'platform_admin';
  if new.requested_by is not null then
    v_recipients := array_remove(v_recipients, new.requested_by);
  end if;
  perform public.notify(
    v_recipients, new.company_id, 'parts_request',
    coalesce(new.notes, ''), '/admin/queue/parts', new.id
  );
  return new;
end; $$;

drop trigger if exists trg_notify_parts_request on public.parts_requests;
create trigger trg_notify_parts_request
  after insert on public.parts_requests
  for each row execute function public.notify_on_parts_request();
