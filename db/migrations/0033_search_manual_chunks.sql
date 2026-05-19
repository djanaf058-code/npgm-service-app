-- 0033 — RPC helper for vector search, isolates the vector arithmetic
-- behind a typed SQL function so the application layer doesn't need
-- to build the operator expression.
--
-- Apply AFTER 0032b.
--
-- Idempotent.

create or replace function search_manual_chunks(
  p_query     text,        -- json array of floats
  p_machine_type text,
  p_limit     int default 5
)
returns table (
  id uuid,
  chunk_text text,
  page int,
  section text,
  source text,
  language text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.chunk_text, c.page, c.section, c.source, c.language,
         (1 - (c.embedding <=> p_query::vector))
           * (case when c.verified_at is not null then 1.5 else 1.0 end) as similarity
    from manual_chunks c
   where c.machine_type = p_machine_type
   order by similarity desc
   limit p_limit;
$$;

grant execute on function search_manual_chunks(text, text, int) to authenticated, service_role;
