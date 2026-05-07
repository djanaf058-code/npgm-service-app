# NPGM Service App

B2B SaaS-платформа для подрядчиков по взрывным работам в горнодобывающей отрасли.

Поддержка операторов смесительно-зарядных машин (СЗМ) и буровых станков НИПИГОРМАШа: чат с сервисными инженерами, плановое ТО, учёт запчастей, чек-листы, план зарядки, поиск по техдокументации.

## Status

🚧 **Active development.** Pilot launch targeted for August 2026 with Modern Chemical & Service Co. (Saudi Arabia) and Gulf Explosives (UAE).

## Tech Stack

- **Frontend:** Next.js 15 + React 19 + TypeScript + TailwindCSS + shadcn/ui
- **Mobile:** PWA (Progressive Web App) — installable on iOS/Android, offline-first
- **Backend (data):** Supabase (Postgres + Auth + Realtime + Storage + Row-Level Security + pgvector)
- **Backend (search):** FastAPI (Python) — semantic search over technical manuals via RAG
- **Embeddings:** Cohere `embed-multilingual-v3` (cross-lingual RU/EN search)
- **Hosting:** Vercel (frontend) + Yandex Cloud / Hetzner (FastAPI)

## Repository Structure

```
.
├── app/                  # Next.js frontend (forked from Razikus/supabase-nextjs-template)
├── ai-service/           # FastAPI service for RAG / semantic search
├── db/
│   ├── migrations/       # Supabase SQL migrations (numbered)
│   └── seed/             # Reference data (machine types, default checklists)
├── docs/
│   ├── architecture/     # ERD, design decisions, system overview
│   └── adr/              # Architecture Decision Records
├── .env.example          # Required environment variables (no secrets)
├── .gitignore
├── LICENSE               # MIT
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Python 3.12+ (for `ai-service`)
- Supabase CLI (`npm install -g supabase`) — for running migrations locally
- A Supabase project (free tier OK for development)

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/djanaf058-code/npgm-service-app.git
   cd npgm-service-app
   ```

2. Copy `.env.example` to `.env.local` and fill in your secrets (do NOT commit `.env.local`):
   ```bash
   cp .env.example .env.local
   ```

3. Install frontend dependencies:
   ```bash
   cd app && pnpm install
   ```

4. Apply database migrations to your Supabase project:
   ```bash
   # via Supabase Dashboard SQL Editor (paste each migration in order)
   # or via CLI:
   supabase db push
   ```

5. Run the development server:
   ```bash
   cd app && pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Development Workflow

- **Branching:** `main` is production. Feature branches: `feature/<sprint>-<short-name>`.
- **Testing:** `pnpm test` (unit/component), `pnpm test:e2e` (Playwright).
- **Migrations:** never edit committed migrations; always add a new numbered file.

## Documentation

- [Data Model (ERD)](docs/architecture/data-model.md) — single source of truth for database schema
- [Architecture Decision Records](docs/adr/) — why we chose certain technologies

## License

MIT — see [LICENSE](LICENSE).

## Contact

This is an early-stage project under active solo development. For inquiries: contact the repository owner.
