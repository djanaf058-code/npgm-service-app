// Vector search wrapper. Caller passes user message; we embed (as 'query',
// not 'document'), search across all languages (cross-lingual), boost
// verified FAQ chunks 1.5x.

import { embed } from './mistral';
import { createServerAdminClient } from '../supabase/serverAdminClient';

export interface RetrievedChunk {
  id: string;
  chunk_text: string;
  page: number | null;
  section: string | null;
  source: string;
  language: string;
  similarity: number;
}

export async function retrieve(
  query: string,
  machineType: string,
  topK = 5
): Promise<RetrievedChunk[]> {
  const [vec] = await embed(query, 'query');
  const admin = await createServerAdminClient();
  // pgvector accepts arrays as JSON literals via ::vector cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('search_manual_chunks', {
    p_query: JSON.stringify(vec),
    p_machine_type: machineType,
    p_limit: topK,
  });
  if (error) throw error;
  return data as RetrievedChunk[];
}
