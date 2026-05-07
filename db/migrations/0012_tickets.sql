-- Migration 0012 — Tickets and ticket messages (operator ↔ Tier 2 chat)
-- Depends on: 0001_init, 0002_users, 0003_machines, 0011_rls
-- Idempotent: yes
--
-- "Tickets" = the operator's call to a service engineer. Replaces the
-- ad-hoc WhatsApp flow with a structured channel that has history,
-- status, and (eventually) AI-assisted triage.

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type ticket_status as enum (
    'new',                -- just submitted, no response yet
    'tier2_responding',   -- platform-side engineer (Tier 2) is on it
    'awaiting_operator',  -- waiting for the operator to provide more info
    'resolved',           -- closed with a successful resolution
    'closed_self'         -- operator closed it themselves
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type message_sender as enum ('operator', 'service_engineer', 'tier2');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- tickets
-- ============================================================
create table if not exists tickets (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  machine_id          uuid references machines(id) on delete set null,
  operator_id         uuid not null references profiles(id) on delete restrict,
  status              ticket_status not null default 'new',
  priority            smallint not null default 3 check (priority between 1 and 5),
  title               text,
  resolution_summary  text,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  updated_at          timestamptz not null default now()
);

drop trigger if exists tickets_set_updated_at on tickets;
create trigger tickets_set_updated_at
  before update on tickets
  for each row execute function set_updated_at();

create index if not exists tickets_company_status_idx
  on tickets (company_id, status, created_at desc);
create index if not exists tickets_machine_idx
  on tickets (machine_id) where machine_id is not null;
create index if not exists tickets_operator_idx
  on tickets (operator_id);
create index if not exists tickets_active_idx
  on tickets (status, created_at desc) where status in ('new', 'tier2_responding');

-- ============================================================
-- ticket_messages
-- ============================================================
create table if not exists ticket_messages (
  id                    uuid primary key default gen_random_uuid(),
  ticket_id             uuid not null references tickets(id) on delete cascade,
  sender_type           message_sender not null,
  sender_id             uuid not null references profiles(id) on delete restrict,
  text                  text,
  image_url             text,                -- Supabase Storage path
  related_manual_chunks uuid[],              -- populated by RAG in Sprint 2/3
  created_at            timestamptz not null default now()
);

create index if not exists ticket_messages_ticket_idx
  on ticket_messages (ticket_id, created_at);

-- ============================================================
-- RLS
-- ============================================================
alter table tickets enable row level security;
alter table ticket_messages enable row level security;

-- ----- tickets policies -----
drop policy if exists tickets_company_all on tickets;
drop policy if exists tickets_operator_self on tickets;
drop policy if exists tickets_tier2_active on tickets;
drop policy if exists tickets_platform_all on tickets;

-- Members of the owning company can do anything with the ticket
create policy tickets_company_all on tickets
  for all using (company_id = public.user_company_id());

-- Operators always see their own tickets even if a future policy tightens
-- the company_all policy
create policy tickets_operator_self on tickets
  for select using (operator_id = auth.uid());

-- Tier 2 (platform-side engineers) see only tickets that are currently
-- active and need their attention — never the rest of the company's data
create policy tickets_tier2_active on tickets
  for all using (
    public.user_role() = 'tier2_engineer'
    and status in ('new', 'tier2_responding')
  );

-- Platform admins do everything
create policy tickets_platform_all on tickets
  for all using (public.user_role() = 'platform_admin');

-- ----- ticket_messages policies -----
drop policy if exists ticket_messages_company_all on ticket_messages;
drop policy if exists ticket_messages_tier2_active on ticket_messages;
drop policy if exists ticket_messages_platform_all on ticket_messages;

-- Members of the owning company can read/write messages on their tickets
create policy ticket_messages_company_all on ticket_messages
  for all using (
    exists (
      select 1 from tickets t
      where t.id = ticket_messages.ticket_id
        and t.company_id = public.user_company_id()
    )
  );

-- Tier 2 can read/write messages on tickets that are currently active
create policy ticket_messages_tier2_active on ticket_messages
  for all using (
    public.user_role() = 'tier2_engineer'
    and exists (
      select 1 from tickets t
      where t.id = ticket_messages.ticket_id
        and t.status in ('new', 'tier2_responding')
    )
  );

create policy ticket_messages_platform_all on ticket_messages
  for all using (public.user_role() = 'platform_admin');

-- ============================================================
-- Storage bucket for ticket photos
-- ============================================================
-- Note: storage.buckets is owned by the supabase_storage_admin role,
-- so we use a permissive insert here. If RLS on storage.buckets blocks
-- this in your environment, create the bucket via the Dashboard:
--   Storage → New bucket: name=ticket-photos, public=false
insert into storage.buckets (id, name, public)
values ('ticket-photos', 'ticket-photos', false)
on conflict (id) do nothing;

-- Storage RLS — operators can upload photos to their own ticket folders;
-- members of the owning company can read.
drop policy if exists ticket_photos_member_read on storage.objects;
drop policy if exists ticket_photos_company_write on storage.objects;

-- Read: any authenticated user; bucket is private but RLS narrows to the
-- requester's company via the path convention <company_id>/<ticket_id>/<filename>
create policy ticket_photos_member_read on storage.objects
  for select using (
    bucket_id = 'ticket-photos'
    and (
      -- Same company by path prefix
      (storage.foldername(name))[1] = public.user_company_id()::text
      -- Tier 2 / platform admin
      or public.user_role() in ('tier2_engineer', 'platform_admin')
    )
  );

create policy ticket_photos_company_write on storage.objects
  for insert with check (
    bucket_id = 'ticket-photos'
    and (storage.foldername(name))[1] = public.user_company_id()::text
  );
