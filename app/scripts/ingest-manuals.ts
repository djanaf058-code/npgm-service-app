// Usage: cd app && pnpm tsx scripts/ingest-manuals.ts
//
// Prerequisites:
//   1. .env.local has MISTRAL_API_KEY + NEXT_PUBLIC_SUPABASE_URL + PRIVATE_SUPABASE_SERVICE_KEY
//   2. Migration 0032a + 0032b applied to Supabase (creates pgvector + manual_chunks)
//
// Idempotent: re-running deletes prior rows for the same source first, then re-inserts.
// Cost: free on Mistral La Plateforme free tier (rate-limited 1 RPS).

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseAndChunkPdf, summarise } from '../src/lib/ai/pdf-parser';
import { embed } from '../src/lib/ai/mistral';

// Parse .env.local manually — node doesn't auto-load it for scripts.
const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;
if (!URL_BASE || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or PRIVATE_SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}
if (!process.env.MISTRAL_API_KEY) {
  console.error('Missing MISTRAL_API_KEY in .env.local');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

// Path relative to app/ (where script runs from). Manuals live a level up.
const MANUALS = [
  { path: '../../manuals/МСЗУ/МСЗУ-14-НПБ.pdf', type: 'МСЗУ', lang: 'ru' as const },
  { path: '../../manuals/МЗУ/Operation Manual MZU-16-4K Eng.pdf', type: 'МЗУ', lang: 'en' as const },
  { path: '../../manuals/МСЗ/ANFO Operational Manual.pdf', type: 'МСЗ', lang: 'en' as const },
  { path: '../../manuals/МЗВ/ТО МЗВ-16.pdf', type: 'МЗВ', lang: 'ru' as const },
  { path: '../../manuals/МЗВ/ТО МЗВ-16 eng.pdf', type: 'МЗВ', lang: 'en' as const },
];

async function deleteBySource(source: string) {
  const resp = await fetch(
    `${URL_BASE}/rest/v1/manual_chunks?source=eq.${encodeURIComponent(source)}`,
    { method: 'DELETE', headers }
  );
  if (!resp.ok && resp.status !== 404) {
    const t = await resp.text();
    throw new Error(`Delete failed ${resp.status}: ${t}`);
  }
}

async function insertBatch(rows: object[]) {
  const resp = await fetch(`${URL_BASE}/rest/v1/manual_chunks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Insert failed ${resp.status}: ${t}`);
  }
}

async function main() {
  for (const m of MANUALS) {
    const fullPath = resolve(m.path);
    console.log(`\n=== Ingesting ${m.path} ===`);
    const chunks = await parseAndChunkPdf(fullPath, m.lang);
    const s = summarise(chunks);
    console.log(`  chunks: ${s.count}, est. tokens: ${s.tokens}`);

    const source = `manual:${m.path.split('/').pop()}`;
    await deleteBySource(source);
    console.log(`  cleared prior rows for ${source}`);

    // Embed in batches of 96 (well under Mistral's practical per-request cap;
    // also keeps us inside the free tier's 1-RPS pacing comfortably).
    const BATCH = 96;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const embeddings = await embed(
        slice.map((c) => c.text),
        'document'
      );
      const rows = slice.map((c, idx) => ({
        machine_type: m.type,
        language: m.lang,
        source,
        page: c.page,
        section: c.section,
        chunk_text: c.text,
        embedding: embeddings[idx],
      }));
      await insertBatch(rows);
      console.log(`  inserted ${i + slice.length}/${chunks.length}`);
    }
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
