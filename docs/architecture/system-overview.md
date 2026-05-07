# System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend                                                        │
│                                                                  │
│  ┌─────────────────────────────┐  ┌────────────────────────────┐│
│  │  Web app (desktop)          │  │  PWA-mobile (operator)     ││
│  │  - service engineers        │  │  - in-field UI             ││
│  │  - project managers         │  │  - offline-first           ││
│  │  - company admins           │  │  - photo upload            ││
│  │  - Tier 2 (platform side)   │  │                            ││
│  └─────────────┬───────────────┘  └─────────────┬──────────────┘│
└────────────────┼──────────────────────────────────┼──────────────┘
                 │ HTTPS                            │
                 ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Next.js 15 (Vercel)                                             │
│  - App Router                                                    │
│  - Server Components for protected reads                         │
│  - API routes for CRUD and webhooks                              │
│  - Supabase JS client (anon key) for user-facing queries        │
│  - Supabase JS client (service role) for admin ops               │
└────────┬─────────────────────────────────────────┬───────────────┘
         │                                         │
         │ supabase-js (REST + Realtime)           │ HTTPS (search,
         ▼                                         │  ingestion API)
┌──────────────────────────────────────┐          │
│  Supabase (managed, US East)         │          ▼
│                                      │  ┌────────────────────┐
│  ┌──────────────────────────────┐    │  │ FastAPI (Python)   │
│  │ Postgres + pgvector + RLS    │◄───┼──┤ Yandex Cloud /     │
│  │ - companies, profiles        │    │  │ Hetzner            │
│  │ - machines, manuals,         │    │  │                    │
│  │   manual_chunks (vector)     │    │  │ Endpoints:         │
│  │ - tickets, ticket_messages   │    │  │  /search           │
│  │ - shifts, checklists         │    │  │  /ingest           │
│  │ - maintenance, parts         │    │  │  /health           │
│  │ - events                     │    │  │                    │
│  └──────────────────────────────┘    │  │ Calls:             │
│                                      │  │  - Cohere API      │
│  ┌──────────────────────────────┐    │  │    (embeddings)    │
│  │ Auth (JWT, MFA optional)     │    │  │  - Supabase REST   │
│  └──────────────────────────────┘    │  │    (service role)  │
│                                      │  └────────────────────┘
│  ┌──────────────────────────────┐    │
│  │ Storage (S3 compatible)      │    │
│  │ - operator photos            │    │
│  │ - PDF manuals (admin only)   │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Realtime (Postgres CDC)      │    │
│  │ - ticket updates             │    │
│  │ - new messages               │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
                                          
┌──────────────────────────────────────────────────────────────────┐
│  External services                                               │
│  - Cohere API (embeddings) — pay-per-use                         │
│  - Anthropic API (NOT in MVP — added in Sprint 5 for AI auto-replies) │
│  - Vercel (hosting + CDN + analytics)                            │
└──────────────────────────────────────────────────────────────────┘
```

## Key flows

### A. Operator raises a ticket (manual mode, MVP)

1. Operator in PWA writes a message + optional photo
2. Photo uploaded directly to Supabase Storage (signed URL from Next.js API route)
3. Next.js API creates `tickets` row + `ticket_messages` row (server-side, with service role to bypass RLS for `events` insert)
4. Supabase Realtime broadcasts the new ticket to Tier 2 dashboard
5. Tier 2 (owner) sees push notification, opens the ticket, may search manuals via FastAPI `/search` endpoint to find relevant РЭ pages
6. Tier 2 replies; reply sent via Next.js API → `ticket_messages` insert; operator sees the response in real time

### B. Operator searches manuals

1. Operator types a query in mobile UI
2. PWA calls Next.js API → forwards to FastAPI `/search`
3. FastAPI: embeds query via Cohere, performs vector search in `manual_chunks` filtered by the operator's machine model, returns top-10 chunks with metadata (page number, section)
4. PWA displays results as cards: "Found in РЭ МСЗУ-14-НПБ, page 47, section ТО"

### C. Daily shift start

1. Operator opens "Start shift" in PWA
2. Daily checklist appears — items pulled from `checklist_templates` for the operator's machine type
3. Operator goes through items, marks each, optionally attaches photos for warning/critical items
4. If any critical item is red → shift is blocked, an auto-ticket is created for Tier 2
5. Otherwise, charging plan form appears; operator fills it; shift starts

### D. Manual ingestion (admin only)

1. Platform admin places PDF in Supabase Storage at `/manuals/{model_code}/{language}/{filename}.pdf`
2. Calls FastAPI `/ingest` endpoint with the storage path
3. FastAPI: downloads PDF, extracts text+images via PyMuPDF4LLM → chunks → embeddings via Cohere → inserts into `manual_chunks`
4. New manual is now searchable

## Security boundaries

| Boundary | What it protects | How |
|---|---|---|
| User → Supabase | Cross-tenant data leakage | Postgres RLS using `auth.uid()` from JWT |
| Operator → Tier 2 ticket | Tier 2 sees only escalated tickets, not full company data | RLS policy: `tier2_engineer` can read tickets only with status in ('new','tier2_responding') |
| Frontend → service role key | Frontend never gets service role | Service role lives only in server-side env (`process.env.SUPABASE_SERVICE_ROLE_KEY`); Next.js API routes are server-only |
| FastAPI → Cohere | Operator data leaving EU | We send only the *query* (a few hundred chars) — never user data, machine details |
| Storage paths | Cross-tenant photo access | Signed URLs scoped per row in `ticket_messages` |
```
