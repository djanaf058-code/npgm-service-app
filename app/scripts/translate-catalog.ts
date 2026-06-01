/**
 * RU → EN translation pass for parts catalog, maintenance work items, and
 * pre-shift checklist items. Populates the *_en columns/keys that the UI
 * already falls back through.
 *
 * Run from app/:
 *   pnpm tsx scripts/translate-catalog.ts [--dry-run] [--apply-review <csv>]
 *
 * Uses .env.local for NEXT_PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY,
 * ANTHROPIC_API_KEY. Talks to Supabase via PostgREST (fetch) directly to avoid
 * the WebSocket dependency in supabase-js under Node 20.
 *
 * Two-pass quality control:
 *   - Claude Sonnet returns {translation, confidence, alt?, note?} per input.
 *   - High-confidence translations are written to the DB immediately.
 *   - Low-confidence translations are dumped to a CSV at
 *     scripts/output/translate-catalog-review.csv for human review.
 *   - User edits the CSV and re-runs with --apply-review <csv> to commit.
 *
 * Idempotent: already-translated rows / array items are skipped.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const BATCH_SIZE = 40;
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const REVIEW_CSV = 'scripts/output/translate-catalog-review.csv';

// ----- env --------------------------------------------------------------
function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ----- CLI -------------------------------------------------------------
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const applyIdx = args.indexOf('--apply-review');
const applyPath = applyIdx >= 0 ? args[applyIdx + 1] : null;

// ----- REST helper -----------------------------------------------------
interface Rest {
  get<T>(path: string): Promise<T[]>;
  patch(path: string, body: Record<string, unknown>): Promise<void>;
}

function rest(url: string, key: string): Rest {
  const baseHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  return {
    async get<T>(path: string): Promise<T[]> {
      const resp = await fetch(`${url}/rest/v1/${path}`, { headers: baseHeaders });
      if (!resp.ok) throw new Error(`GET ${path}: ${resp.status} ${await resp.text()}`);
      return (await resp.json()) as T[];
    },
    async patch(path: string, body: Record<string, unknown>): Promise<void> {
      const resp = await fetch(`${url}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: { ...baseHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`PATCH ${path}: ${resp.status} ${await resp.text()}`);
    },
  };
}

// ----- types -----------------------------------------------------------
interface Verdict {
  translation: string;
  confidence: 'high' | 'low';
  alt?: string;
  note?: string;
}

interface PendingInput {
  table: 'parts_catalog' | 'maintenance_schedules' | 'checklist_templates';
  // For direct-column rows (parts_catalog): the column to update.
  column?: 'display_name_en' | 'application_en';
  rowId: string;
  // For JSONB-array rows: index in the array.
  itemIndex?: number;
  ru: string;
}

interface ReviewRow {
  table: string;
  rowId: string;
  column?: string;
  itemIndex?: number;
  ru: string;
  predicted_en: string;
  alt: string;
  note: string;
}

// ----- prompt ----------------------------------------------------------
const SYSTEM_PROMPT = `You are a senior translator specialising in mining-explosives equipment (emulsion-charging MMU machines, NETZSCH pumps, blasting workflows). Translate the following Russian part / work names to professional English used by international suppliers.

Rules:
- Preserve all numbers, units and OEM article codes verbatim (e.g. "НК-25" stays "NK-25", "Ø50" stays "Ø50").
- Use the standard technical English term that an international supplier would use.
- For each input string, output one object {translation, confidence, alt?, note?} where:
  - translation: your best translation;
  - confidence: "high" if the technical term is unambiguous and well-established in English; "low" if you had to guess, the source is jargon/slang/abbreviation you can't expand confidently, or there are multiple plausible translations;
  - alt: an alternative wording (only if confidence is "low");
  - note: one short sentence explaining the uncertainty (only if "low").
- Output ONLY a JSON array of these objects, same length and order as input. No prose outside the JSON, no markdown fences.`;

// ----- Claude batched translator --------------------------------------
async function translateBatch(client: Anthropic, ruStrings: string[]): Promise<Verdict[]> {
  const userPayload = JSON.stringify(ruStrings, null, 2);
  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPayload }],
  });
  const block = resp.content[0];
  if (block.type !== 'text') throw new Error('non-text response from Claude');
  const text = block.text.trim();
  const stripped = text.startsWith('```')
    ? text.replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim()
    : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    console.error('  ! Claude returned non-JSON:', stripped.slice(0, 200));
    throw new Error('parse_failed');
  }
  if (!Array.isArray(parsed) || parsed.length !== ruStrings.length) {
    throw new Error(`Bad shape: got ${Array.isArray(parsed) ? parsed.length : 'non-array'}, want ${ruStrings.length}`);
  }
  return parsed as Verdict[];
}

// ----- CSV helpers -----------------------------------------------------
function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function writeReviewCsv(rows: ReviewRow[]) {
  if (rows.length === 0) return;
  const csvPath = resolve(process.cwd(), REVIEW_CSV);
  mkdirSync(dirname(csvPath), { recursive: true });
  const header = 'table,rowId,column,itemIndex,ru,predicted_en,alt,note';
  const lines = rows.map((r) =>
    [
      r.table,
      r.rowId,
      r.column ?? '',
      r.itemIndex == null ? '' : String(r.itemIndex),
      csvEscape(r.ru),
      csvEscape(r.predicted_en),
      csvEscape(r.alt),
      csvEscape(r.note),
    ].join(',')
  );
  writeFileSync(csvPath, [header, ...lines].join('\n') + '\n', 'utf8');
  console.log(`\n  → review CSV: ${csvPath} (${rows.length} rows)`);
}

function parseCsv(content: string): ReviewRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const header = parseLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);
  const out: ReviewRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    out.push({
      table: cols[idx('table')] ?? '',
      rowId: cols[idx('rowId')] ?? '',
      column: cols[idx('column')] || undefined,
      itemIndex: cols[idx('itemIndex')] ? Number(cols[idx('itemIndex')]) : undefined,
      ru: cols[idx('ru')] ?? '',
      predicted_en: cols[idx('predicted_en')] ?? '',
      alt: cols[idx('alt')] ?? '',
      note: cols[idx('note')] ?? '',
    });
  }
  return out;
}

// ----- main translation passes ----------------------------------------
async function translateAndStore(
  client: Anthropic,
  db: Rest,
  inputs: PendingInput[],
  reviewSink: ReviewRow[]
): Promise<{ written: number; flagged: number }> {
  if (inputs.length === 0) return { written: 0, flagged: 0 };

  let written = 0;
  let flagged = 0;

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const verdicts = await translateBatch(client, batch.map((b) => b.ru));

    // group writes by table+row to coalesce JSONB updates
    const rowGroups = new Map<string, { table: string; rowId: string; items: { idx: number; en: string }[] }>();

    for (let j = 0; j < batch.length; j++) {
      const inp = batch[j];
      const v = verdicts[j];

      if (dryRun) {
        console.log(`  [dry] ${inp.table} ${inp.rowId.slice(0, 8)} "${inp.ru}" → "${v.translation}" (${v.confidence})`);
        continue;
      }

      if (v.confidence === 'low') {
        reviewSink.push({
          table: inp.table,
          rowId: inp.rowId,
          column: inp.column,
          itemIndex: inp.itemIndex,
          ru: inp.ru,
          predicted_en: v.translation,
          alt: v.alt ?? '',
          note: v.note ?? '',
        });
        flagged++;
        continue;
      }

      if (inp.table === 'parts_catalog' && inp.column) {
        try {
          await db.patch(`parts_catalog?id=eq.${inp.rowId}`, { [inp.column]: v.translation });
          written++;
        } catch (e) {
          console.error(`  ! update parts_catalog.${inp.column} ${inp.rowId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else if (inp.itemIndex != null) {
        const key = `${inp.table}:${inp.rowId}`;
        if (!rowGroups.has(key)) {
          rowGroups.set(key, { table: inp.table, rowId: inp.rowId, items: [] });
        }
        rowGroups.get(key)!.items.push({ idx: inp.itemIndex, en: v.translation });
      }
    }

    // commit JSONB updates per row: re-fetch, mutate, PATCH back
    for (const grp of rowGroups.values()) {
      const column = grp.table === 'maintenance_schedules' ? 'work_items' : 'items';
      try {
        const [row] = await db.get<Record<string, unknown>>(`${grp.table}?id=eq.${grp.rowId}&select=id,${column}`);
        if (!row) {
          console.error(`  ! fetch ${grp.table} ${grp.rowId}: not found`);
          continue;
        }
        const arr = (row[column] as Array<Record<string, unknown>>) ?? [];
        for (const it of grp.items) {
          if (arr[it.idx]) arr[it.idx].name_en = it.en;
        }
        await db.patch(`${grp.table}?id=eq.${grp.rowId}`, { [column]: arr });
        written += grp.items.length;
      } catch (e) {
        console.error(`  ! ${grp.table} ${grp.rowId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    process.stdout.write(`.`);
  }
  console.log('');
  return { written, flagged };
}

// ----- collectors -----------------------------------------------------
interface PartsCatalogRow {
  id: string;
  display_name_ru: string;
  display_name_en: string | null;
  application_ru: string | null;
  application_en: string | null;
}

async function collectPartsCatalog(db: Rest): Promise<PendingInput[]> {
  const rows = await db.get<PartsCatalogRow>(
    'parts_catalog?select=id,display_name_ru,display_name_en,application_ru,application_en'
  );
  const out: PendingInput[] = [];
  for (const r of rows) {
    if (!r.display_name_en && r.display_name_ru) {
      out.push({ table: 'parts_catalog', column: 'display_name_en', rowId: r.id, ru: r.display_name_ru });
    }
    if (!r.application_en && r.application_ru) {
      out.push({ table: 'parts_catalog', column: 'application_en', rowId: r.id, ru: r.application_ru });
    }
  }
  return out;
}

async function collectJsonbArray(
  db: Rest,
  table: 'maintenance_schedules' | 'checklist_templates'
): Promise<PendingInput[]> {
  const column = table === 'maintenance_schedules' ? 'work_items' : 'items';
  const rows = await db.get<Record<string, unknown>>(`${table}?select=id,${column}`);
  const out: PendingInput[] = [];
  for (const r of rows) {
    const arr = (r[column] as Array<Record<string, unknown>>) ?? [];
    arr.forEach((item, idx) => {
      const ru = item.name_ru as string | undefined;
      const en = item.name_en as string | undefined;
      if (ru && (!en || en.trim().length === 0)) {
        out.push({ table, rowId: r.id as string, itemIndex: idx, ru });
      }
    });
  }
  return out;
}

// ----- --apply-review mode --------------------------------------------
async function applyReviewCsv(db: Rest, csvPath: string) {
  const content = readFileSync(csvPath, 'utf8');
  const rows = parseCsv(content);
  console.log(`Loaded ${rows.length} review rows from ${csvPath}`);
  let written = 0;
  const rowGroups = new Map<string, { table: string; rowId: string; items: { idx: number; en: string }[] }>();
  for (const r of rows) {
    if (!r.predicted_en || r.predicted_en.trim().length === 0) continue;
    if (r.table === 'parts_catalog' && r.column) {
      try {
        await db.patch(`parts_catalog?id=eq.${r.rowId}`, { [r.column]: r.predicted_en });
        written++;
      } catch (e) {
        console.error(`  ! parts_catalog.${r.column} ${r.rowId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (r.itemIndex != null) {
      const key = `${r.table}:${r.rowId}`;
      if (!rowGroups.has(key)) {
        rowGroups.set(key, { table: r.table, rowId: r.rowId, items: [] });
      }
      rowGroups.get(key)!.items.push({ idx: r.itemIndex, en: r.predicted_en });
    }
  }
  for (const grp of rowGroups.values()) {
    const column = grp.table === 'maintenance_schedules' ? 'work_items' : 'items';
    try {
      const [row] = await db.get<Record<string, unknown>>(`${grp.table}?id=eq.${grp.rowId}&select=id,${column}`);
      if (!row) {
        console.error(`  ! fetch ${grp.table} ${grp.rowId}: not found`);
        continue;
      }
      const arr = (row[column] as Array<Record<string, unknown>>) ?? [];
      for (const it of grp.items) {
        if (arr[it.idx]) arr[it.idx].name_en = it.en;
      }
      await db.patch(`${grp.table}?id=eq.${grp.rowId}`, { [column]: arr });
      written += grp.items.length;
    } catch (e) {
      console.error(`  ! ${grp.table} ${grp.rowId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`Applied ${written} reviewed translations.`);
}

// ----- main -----------------------------------------------------------
async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.PRIVATE_SUPABASE_SERVICE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / PRIVATE_SUPABASE_SERVICE_KEY missing');
  if (!anthropicKey && !applyPath) throw new Error('ANTHROPIC_API_KEY missing');

  const db = rest(url, key);

  if (applyPath) {
    await applyReviewCsv(db, resolve(process.cwd(), applyPath));
    return;
  }

  const client = new Anthropic({ apiKey: anthropicKey });

  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}\n`);

  const reviewSink: ReviewRow[] = [];

  console.log('--- parts_catalog ---');
  const partsInputs = await collectPartsCatalog(db);
  console.log(`  pending: ${partsInputs.length} strings`);
  const partsRes = await translateAndStore(client, db, partsInputs, reviewSink);
  console.log(`  written: ${partsRes.written}, flagged: ${partsRes.flagged}`);

  console.log('\n--- maintenance_schedules.work_items ---');
  const msInputs = await collectJsonbArray(db, 'maintenance_schedules');
  console.log(`  pending: ${msInputs.length} items`);
  const msRes = await translateAndStore(client, db, msInputs, reviewSink);
  console.log(`  written: ${msRes.written}, flagged: ${msRes.flagged}`);

  console.log('\n--- checklist_templates.items ---');
  const clInputs = await collectJsonbArray(db, 'checklist_templates');
  console.log(`  pending: ${clInputs.length} items`);
  const clRes = await translateAndStore(client, db, clInputs, reviewSink);
  console.log(`  written: ${clRes.written}, flagged: ${clRes.flagged}`);

  const totalWritten = partsRes.written + msRes.written + clRes.written;
  const totalFlagged = partsRes.flagged + msRes.flagged + clRes.flagged;
  console.log(`\nDone. Wrote ${totalWritten} high-confidence translations to DB.`);
  if (totalFlagged > 0) {
    writeReviewCsv(reviewSink);
    console.log(`Flagged ${totalFlagged} low-confidence — review the CSV and re-run:`);
    console.log(`  pnpm tsx scripts/translate-catalog.ts --apply-review ${REVIEW_CSV}`);
  } else if (!dryRun) {
    console.log('No low-confidence rows — nothing to review.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
