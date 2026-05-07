# ADR 0001 — Initial Stack Choices

**Date:** 2026-05-07
**Status:** Accepted

## Context

We need to choose a foundational stack for a multi-tenant B2B SaaS targeting blasting contractors. Constraints:

- Solo developer for the first 6+ months
- 8–10 week MVP timeline
- Two pilot customers in KSA/UAE (English) + future expansion to RU/CIS
- Manuals are in Russian and English; cross-lingual semantic search required
- AI assistant deferred to post-MVP (validated with humans first)
- Multi-tenant from day 1 (each contractor company is isolated)

## Decision

| Layer | Choice | Alternatives considered |
|---|---|---|
| Frontend | **Next.js 15 + React 19 + TypeScript + Tailwind CSS + shadcn/ui** | Vite + React Router, Remix, SolidStart |
| Mobile | **PWA (Progressive Web App) via Serwist** | React Native, native iOS/Android |
| Auth & data | **Supabase (managed, US East tier-free)** | Self-hosted Postgres + Auth0, Firebase, AWS Cognito |
| RLS | **Postgres Row-Level Security** | App-layer tenant filtering, per-tenant schemas |
| Search | **FastAPI + Cohere `embed-multilingual-v3` + pgvector** | OpenAI embeddings, BGE-M3 self-hosted, ElasticSearch |
| Frontend hosting | **Vercel** | Self-hosted, Cloudflare Pages, Netlify |
| AI service hosting | **Yandex Cloud or Hetzner** | AWS, Render, Fly.io |
| Starter | **[Razikus/supabase-nextjs-template](https://github.com/Razikus/supabase-nextjs-template)** | MakerKit, build from scratch |

## Rationale

### Next.js (vs. Vite)
- Most production-ready Supabase starters target Next.js
- Server Components simplify auth/RLS-protected data fetching
- Built-in API routes for simple CRUD without a separate backend
- Vercel deployment is trivially fast

### Supabase (vs. self-host Postgres)
- All-in-one: Postgres + Auth + Realtime + Storage + Edge Functions
- pgvector first-class support
- Free tier is sufficient for development; Pro ($25/mo) for production
- Open standards underneath: it's just Postgres, easy to migrate later

### Cohere embeddings (vs. self-hosted BGE-M3)
- $5/month on pilot volume vs. $50–100/month for a GPU VM
- 200ms latency vs. ~1s on CPU
- Cross-lingual quality is excellent for RU↔EN
- Easy to swap to BGE-M3 later (same 1024 dimensions) if scale justifies it

### Razikus starter (vs. building from scratch)
- Saves ~3 weeks: Supabase auth, RLS examples, MFA, i18n, theming, shadcn/ui all configured
- MIT-licensed, actively maintained (last commit Dec 2025)
- We strip out: React Native template, Paddle billing (re-add when needed), demo task management

### PWA (vs. native mobile)
- Operators install via "Add to Home Screen" — no App Store dance
- Single codebase
- Can add native mobile in v2 if reviews/ratings/push become important

### Anthropic API NOT in MVP
- AI auto-replies require operator behavioural change ("write to a chat instead of WhatsApp boss") — this hypothesis must be validated before we bake AI into the product
- Owner serves as Tier 2 manually during pilot, replying through the same chat UI
- Accumulated questions+answers become the training dataset for AI v2
- $0 API cost on pilot

## Consequences

### Positive
- ~50% timeline compression (8 weeks vs. 12)
- $0 API cost during pilot
- Standard, hireable stack (Next.js + Supabase + Postgres)
- All secrets/code production-ready from week 1

### Negative
- Locked into Next.js patterns (vs. lighter framework)
- Razikus tenant model may not fit our cross-tenant Tier 2 case → audit in Sprint 0.7
- Cohere is a US-hosted API — embedding queries leave EU (queries only, not user data)

### Neutral
- Two-backend architecture (Next.js API routes + FastAPI for AI) requires keeping two Node/Python codebases in sync
- Forking a starter means we own the maintenance — Razikus updates won't auto-flow

## References

- [Razikus/supabase-nextjs-template](https://github.com/Razikus/supabase-nextjs-template)
- [Cohere embed-multilingual-v3](https://docs.cohere.com/docs/cohere-embed)
- [Anthropic Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — for Sprint 5 when AI is added
- Internal: `docs/specs/2026-05-05-service-platform-design.md`, `docs/specs/2026-05-06-build-accelerators.md`
