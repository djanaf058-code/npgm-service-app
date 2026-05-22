-- 0037 — allow AI-generated ticket messages (sender_id is null for ai sender).
-- Used by /api/tickets/ai-reply to post an automatic first answer when a
-- ticket is created. sender_type='ai' already exists in message_sender enum
-- since migration 0032a.
-- Safe to re-run.

alter table public.ticket_messages
  alter column sender_id drop not null;

-- Defence-in-depth: only ai-typed rows are allowed to have a null sender_id.
-- Human-typed rows must still record who sent them.
alter table public.ticket_messages
  drop constraint if exists ticket_messages_sender_id_required;
alter table public.ticket_messages
  add constraint ticket_messages_sender_id_required
  check (sender_type = 'ai' or sender_id is not null);
