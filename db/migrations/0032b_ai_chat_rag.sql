-- 0032b — AI chat with RAG: pgvector + manual_chunks + ai_conversations +
-- ai_messages + ai_learning_queue. Extends tickets and ticket_messages
-- for AI participation.
--
-- Apply AFTER 0032a (enum extension).
--
-- Idempotent.

create extension if not exists vector;

-- =========================================================================
-- A. Manual chunks — ingested PDFs + verified solutions from escalations.
-- =========================================================================
create table if not exists manual_chunks (
  id              uuid primary key default gen_random_uuid(),
  machine_type    text not null,
  language        text not null check (language in ('ru','en')),
  source          text not null,
  page            int,
  section         text,
  chunk_text      text not null,
  embedding       vector(1024) not null,
  verified_at     timestamptz,
  verified_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists manual_chunks_machine_lang_idx
  on manual_chunks (machine_type, language);

-- IVFFlat: ok for our scale (~1000-10000 chunks), faster build than HNSW.
create index if not exists manual_chunks_embedding_idx
  on manual_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- =========================================================================
-- B. AI conversations (separate from tickets — most never escalate).
-- =========================================================================
create table if not exists ai_conversations (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null references profiles(id) on delete restrict,
  machine_id      uuid not null references machines(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  status          text not null default 'active'
                    check (status in ('active','escalated','closed')),
  ticket_id       uuid references tickets(id) on delete set null,
  escalated_at    timestamptz,
  closed_at       timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists ai_conversations_operator_idx
  on ai_conversations (operator_id, created_at desc);
create index if not exists ai_conversations_machine_idx
  on ai_conversations (machine_id, created_at desc);

create table if not exists ai_messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references ai_conversations(id) on delete cascade,
  role                  text not null check (role in ('user','assistant')),
  content               text not null,
  image_url             text,
  retrieved_chunk_ids   uuid[],
  ai_confidence         smallint
                          check (ai_confidence is null or ai_confidence between 0 and 100),
  created_at            timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on ai_messages (conversation_id, created_at);

-- =========================================================================
-- C. Tickets extensions for AI-driven workflow.
-- =========================================================================
alter table tickets
  add column if not exists originated_from text
    default 'manual' check (originated_from in ('manual','ai_escalation')),
  add column if not exists resolved_by uuid references profiles(id) on delete set null;

-- AI messages have no human sender. Drop the NOT NULL on sender_id.
alter table ticket_messages
  alter column sender_id drop not null;

-- =========================================================================
-- D. Learning queue + trigger
-- =========================================================================
create table if not exists ai_learning_queue (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references tickets(id) on delete cascade,
  processed_at    timestamptz,
  error           text,
  created_at      timestamptz not null default now()
);

create or replace function enqueue_for_learning() returns trigger
language plpgsql as $$
begin
  if new.status = 'resolved'
     and (old.status is null or old.status <> 'resolved')
     and new.resolution_summary is not null
     and new.resolution_summary <> ''
     and new.originated_from = 'ai_escalation' then
    insert into ai_learning_queue (ticket_id) values (new.id);
  end if;
  return new;
end$$;

drop trigger if exists tickets_enqueue_learning on tickets;
create trigger tickets_enqueue_learning
  after update on tickets
  for each row execute function enqueue_for_learning();

-- =========================================================================
-- E. RLS
-- =========================================================================
alter table manual_chunks enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_learning_queue enable row level security;

-- manual_chunks: readable by all authenticated, writable only by platform_admin
drop policy if exists manual_chunks_authed_read on manual_chunks;
create policy manual_chunks_authed_read on manual_chunks
  for select to authenticated using (true);

drop policy if exists manual_chunks_platform_write on manual_chunks;
create policy manual_chunks_platform_write on manual_chunks
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- ai_conversations
drop policy if exists ai_conversations_operator_self on ai_conversations;
create policy ai_conversations_operator_self on ai_conversations
  for all using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

drop policy if exists ai_conversations_internal_all on ai_conversations;
create policy ai_conversations_internal_all on ai_conversations
  for all using (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  )
  with check (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  );

drop policy if exists ai_conversations_platform_all on ai_conversations;
create policy ai_conversations_platform_all on ai_conversations
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- ai_messages
drop policy if exists ai_messages_via_conversation on ai_messages;
create policy ai_messages_via_conversation on ai_messages
  for all using (
    exists (
      select 1 from ai_conversations c
       where c.id = ai_messages.conversation_id
         and (
           c.operator_id = auth.uid()
           or (c.company_id = public.user_company_id()
               and public.user_role() in ('service_engineer','project_manager'))
           or public.user_role() = 'platform_admin'
         )
    )
  );

-- ai_learning_queue: only platform_admin (it's a system queue)
drop policy if exists ai_learning_queue_platform on ai_learning_queue;
create policy ai_learning_queue_platform on ai_learning_queue
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');
