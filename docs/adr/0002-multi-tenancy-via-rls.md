# ADR 0002 — Multi-Tenancy via Postgres Row-Level Security

**Date:** 2026-05-07
**Status:** Accepted

## Context

We are a B2B SaaS where each customer company (mining contractor) must be fully isolated from every other company. Operators of Modern Chemical must never see data from Gulf Explosives. We also have a **cross-tenant** role — Tier 2 engineers (the platform operator) — who see only escalated tickets from any tenant, not full company data.

Two main approaches exist:

1. **Schema-per-tenant** — each company gets its own Postgres schema or its own database
2. **Shared schema with tenant_id + RLS** — single tables, every row tagged with `company_id`, Postgres RLS enforces filtering

## Decision

We use **shared schema with `company_id` columns and Postgres Row-Level Security**.

## Rationale

### Why not schema-per-tenant
- Complexity in migrations (run on N schemas)
- Hard to query across tenants for platform-level features (Tier 2 view, analytics)
- Connection pooling issues (each schema is a different "search_path")
- Doesn't scale beyond ~50 tenants without operational pain

### Why RLS is ideal here
- **Defence in depth**: even if our application code has a bug and forgets `WHERE company_id = ...`, Postgres still rejects the query at the database level
- Supabase Auth issues JWTs containing `auth.uid()`; we map `uid → company_id` via a SECURITY DEFINER function (`auth.user_company_id()`) and reference it in every policy
- Cross-tenant access (Tier 2) is expressed as additional policies that compose naturally with the base "own company only" policies
- Single migration runs once, covers all tenants

### How we ensure isolation actually holds
- Every multi-tenant table has `company_id` non-null
- Every multi-tenant table has RLS enabled with an explicit "own company" policy
- Foreign keys that span tables within the same tenant get a `CHECK (company_id = ...)` constraint to prevent corrupted cross-tenant references
- A test suite (`tests/integration/db/test_rls_isolation.py`) creates two fake tenants and asserts that user A cannot read/write any row belonging to user B, **across every table**

## Consequences

### Positive
- Defence in depth — bugs in app code don't leak data
- Single schema = simple migrations and operations
- Scales to thousands of tenants without operational change
- Cross-tenant features (Tier 2 view, platform analytics) are clean

### Negative
- RLS policies must be written for every table (one-time cost, mitigated by templates)
- Performance impact on large queries (mitigated by indexes on `(company_id, ...)`)
- Tier 2 cross-tenant policies must be carefully scoped (only specific rows: e.g. only escalated tickets, not the whole tickets table)

### Operational note
- Backend services must use the **service-role** key only when explicitly needed for admin operations (signup webhook, ingestion). All user-facing queries go through the **anon** key, which forces RLS evaluation.

## References

- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Internal: `docs/architecture/data-model.md` (full RLS policy table)
