# AI Chat — operations guide

This document describes everything needed to bring the AI chat feature online
after the Phase 0–F implementation. Each section is a one-time setup step.

## What was built

- **Phase 0 — i18n:** RU/EN switcher in header, all UI strings translated, locale persisted to `profiles.language`.
- **Phase A — RAG infrastructure:** pgvector + `manual_chunks` table + ingestion pipeline for the 5 PDFs.
- **Phase B — Chat UI:** floating "Ask" button on machine page → drawer → operator messages persist + photo upload.
- **Phase C — AI response:** RAG retrieval + Claude streaming → drawer renders incrementally → confidence parsed from reply.
- **Phase D — Escalation:** auto-escalate <60% confidence; manual button 60-79%; ticket created with full chat history; platform_admin gets Realtime notification.
- **Phase E — Learning loop:** resolved AI tickets → cron worker (`/api/ai/learn` every 5 min via Vercel cron) extracts Q/A pairs → embeds → adds to `manual_chunks` with `verified_at` flag (1.5× retrieval boost).
- **Phase F — Vision:** photos attached in chat get sent to Claude with `{type:'image'}` blocks; Claude "sees" them.

## Setup checklist

### 1. API keys

Add to `app/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
VOYAGE_API_KEY=pa-...
CRON_SECRET=<optional, random 32-byte token>
```

- Get Anthropic key: https://console.anthropic.com → Settings → API Keys → Create
- Get Voyage key: https://dash.voyageai.com → API Keys → Create
- CRON_SECRET is optional in pilot; in production set it and make Vercel cron send `x-cron-secret: <value>` header.

### 2. Apply database migrations (in order!)

Open Supabase SQL Editor and run **separately** (NOT in one paste — see note below):

1. `db/migrations/0032a_ai_enum_extend.sql` — extends `message_sender` enum with `ai` + `platform_admin`. **MUST run alone** because `ALTER TYPE ADD VALUE` can't be inside a transaction.
2. `db/migrations/0032b_ai_chat_rag.sql` — pgvector + 4 new tables + RLS + trigger + tickets/ticket_messages alterations.
3. `db/migrations/0033_search_manual_chunks.sql` — RPC `search_manual_chunks` for retrieval.
4. `db/migrations/0034_ai_chat_photos_bucket.sql` — Storage bucket + policies for photo uploads.

### 3. Enable Realtime for tickets

Supabase Dashboard → **Database** → **Replication** → find `public.tickets` → toggle on.

Without this, platform_admin's `EscalationsListener` won't receive INSERT events when AI escalates.

### 4. Ingest manuals into pgvector

The 5 PDFs in `CODE/manuals/` get parsed, chunked (~400 tokens), embedded via Voyage, and inserted into `manual_chunks`. Run once after migrations applied + Voyage key set:

```bash
cd app
pnpm tsx scripts/ingest-manuals.ts
```

Expected output: ~700-900 chunks total, costs ~$0.20 in Voyage credits.

Re-running is idempotent — old rows for the same `source` are deleted first.

To add new manuals later: edit `MANUALS` array in `scripts/ingest-manuals.ts` and re-run.

### 5. Verify end-to-end

1. Log in as an operator with at least one machine assigned. Open `/app/machines/<id>`.
2. Click the floating "Ask" button (bottom-right).
3. Send a question (e.g. "Машина не запускается, мигает красная лампа"). AI should reply within ~10 s with page references and a `Confidence: NN` line.
4. If confidence < 60: drawer auto-creates a ticket → platform_admin (you, logged in at `/admin/*` in another tab) sees a `confirm()` prompt.
5. Open the ticket → set status to `resolved` with a non-empty `resolution_summary` (currently this needs to be done via Supabase Table Editor — UI for the field is on the todo list).
6. Wait 5 min for the cron, or manually `curl -X POST http://localhost:3000/api/ai/learn -H "x-cron-secret: <secret>"`. Verify a new row appears in `manual_chunks` with `verified_at != null` and `source LIKE 'tier2_resolution:%'`.

## Architecture quick reference

```
Browser (operator) ←──SSE stream──── /api/ai/respond
                                          │
                                          ├──► Anthropic Claude Sonnet 4.6 (Vision-enabled)
                                          ├──► Voyage AI multilingual-2 (embeddings)
                                          └──► Supabase Postgres + pgvector
                                                 ├ manual_chunks (RAG corpus)
                                                 ├ ai_conversations / ai_messages
                                                 └ ai_learning_queue
```

Key endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /api/ai/conversations` | Create/find active conversation for an operator+machine |
| `GET /api/ai/conversations/[id]` | Load conversation + message history |
| `POST /api/ai/messages` | Append a user message |
| `POST /api/ai/respond` | Stream Claude reply (RAG + Vision + confidence) |
| `POST /api/ai/escalate` | Convert conversation to a ticket |
| `POST /api/ai/learn` | Cron worker: extract Q/A pairs from resolved AI tickets, write to manual_chunks |

Key utility modules:

| File | Purpose |
|---|---|
| `src/lib/ai/anthropic.ts` | Claude client + model constant |
| `src/lib/ai/voyage.ts` | Embeddings via Voyage REST |
| `src/lib/ai/pdf-parser.ts` | PDF → chunks (sentence-boundary, with overlap) |
| `src/lib/ai/retrieval.ts` | Vector search via RPC |
| `src/lib/ai/context-loader.ts` | Machine context for prompt |
| `src/lib/ai/prompt-builder.ts` | System prompt + confidence parser |

## Known gaps (to address before pilot)

1. **No UI for `resolution_summary` on ticket resolve.** The learning loop trigger only fires when `tickets.resolution_summary IS NOT NULL`. Platform admin currently must set this via Supabase Table Editor when closing an AI-escalated ticket. **Recommended fix:** add a textarea to the ticket detail page that appears when status is changing to `resolved`, persists `resolution_summary` along with status.
2. **`window.confirm()` for escalation notification.** v1 placeholder; replace with shadcn/ui Toast for better UX.
3. **No retry/backoff on transient API failures** in the ingestion script or `/api/ai/learn`. For our scale this is OK; revisit if Voyage/Anthropic flake under load.
4. **Image URL via public Supabase Storage path.** Claude fetches images by URL. If a bucket is later switched to private, switch to base64 in `respond/route.ts`.
5. **Cron only on Vercel.** `vercel.json` configures cron. If hosting changes (Railway, fly.io, etc.), set up cron externally hitting `/api/ai/learn`.

## Recovery / disable

If AI starts misbehaving (cost spike, hallucinations) and you need a quick off-switch:

1. **Disable Anthropic key** in `.env.local` — drawer will throw on send, no API costs.
2. **Or comment out the auto-respond call** in `AIChatDrawer.tsx` (`await askAI(conversationId);` line in `send()`) — drawer still accepts messages but won't call Claude. Restart dev server.

Conversation data remains intact; you can re-enable later without data loss.

## Cost expectations (pilot, ~3 months, 2 companies)

- Anthropic (Claude Sonnet 4.6 + Vision): **~$20-50** for ~500 conversations with ~3K context + ~1K output average.
- Voyage embeddings: **~$1-2** total (one-time ingest + per-query).
- **Total pilot cost: < $100.**

## Where to find things

- Migrations: `db/migrations/0032a_*.sql`, `0032b_*.sql`, `0033_*.sql`, `0034_*.sql`
- Spec: `docs/superpowers/specs/2026-05-19-ai-chat-rag-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-19-ai-chat-rag-i18n.md`
- This guide: `docs/AI_CHAT.md`
