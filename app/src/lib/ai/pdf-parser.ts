// pdf-parse → text; manual chunking with overlap.
// pdf-parse v2.x exposes per-page text via PDFParse.getText() — we use that
// directly instead of relying on a form-feed (\f) heuristic on the full string.

import { PDFParse } from 'pdf-parse';
import { readFileSync } from 'fs';

export interface ParsedChunk {
  text: string;
  page: number | null;       // null when we can't infer
  section: string | null;
}

export interface ParseOptions {
  targetTokens: number;      // ~400
  overlapTokens: number;     // ~50
}

const CHARS_PER_TOKEN_RU = 3.5;   // conservative for Cyrillic
const CHARS_PER_TOKEN_EN = 4.0;

// Estimate token count from char length. Approximate but stable.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function estimateTokens(s: string, lang: 'ru' | 'en'): number {
  return Math.ceil(s.length / (lang === 'ru' ? CHARS_PER_TOKEN_RU : CHARS_PER_TOKEN_EN));
}

// Extract per-page text. pdf-parse v2.x returns Array<{num, text}>.
// Fallback: split on form-feed (\f) if for some reason pages are empty.
async function extractPages(buf: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    if (result.pages && result.pages.length > 0) {
      // Sort by page number to be safe, then map to text.
      const sorted = [...result.pages].sort((a, b) => a.num - b.num);
      return sorted.map((p) => p.text || '');
    }
    // Fallback to form-feed heuristic on combined text
    if (result.text && result.text.includes('\f')) {
      return result.text.split('\f');
    }
    return result.text ? [result.text] : [];
  } finally {
    await parser.destroy();
  }
}

// Section heuristic: lines that look like "1.2.3 Title" or "ГЛАВА N" / "CHAPTER N".
const SECTION_RE = /^(?:\d+(?:\.\d+){0,3}\s+[A-ZА-ЯЁ][^.]{3,}$|(?:ГЛАВА|CHAPTER)\s+\d+)/m;

function detectSection(chunkText: string): string | null {
  const match = chunkText.match(SECTION_RE);
  return match ? match[0].slice(0, 80) : null;
}

export async function parseAndChunkPdf(
  filePath: string,
  language: 'ru' | 'en',
  opts: ParseOptions = { targetTokens: 400, overlapTokens: 50 }
): Promise<ParsedChunk[]> {
  const buf = readFileSync(filePath);
  const pages = await extractPages(buf);

  const targetChars = Math.floor(
    opts.targetTokens * (language === 'ru' ? CHARS_PER_TOKEN_RU : CHARS_PER_TOKEN_EN)
  );
  const overlapChars = Math.floor(
    opts.overlapTokens * (language === 'ru' ? CHARS_PER_TOKEN_RU : CHARS_PER_TOKEN_EN)
  );

  const chunks: ParsedChunk[] = [];

  pages.forEach((pageText, pageIdx) => {
    const cleaned = pageText.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;

    let start = 0;
    while (start < cleaned.length) {
      const end = Math.min(start + targetChars, cleaned.length);
      const chunkRaw = cleaned.slice(start, end);
      // Try to end at a sentence boundary
      const sentenceEnd = chunkRaw.search(/[.!?][^\w]*$/);
      const adjustedEnd =
        sentenceEnd > targetChars * 0.6 ? start + sentenceEnd + 1 : end;
      const chunkText = cleaned.slice(start, adjustedEnd).trim();
      if (chunkText.length > 30) {
        chunks.push({
          text: chunkText,
          page: pages.length > 1 ? pageIdx + 1 : null,
          section: detectSection(chunkText),
        });
      }
      // advance with overlap
      const nextStart = adjustedEnd - overlapChars;
      // Guard against infinite loop when chunk size is degenerate
      if (nextStart <= start) {
        start = adjustedEnd;
      } else {
        start = nextStart;
      }
      if (adjustedEnd === end && end === cleaned.length) break;
    }
  });

  return chunks;
}

// Helper to estimate ingest cost / row count before running.
export function summarise(chunks: ParsedChunk[]): { count: number; tokens: number } {
  const totalChars = chunks.reduce((a, c) => a + c.text.length, 0);
  return { count: chunks.length, tokens: Math.ceil(totalChars / 3.7) };
}
