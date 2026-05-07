# Database — Migrations & Seeds

Source of truth for the schema is [`docs/architecture/data-model.md`](../docs/architecture/data-model.md). This folder contains the implementation: numbered SQL migrations and reference-data seeds.

## How to apply

### Option A: Supabase Dashboard (simplest, for first-time setup)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Copy each `migrations/000X_*.sql` file in order
3. Paste into a new query and **Run**
4. Then apply the seed files: `seed/000X_*.sql`

### Option B: Supabase CLI (for repeatable workflows)

```bash
# install once
npm install -g supabase

# link the local repo to your remote project
supabase link --project-ref rbjwbhudxlfiutnvsetl

# push all pending migrations
supabase db push
```

The CLI tracks which migrations have been applied via the `supabase_migrations` schema.

### Option C: psql

```bash
psql "$DATABASE_URL" -f db/migrations/0001_init.sql
psql "$DATABASE_URL" -f db/migrations/0002_users.sql
# ... etc
psql "$DATABASE_URL" -f db/seed/0001_machine_types.sql
```

## Migration order

| # | File | Purpose |
|---|---|---|
| 0001 | `migrations/0001_init.sql` | Extensions (pgcrypto, vector), `companies`, `machine_types`, helper stubs |
| 0002 | `migrations/0002_users.sql` | `user_role` enum, `profiles`, signup trigger, real helper functions |
| 0003 | `migrations/0003_machines.sql` | `auger_position` enum, `machines`, `machine_assignments` |
| 0004 | `migrations/0004_manuals.sql` | `manuals`, `manual_chunks` (vector index) |
| 0005 | `migrations/0005_tickets.sql` | `ticket_status`, `message_sender` enums, `tickets`, `ticket_messages` |
| 0006 | `migrations/0006_shifts.sql` | `shifts` |
| 0007 | `migrations/0007_checklists.sql` | `checklist_frequency` enum, `checklist_templates`, `checklist_executions` |
| 0008 | `migrations/0008_parts.sql` | `spare_parts_catalog`, `spare_parts_inventory`, `spare_parts_usage` |
| 0009 | `migrations/0009_maintenance.sql` | `maintenance_*` enums and tables |
| 0010 | `migrations/0010_events.sql` | `events` analytics log |
| 0011 | `migrations/0011_rls.sql` | Enable RLS, install all policies |
| 0012 | `migrations/0012_indexes.sql` | Performance indexes |

| # | File | Purpose |
|---|---|---|
| seed-1 | `seed/0001_machine_types.sql` | МЗВ / МСЗ / МСЗУ / МЗУ reference rows |
| seed-2 | `seed/0002_test_companies.sql` | Dev fixtures (fake tenants) — DO NOT run in production |

## Conventions

- **Never edit a migration that has been pushed to a shared environment.** Add a new numbered migration instead.
- All structure-changing operations are wrapped in `do $$ ... $$` or use `if not exists` to be safely re-runnable on dev.
- Enums are created with `do $$ begin ... exception when duplicate_object ... end $$` so re-running is safe.
- Triggers use `drop trigger if exists` then `create trigger`.

## Verifying after each migration

```sql
-- After 0001
select * from machine_types;  -- should be empty until seed
select extname from pg_extension where extname in ('pgcrypto', 'vector');

-- After 0002
select id, role from profiles;

-- After seeds
select * from machine_types order by id;
```
