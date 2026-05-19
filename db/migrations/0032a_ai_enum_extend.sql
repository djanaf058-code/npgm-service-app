-- 0032a — extend message_sender enum with 'ai' and 'platform_admin'.
--
-- MUST run separately from 0032b because PostgreSQL forbids
-- ALTER TYPE ADD VALUE inside a transaction, and Supabase SQL Editor
-- wraps scripts in transactions by default. Apply this file first,
-- then 0032b.
--
-- Idempotent.

do $$ begin
  if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
                 where t.typname='message_sender' and e.enumlabel='ai') then
    alter type message_sender add value 'ai';
  end if;
  if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
                 where t.typname='message_sender' and e.enumlabel='platform_admin') then
    alter type message_sender add value 'platform_admin';
  end if;
end $$;
