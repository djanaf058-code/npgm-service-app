-- 0043 — switch manual_chunks vector index from IVFFlat to HNSW.
--
-- Why: at our scale (a few thousand chunks) the 0032b index `lists = 100` is
-- mis-tuned (IVFFlat's rule of thumb is lists ≈ rows/1000, so 100 lists only
-- makes sense near ~100k rows; at a few thousand rows it over-partitions and
-- hurts recall). IVFFlat also needs periodic REINDEX to keep recall as data
-- grows. HNSW gives better recall, stable latency, and needs no rebuild.
--
-- Best applied while manual_chunks is still ~empty (before bulk РЭ ingestion):
-- the index then builds instantly. Requires pgvector >= 0.5.0 (Supabase has it).
--
-- Idempotent.

drop index if exists manual_chunks_embedding_idx;

create index if not exists manual_chunks_embedding_idx
  on manual_chunks using hnsw (embedding vector_cosine_ops);
-- Defaults (m = 16, ef_construction = 64) are fine for our scale.
