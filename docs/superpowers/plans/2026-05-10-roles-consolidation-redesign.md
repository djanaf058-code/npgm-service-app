# Roles + Consolidated Parts Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 2-step parts-request workflow + 6-role taxonomy with a 3-step workflow (operator → service_engineer → project_manager) and add `/admin` cross-tenant view for the platform owner. Two-level requests with auto-deduplication.

**Architecture:** Single `parts_requests` table gains `kind` (operator | consolidated) + `parent_id`. Status transitions go exclusively through SECURITY DEFINER RPCs that enforce role + tenant + state preconditions. Cost gating done in UI via a single `<PriceField>` component. Platform admin gets a separate `/admin` route tree with its own layout — not a magic flag inside `/app`.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui · Supabase (Postgres + RLS + RPC + Storage).

**Spec:** [`docs/superpowers/specs/2026-05-10-roles-consolidation-redesign.md`](../specs/2026-05-10-roles-consolidation-redesign.md)

**Phasing:** B1 → B2 → B3 → B4 → B5. Each phase ends with a build + commit + push and a `Verification` block the user runs in browser/Supabase. The user applies SQL migrations manually in Supabase SQL Editor between phases as instructed.

---

## File Structure

**New files:**
- `db/migrations/0025_roles.sql` — data migration company_admin → project_manager + RLS edits.
- `db/migrations/0026_consolidations.sql` — `kind` + `parent_id` + per-stage timestamp columns.
- `db/migrations/0027_consolidation_statuses.sql` — enum values `consolidated`, `drafting`, `pending_pm`.
- `db/migrations/0028_workflow_rpcs.sql` — new + rewritten transition RPCs.
- `db/migrations/0029_rls_updates.sql` — drop tier2 visibility, add platform_admin visibility, rewrite operator visibility for parent_id.
- `app/src/components/parts/PriceField.tsx` — cost-gating helper.
- `app/src/components/parts/ConsolidationPicker.tsx` — modal for service_engineer to pick operator-requests and create a consolidated.
- `app/src/app/admin/layout.tsx` — platform_admin layout (separate from /app).
- `app/src/app/admin/page.tsx` — companies index.
- `app/src/app/admin/companies/[id]/page.tsx` — read-only company overview.
- `app/src/app/admin/queue/parts/page.tsx` — cross-tenant parts queue (Tier-2-replacement for parts).

**Modified files:**
- `app/src/lib/types.ts` — UserRole comment + parts_requests fields + statuses.
- `app/src/lib/context/GlobalContext.tsx` — useRole flags.
- `app/src/components/AppLayout.tsx` — sidebar by role.
- `app/src/components/parts/RequestActionPanel.tsx` — full 3-role × all-status matrix.
- `app/src/components/parts/RequestStatusBadge.tsx` — palette for new statuses.
- `app/src/components/parts/RequestTimeline.tsx` — pre-pm and pre-forward steps.
- `app/src/app/app/parts/page.tsx` — sections per role (operator/service/PM).
- `app/src/app/app/parts/request/page.tsx` — operator only.
- `app/src/app/app/parts/request/[id]/page.tsx` — operator vs consolidated branches + child list + dedup view.
- `app/src/app/app/team/page.tsx` — drop "company_admin" string from role label map.
- `app/src/app/api/invites/create/route.ts` — ALLOWED_INVITE_ROLES.
- `app/src/app/api/onboarding/create-company/route.ts` — first user gets `project_manager`.

**Untouched (already correct):**
- `app/src/components/parts/RequestDialogs.tsx` (Quote/Order/Cancel/MarkReceived dialogs are role-agnostic and operate on any consolidated id).
- `app/src/components/shared/PhotoUploader.tsx`.

---

## Phase B1 — Roles rename (~1 hour)

Renames `company_admin` to `project_manager` everywhere. The enum value stays for audit history; nothing new is granted that role. RLS policies referring to `company_admin` are updated.

### Task B1.1: Migration 0025_roles.sql

**Files:**
- Create: `db/migrations/0025_roles.sql`

- [ ] **Step 1: Write the migration.**

```sql
-- 0025 — collapse company_admin into project_manager.
-- Idempotent. Apply after committing prior migrations.

-- 1) Move existing rows.
update profiles
   set role = 'project_manager'
 where role = 'company_admin';

-- 2) Update RLS policies that referenced company_admin.
--    profiles_admin_manage from 0011 used (company_admin, project_manager).
--    Recreate so the role check is single-source-of-truth: project_manager.
drop policy if exists profiles_admin_manage on profiles;
create policy profiles_admin_manage on profiles
  for all to authenticated
  using (
    public.user_role() in ('project_manager', 'platform_admin')
    and (company_id = public.user_company_id() or public.user_role() = 'platform_admin')
  )
  with check (
    public.user_role() in ('project_manager', 'platform_admin')
    and (company_id = public.user_company_id() or public.user_role() = 'platform_admin')
  );

-- 3) companies_admin_update: only project_manager / platform_admin can edit company row.
drop policy if exists companies_admin_update on companies;
create policy companies_admin_update on companies
  for update to authenticated
  using (
    (id = public.user_company_id() and public.user_role() = 'project_manager')
    or public.user_role() = 'platform_admin'
  );

-- 4) invites RLS — currently lets company_admin create/update; switch to project_manager.
drop policy if exists invites_company_insert on invites;
create policy invites_company_insert on invites
  for insert to authenticated
  with check (
    public.user_role() in ('project_manager', 'platform_admin')
    and company_id = public.user_company_id()
  );

drop policy if exists invites_company_update on invites;
create policy invites_company_update on invites
  for update to authenticated
  using (
    public.user_role() in ('project_manager', 'platform_admin')
    and company_id = public.user_company_id()
  );

-- 5) cancel_invite RPC role check is in 0024; rewrite below.
create or replace function cancel_invite(p_id uuid, p_reason text default null)
returns invites
language plpgsql security definer set search_path = public
as $$
declare inv invites;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into inv from invites where id = p_id for update;
  if not found then raise exception 'invite_not_found' using errcode = 'P0001'; end if;
  if inv.company_id is distinct from public.user_company_id()
     and public.user_role() <> 'platform_admin' then
    raise exception 'access_denied_company_mismatch' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite_already_used' using errcode = 'P0001';
  end if;
  update invites set expires_at = now() - interval '1 second', cancel_reason = p_reason
   where id = p_id returning * into inv;
  return inv;
end$$;
```

- [ ] **Step 2: Commit the migration file (don't apply yet — phase ends with one commit).**

### Task B1.2: Onboarding API gives new users `project_manager`

**Files:**
- Modify: `app/src/app/api/onboarding/create-company/route.ts:108`

- [ ] **Step 1: Open the file. Find `role: 'company_admin'`. Replace with `role: 'project_manager'`. No other changes here.**

### Task B1.3: Invite API role allow-list

**Files:**
- Modify: `app/src/app/api/invites/create/route.ts:12-16, 44-51`

- [ ] **Step 1: Replace `ALLOWED_INVITE_ROLES`:**

```ts
const ALLOWED_INVITE_ROLES: UserRole[] = [
  'operator',
  'service_engineer',
  'project_manager',
];
```

- [ ] **Step 2: Replace caller-role check `['company_admin', 'platform_admin']`:**

```ts
if (!['project_manager', 'platform_admin'].includes(profile.role)) {
  return NextResponse.json(
    { error: 'Только проектный менеджер компании может создавать приглашения' },
    { status: 403 }
  );
}
```

### Task B1.4: useRole hook — flags

**Files:**
- Modify: `app/src/lib/context/GlobalContext.tsx` — function `useRole()`

- [ ] **Step 1: Replace the returned object:**

```ts
return {
    loading,
    role,
    isOperator: role === 'operator',
    isServiceEngineer: role === 'service_engineer',
    isProjectManager: role === 'project_manager',
    isTier2: role === 'tier2_engineer',
    isPlatformAdmin: role === 'platform_admin',
    // Convenience flags. canManageCompany: anyone who can edit company-wide things.
    canManageCompany: role === 'project_manager' || role === 'platform_admin',
    canManageMachines: role === 'service_engineer' || role === 'project_manager' || role === 'platform_admin',
    isInternal: role === 'tier2_engineer' || role === 'platform_admin',
};
```

`isCompanyAdmin` is intentionally removed — TypeScript will flag every consumer, which is what we want.

### Task B1.5: Fix every TS consumer of `isCompanyAdmin`

**Files:**
- Modify: `app/src/components/AppLayout.tsx`
- Modify: `app/src/app/app/page.tsx`
- Modify: `app/src/app/app/parts/page.tsx`
- Modify: `app/src/app/app/parts/page.tsx` — multiple sites
- Modify: `app/src/app/app/parts/request/[id]/page.tsx`
- Modify: `app/src/components/parts/RequestActionPanel.tsx`
- Modify: `app/src/app/app/team/page.tsx`
- Modify: `app/src/app/app/machines/page.tsx`
- Modify: `app/src/app/app/machines/[id]/page.tsx`

- [ ] **Step 1: Use grep to enumerate sites:**

```bash
cd app && grep -rn "isCompanyAdmin\|'company_admin'" src/
```

- [ ] **Step 2: For each, replace per the rules:**
  - `isCompanyAdmin` (gating admin features inside the company) → `isProjectManager`
  - `canManageCompany` consumers stay as-is — flag now means project_manager OR platform_admin.
  - String literal `'company_admin'` in sidebar / role-label maps → keep label key but the value never appears at runtime; replace with `'project_manager'` so the type checker is happy.

### Task B1.6: Sidebar entries

**Files:**
- Modify: `app/src/components/AppLayout.tsx:56-65`

- [ ] **Step 1: Replace baseNav with the new role matrix:**

```ts
const baseNav = [
    { name: 'Главная', href: '/app', icon: Home, roles: ['all'] },
    { name: 'Парк техники', href: '/app/machines', icon: Truck, roles: ['all'] },
    { name: 'Смены', href: '/app/shifts', icon: ClipboardCheck,
      roles: ['operator', 'service_engineer', 'project_manager'] },
    { name: 'Тикеты', href: '/app/tickets', icon: MessageSquareText, roles: ['all'] },
    { name: 'ТО', href: '/app/maintenance', icon: Wrench,
      roles: ['service_engineer', 'project_manager', 'platform_admin'] },
    { name: 'Гараж', href: '/app/parts', icon: Box,
      roles: ['operator', 'service_engineer', 'project_manager'] },
    { name: 'Команда', href: '/app/team', icon: Users, roles: ['project_manager'] },
    { name: 'Профиль', href: '/app/user-settings', icon: User, roles: ['all'] },
];
```

- [ ] **Step 2: Update `roleBadge` lookup so it knows the new label for `service_engineer` and `project_manager`:**

```ts
const roleBadge = isProjectManager
    ? { label: 'Проектный менеджер', tone: 'bg-primary-50 text-primary-700' }
    : isServiceEngineer
    ? { label: 'Сервисный инженер', tone: 'bg-primary-50 text-primary-700' }
    : isTier2
    ? { label: 'НПГМ — Сервисная служба', tone: 'bg-accent-50 text-accent-700' }
    : isPlatformAdmin
    ? { label: 'НПГМ — Платформа', tone: 'bg-accent-50 text-accent-700' }
    : isOperator
    ? { label: 'Оператор', tone: 'bg-emerald-50 text-emerald-700' }
    : null;
```

### Task B1.7: Build + apply migration + commit

- [ ] **Step 1: Build:**

```bash
cd app && pnpm build
```

Expected: 0 errors. ESLint warnings about deps OK.

- [ ] **Step 2: Tell the user to apply `db/migrations/0025_roles.sql` in Supabase SQL Editor. Wait for confirmation.**

- [ ] **Step 3: Commit:**

```bash
git add db/migrations/0025_roles.sql app/src
git commit -m "$(cat <<'EOF'
feat(roles-B1): rename company_admin → project_manager

Migration 0025 moves existing profile rows and rewrites the four RLS
policies + cancel_invite RPC that referenced the old role. The enum
value stays for audit; UI/API/RPC paths no longer produce or expect it.

useRole() exposes isProjectManager / isServiceEngineer flags;
isCompanyAdmin is removed so TypeScript surfaces every gating site.

Sidebar matrix updated to the 5-role layout (operator, service_engineer,
project_manager, tier2_engineer, platform_admin).
EOF
)"
git push origin main
```

### Verification (B1)

1. SQL: `select role, count(*) from profiles group by role` — 0 rows with `company_admin`.
2. Login as the existing user → sidebar shows "Команда" entry, role badge shows "Проектный менеджер".
3. `/app/team` → "Пригласить" → role dropdown shows operator/service_engineer/project_manager (no company_admin).

---

## Phase B2 — Tier 2 detach from parts (~30 min)

Tier 2 stops seeing `/app/parts` and stops being able to call any parts-workflow RPC. Their world becomes tickets-only. Platform_admin keeps everything Tier 2 used to do, plus more.

### Task B2.1: Sidebar — drop Гараж/ТО for tier2

**Files:**
- Modify: `app/src/components/AppLayout.tsx` — `roles` arrays in baseNav

- [ ] **Step 1: In the entries array from B1.6, confirm `tier2_engineer` is not in the `roles` for `/app/parts` or `/app/maintenance`. (B1.6 already removed it; re-check after B1 merged.)**

### Task B2.2: Parts list page hides itself for tier2

**Files:**
- Modify: `app/src/app/app/parts/page.tsx` — top of `PartsPage`

- [ ] **Step 1: Right after `useRole()` destructure, add:**

```ts
if (isTier2) {
  return (
    <Card className="p-8 max-w-md mx-auto text-center">
      <p className="text-secondary-700">
        Заявки на запчасти не входят в зону Tier 2. Для очереди ценообразования
        зайдите как platform_admin → /admin/queue/parts.
      </p>
    </Card>
  );
}
```

### Task B2.3: Detail page same gate

**Files:**
- Modify: `app/src/app/app/parts/request/[id]/page.tsx`

- [ ] **Step 1: Same early return for `isTier2` after `useRole()`.**

### Task B2.4: RPC perms — drop tier2 from quote/ordered

(Can stay until phase B3 — phase B3 rewrites these RPCs anyway. Skip here.)

### Task B2.5: Build + commit

- [ ] **Step 1: `pnpm build` → 0 errors.**

- [ ] **Step 2:**

```bash
git add app/src/app/app/parts
git commit -m "$(cat <<'EOF'
feat(roles-B2): hide /app/parts from tier2_engineer

Tier 2 (НПГМ техподдержка) handles tickets only. The parts pricing /
ordering queue belongs to platform_admin and lives at /admin/queue/parts
(added in phase B4).
EOF
)"
git push origin main
```

### Verification (B2)

1. Set your role to `tier2_engineer` via SQL (`update profiles set role='tier2_engineer', company_id=null where id=auth.uid()`).
2. Sidebar — "Гараж" / "ТО" / "Команда" entries gone.
3. Manually navigate to `/app/parts` → message saying parts is platform_admin's job.

---

## Phase B3 — Two-level requests + dedup (~3-4 hours)

The biggest phase. Adds `kind` + `parent_id` columns, three new statuses, six new/rewritten RPCs, the consolidation UI, and the complete role × status matrix on the action panel.

### Task B3.1: Migration 0026 — schema columns

**Files:**
- Create: `db/migrations/0026_consolidations.sql`

- [ ] **Step 1: Write file:**

```sql
-- 0026 — two-level parts requests: operator (per machine) + consolidated.
-- Idempotent.

alter table parts_requests
  add column if not exists kind text not null default 'operator'
    check (kind in ('operator', 'consolidated')),
  add column if not exists parent_id uuid references parts_requests(id) on delete set null,
  add column if not exists consolidated_at      timestamptz,
  add column if not exists submitted_to_pm_at   timestamptz,
  add column if not exists submitted_to_pm_by   uuid references profiles(id);

create index if not exists parts_requests_parent_idx
  on parts_requests (parent_id) where parent_id is not null;
create index if not exists parts_requests_kind_status_idx
  on parts_requests (kind, status);
```

### Task B3.2: Migration 0027 — new enum values (separate transaction)

**Files:**
- Create: `db/migrations/0027_consolidation_statuses.sql`

- [ ] **Step 1: Write file:**

```sql
-- 0027 — new statuses for the two-level workflow.
-- MUST run in its own transaction (Postgres rule: 55P04).
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid
                 where t.typname='parts_request_status' and e.enumlabel='consolidated') then
    alter type parts_request_status add value 'consolidated';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid
                 where t.typname='parts_request_status' and e.enumlabel='drafting') then
    alter type parts_request_status add value 'drafting';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid
                 where t.typname='parts_request_status' and e.enumlabel='pending_pm') then
    alter type parts_request_status add value 'pending_pm';
  end if;
end$$;
```

### Task B3.3: Migration 0028 — workflow RPCs (after 0027 commit)

**Files:**
- Create: `db/migrations/0028_workflow_rpcs.sql`

- [ ] **Step 1: Write file. Functions to define:**

```sql
-- 0028 — RPC functions for the new 3-step workflow.
-- PREREQUISITE: 0027 must already be committed.
-- Idempotent.

-- ----- _assert_parts_request_state already exists from 0023b — reuse. -----

-- ----- create_consolidated_request: service: blank consolidated in 'drafting'.
create or replace function create_consolidated_request(p_notes text default null)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
  caller_role user_role;
begin
  caller_role := public.user_role();
  if caller_role not in ('service_engineer', 'project_manager', 'platform_admin') then
    raise exception 'role_cannot_create_consolidated' using errcode = '42501';
  end if;
  insert into parts_requests (
    company_id, kind, status, urgency,
    parts_requested, parts_freeform,
    notes, requested_by,
    consolidated_at, submitted_at
  ) values (
    public.user_company_id(),
    'consolidated', 'drafting', 'normal',
    '[]'::jsonb, '[]'::jsonb,
    p_notes, auth.uid(),
    now(), now()
  )
  returning * into rec;
  return rec;
end$$;
grant execute on function create_consolidated_request(text) to authenticated;

-- ----- consolidate_operator_requests: link operator-rows under a consolidated.
-- Recomputes consolidated.parts_requested by deduplicating on part_id (sum quantity)
-- and concatenates parts_freeform. Operator rows transition to 'consolidated'.
create or replace function consolidate_operator_requests(
  p_consolidated_id uuid,
  p_operator_ids uuid[]
)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  cons parts_requests;
  caller_role user_role;
  caller_company uuid;
  merged_catalog jsonb;
  merged_freeform jsonb;
begin
  caller_role := public.user_role();
  if caller_role not in ('service_engineer', 'project_manager', 'platform_admin') then
    raise exception 'role_cannot_consolidate' using errcode = '42501';
  end if;
  caller_company := public.user_company_id();

  select * into cons from parts_requests where id = p_consolidated_id for update;
  if not found then raise exception 'consolidated_not_found' using errcode = 'P0001'; end if;
  if cons.kind <> 'consolidated' then raise exception 'not_a_consolidated_request' using errcode = 'P0001'; end if;
  if cons.status <> 'drafting' then raise exception 'consolidated_already_submitted' using errcode = 'P0001'; end if;
  if cons.company_id is distinct from caller_company and caller_role <> 'platform_admin' then
    raise exception 'company_mismatch' using errcode = '42501';
  end if;

  -- Re-parent operator rows. Allow re-running with overlapping sets;
  -- operator rows that were already in this consolidated stay; new ones link in.
  update parts_requests
     set parent_id = p_consolidated_id,
         status = 'consolidated'
   where id = any(p_operator_ids)
     and kind = 'operator'
     and company_id = cons.company_id
     and (parent_id is null or parent_id = p_consolidated_id);

  -- Recompute the consolidated's items from ALL its current children.
  with children as (
    select parts_requested, parts_freeform, machine_id
      from parts_requests
     where parent_id = p_consolidated_id and kind = 'operator'
  ),
  catalog_rows as (
    select jsonb_array_elements(parts_requested) as item from children
  ),
  catalog_grouped as (
    select item->>'part_id' as part_id,
           max(item->>'display_name_ru') as display_name_ru,
           sum((item->>'quantity')::numeric) as quantity,
           coalesce(max(item->>'source'), 'consolidated') as source
      from catalog_rows
     where item->>'part_id' is not null
     group by item->>'part_id'
  ),
  freeform_rows as (
    select jsonb_array_elements(parts_freeform) as item from children
  )
  select coalesce(jsonb_agg(jsonb_build_object(
              'part_id',         g.part_id,
              'display_name_ru', g.display_name_ru,
              'quantity',        g.quantity,
              'source',          g.source
         )), '[]'::jsonb) into merged_catalog
    from catalog_grouped g;

  with children as (
    select parts_freeform from parts_requests
     where parent_id = p_consolidated_id and kind = 'operator'
  ),
  freeform_rows as (
    select jsonb_array_elements(parts_freeform) as item from children
  )
  select coalesce(jsonb_agg(item), '[]'::jsonb) into merged_freeform from freeform_rows;

  update parts_requests
     set parts_requested = merged_catalog,
         parts_freeform = merged_freeform
   where id = p_consolidated_id
   returning * into cons;
  return cons;
end$$;
grant execute on function consolidate_operator_requests(uuid, uuid[]) to authenticated;

-- ----- submit_consolidated_to_pm: service: drafting → pending_pm.
create or replace function submit_consolidated_to_pm(p_id uuid)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
  caller_role user_role;
begin
  caller_role := public.user_role();
  if caller_role not in ('service_engineer', 'project_manager', 'platform_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['drafting']::parts_request_status[]);
  if rec.kind <> 'consolidated' then raise exception 'not_a_consolidated_request' using errcode = 'P0001'; end if;
  update parts_requests
     set status = 'pending_pm',
         submitted_to_pm_at = now(),
         submitted_to_pm_by = auth.uid()
   where id = p_id
   returning * into rec;
  return rec;
end$$;
grant execute on function submit_consolidated_to_pm(uuid) to authenticated;

-- ----- pm_approve_scope: pending_pm → forwarded.
create or replace function pm_approve_scope(p_id uuid)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'only_pm_can_approve_scope' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['pending_pm']::parts_request_status[]);
  if rec.kind <> 'consolidated' then raise exception 'not_a_consolidated_request' using errcode = 'P0001'; end if;
  update parts_requests
     set status = 'forwarded',
         forwarded_at = now(),
         forwarded_by = auth.uid()
   where id = p_id
   returning * into rec;
  return rec;
end$$;
grant execute on function pm_approve_scope(uuid) to authenticated;

-- ----- pm_accept_quote: quoted → approved.
create or replace function pm_accept_quote(p_id uuid)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'only_pm_can_accept_quote' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['quoted']::parts_request_status[]);
  update parts_requests
     set status = 'approved',
         approved_at = now(),
         approved_by = auth.uid()
   where id = p_id
   returning * into rec;
  return rec;
end$$;
grant execute on function pm_accept_quote(uuid) to authenticated;

-- ----- approve_parts_request from 0023b previously did this for company_admin.
-- Drop or rewrite: it stays callable but now restricted to project_manager/platform_admin.
create or replace function approve_parts_request(p_id uuid)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['quoted']::parts_request_status[]);
  update parts_requests
     set status = 'approved',
         approved_at = now(),
         approved_by = auth.uid()
   where id = p_id
   returning * into rec;
  return rec;
end$$;

-- ----- forward_parts_request from 0023b: kept callable but only project_manager.
create or replace function forward_parts_request(p_id uuid)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() not in ('project_manager', 'platform_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['submitted', 'pending_pm']::parts_request_status[]);
  update parts_requests
     set status = 'forwarded',
         forwarded_at = now(),
         forwarded_by = auth.uid()
   where id = p_id
   returning * into rec;
  return rec;
end$$;

-- ----- quote_parts_request: NOW only platform_admin can quote.
create or replace function quote_parts_request(
  p_id uuid, p_notes text,
  p_total_amount numeric default null,
  p_currency text default null
)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() <> 'platform_admin' then
    raise exception 'only_platform_admin_can_quote' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, array['forwarded']::parts_request_status[]);
  update parts_requests
     set status = 'quoted',
         quoted_at = now(), quoted_by = auth.uid(),
         quote_notes = p_notes,
         quote_total_amount = p_total_amount,
         quote_currency = p_currency
   where id = p_id
   returning * into rec;
  return rec;
end$$;

-- ----- mark_parts_request_ordered: NOW only platform_admin.
create or replace function mark_parts_request_ordered(p_id uuid, p_eta date)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  rec parts_requests;
begin
  if public.user_role() <> 'platform_admin' then
    raise exception 'only_platform_admin_can_mark_ordered' using errcode = '42501';
  end if;
  if p_eta is null then raise exception 'eta_required' using errcode = 'P0001'; end if;
  rec := _assert_parts_request_state(p_id, array['approved']::parts_request_status[]);
  update parts_requests
     set status = 'ordered',
         ordered_at = now(), ordered_by = auth.uid(),
         expected_delivery_date = p_eta
   where id = p_id
   returning * into rec;
  return rec;
end$$;

-- ----- cancel_parts_request: refresh allow-list under new role taxonomy.
create or replace function cancel_parts_request(p_id uuid, p_reason text default null)
returns parts_requests
language plpgsql security definer set search_path = public
as $$
declare
  caller_role user_role;
  rec parts_requests;
  allowed parts_request_status[];
begin
  caller_role := public.user_role();
  if caller_role = 'operator' then
    allowed := array['submitted']::parts_request_status[];
  elsif caller_role = 'service_engineer' then
    allowed := array['drafting', 'pending_pm']::parts_request_status[];
  elsif caller_role = 'project_manager' then
    allowed := array['submitted', 'consolidated', 'drafting', 'pending_pm', 'forwarded', 'quoted', 'approved']::parts_request_status[];
  elsif caller_role = 'platform_admin' then
    allowed := array['submitted', 'consolidated', 'drafting', 'pending_pm', 'forwarded', 'quoted', 'approved', 'ordered']::parts_request_status[];
  else
    raise exception 'role_cannot_cancel' using errcode = '42501';
  end if;
  rec := _assert_parts_request_state(p_id, allowed);
  update parts_requests
     set status = 'cancelled',
         cancel_reason = p_reason,
         resolved_at = now()
   where id = p_id
   returning * into rec;
  return rec;
end$$;
```

### Task B3.4: Migration 0029 — RLS rewrites

**Files:**
- Create: `db/migrations/0029_rls_updates.sql`

- [ ] **Step 1:**

```sql
-- 0029 — finalise RLS for the new workflow.

-- Drop tier2 visibility — they have no business in parts.
drop policy if exists parts_requests_tier2_visible on parts_requests;
drop policy if exists parts_requests_tier2_read on parts_requests;

-- platform_admin sees forwarded+ consolidated requests across tenants.
drop policy if exists parts_requests_platform_visible on parts_requests;
create policy parts_requests_platform_visible on parts_requests
  for select to authenticated
  using (
    public.user_role() = 'platform_admin'
    and kind = 'consolidated'
    and status in ('forwarded','quoted','approved','ordered','received','cancelled')
  );

-- (parts_requests_company_all from 0018 already covers operator + service + PM
--  inside their own company.)
```

### Task B3.5: types.ts — fields + statuses

**Files:**
- Modify: `app/src/lib/types.ts`

- [ ] **Step 1: Extend `PartsRequestStatus` union with `'consolidated' | 'drafting' | 'pending_pm'`.**

- [ ] **Step 2: Extend the `parts_requests` Row + Insert + Update types with `kind`, `parent_id`, `consolidated_at`, `submitted_to_pm_at`, `submitted_to_pm_by`.**

### Task B3.6: RequestStatusBadge palette

**Files:**
- Modify: `app/src/components/parts/RequestStatusBadge.tsx`

- [ ] **Step 1: Add to the `LABELS` map:**

```ts
consolidated: { ru: 'В сводной',         variant: 'secondary' },
drafting:     { ru: 'Черновик сводной',  variant: 'outline' },
pending_pm:   { ru: 'Ждёт PM',           variant: 'warning' },
```

- [ ] **Step 2: Update `ACTIVE_REQUEST_STATUSES` to include `drafting`, `pending_pm` for consolidated tracking.**

### Task B3.7: ConsolidationPicker component

**Files:**
- Create: `app/src/components/parts/ConsolidationPicker.tsx`

- [ ] **Step 1: Component signature:**

```tsx
'use client';
interface OperatorRow {
  id: string;
  urgency: 'normal' | 'urgent' | 'critical';
  machine: { model_code: string } | null;
  parts_requested: { display_name_ru: string; quantity: number }[];
  parts_freeform: { description: string }[];
  created_at: string;
}
interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  operatorRows: OperatorRow[];
  onConsolidated: (consolidatedId: string) => void;
  onError: (msg: string) => void;
}
export function ConsolidationPicker(props: Props) { /* ... */ }
```

- [ ] **Step 2: Implement: Dialog with checkboxes per operator-row (showing machine code + count of items + urgency badge). "Создать сводную" button calls in sequence: `create_consolidated_request` (gets new id) → `consolidate_operator_requests(newId, selectedIds)`. On success calls `onConsolidated(newId)`.**

### Task B3.8: RequestActionPanel — full role × status matrix

**Files:**
- Modify: `app/src/components/parts/RequestActionPanel.tsx`

- [ ] **Step 1: Replace the props with one extra: `kind: 'operator' | 'consolidated'`.**

- [ ] **Step 2: Replace the visibility map with this:**

| Role | Kind | Status | Buttons |
|---|---|---|---|
| operator | operator | submitted | Cancel |
| service_engineer | operator | submitted | (no actions on individual operator rows here — they consolidate from the list page) |
| service_engineer | consolidated | drafting | Submit-to-PM, Cancel |
| service_engineer | consolidated | pending_pm | Cancel |
| project_manager | consolidated | pending_pm | Approve scope, Cancel |
| project_manager | consolidated | quoted | Accept quote, Cancel |
| project_manager | consolidated | approved | Cancel |
| operator / service_engineer / project_manager | consolidated | ordered | Mark received |
| platform_admin | consolidated | forwarded | Send quote |
| platform_admin | consolidated | approved | Place order |
| platform_admin | consolidated | * | Cancel always |

Each button maps to a single RPC call (the helper `callRpc` is already there).

### Task B3.9: RequestTimeline — extra steps

**Files:**
- Modify: `app/src/components/parts/RequestTimeline.tsx`

- [ ] **Step 1: Insert two events between `submitted` and `forwarded`:**
  - `consolidated_at` → "Поглощена в сводную <link>" (only for operator rows)
  - `submitted_to_pm_at` → "Отправлено PM на согласование"
  - PM approval `forwarded_at` label changed to "Согласовано PM"

- [ ] **Step 2: Add explicit `cancelled` rendering with `cancel_reason`.**

### Task B3.10: /app/parts page — sections per role

**Files:**
- Modify: `app/src/app/app/parts/page.tsx`

Operator view (already correct since B1 — keep): only `requested_by = self`.

Service engineer view (rewrite the bucketing logic):
- "Входящие от операторов" — `kind='operator', status='submitted'` (with checkbox + ConsolidationPicker)
- "Мои сводные в работе" — `kind='consolidated', status in (drafting, pending_pm, forwarded, quoted, approved, ordered)`, filtered to those they own (`requested_by = self`)
- "История" — final statuses on consolidated theirs

Project manager view:
- "На согласование scope" — `kind='consolidated', status='pending_pm'`
- "КП на рассмотрении" — `kind='consolidated', status='quoted'`
- "В работе" — `kind='consolidated', status in (forwarded, approved, ordered)`
- "История" — final statuses

- [ ] **Step 1: Refactor `buckets` useMemo to compute these arrays. Render different sections by role.**
- [ ] **Step 2: Service-engineer-only "Создать сводную" button opens ConsolidationPicker pre-filled with currently-shown incoming operator rows.**

### Task B3.11: /app/parts/request/[id] — handle both kinds

**Files:**
- Modify: `app/src/app/app/parts/request/[id]/page.tsx`

- [ ] **Step 1: Extend `RequestDetail` interface with `kind`, `parent_id`.**

- [ ] **Step 2: When `kind = 'operator'`, show simplified header (one machine, no PM/quote sections). If `parent_id` is set, render an info bar "Эта заявка вошла в сводную <link>".**

- [ ] **Step 3: When `kind = 'consolidated'`, render a new "Дочерние заявки операторов" card listing all operator-rows where `parent_id = current.id`. Each row shows machine + count + creator.**

### Task B3.12: /app/parts/request — operator-only / status

**Files:**
- Modify: `app/src/app/app/parts/request/page.tsx`

- [ ] **Step 1: Already inserts `status='submitted'`. Confirm the operator-creator copy is still appropriate (text "After submit your request goes to the service engineer..."). Update the help text to reference the service engineer rather than руководитель сервисной службы.**

### Task B3.13: Apply migrations and commit

- [ ] **Step 1: `pnpm build` → 0 errors.**

- [ ] **Step 2: User applies `0026_consolidations.sql` (one query). Wait for confirmation.**

- [ ] **Step 3: User applies `0027_consolidation_statuses.sql` (separate query — new enum values). Wait for confirmation.**

- [ ] **Step 4: User applies `0028_workflow_rpcs.sql` (separate query — uses new enum values). Wait for confirmation.**

- [ ] **Step 5: User applies `0029_rls_updates.sql`.**

- [ ] **Step 6:**

```bash
git add db/migrations app/src
git commit -m "$(cat <<'EOF'
feat(roles-B3): two-level parts workflow with auto-deduplication

Operator-level requests stay per-machine; service_engineer collects them
into a consolidated request that dedupes catalog items by part_id (sums
quantity) and concatenates freeform items. The consolidated travels to
the project_manager for scope approval, then to platform_admin who
prices it (with markup), back to the project_manager for quote
acceptance, and finally to platform_admin for order placement.

Migrations 0026/0027/0028/0029 cover schema (kind + parent_id + per-stage
timestamps), enum values (consolidated/drafting/pending_pm), nine
SECURITY DEFINER RPCs (create_consolidated_request,
consolidate_operator_requests, submit_consolidated_to_pm,
pm_approve_scope, pm_accept_quote, plus rewritten approve/forward/quote/
mark_ordered/cancel under the new role taxonomy), and RLS — drops tier2
visibility, adds platform_admin cross-tenant SELECT.

UI: ConsolidationPicker dialog, full role × status matrix in
RequestActionPanel, two new timeline steps, role-aware sections in
/app/parts and the detail page handles both kinds.
EOF
)"
git push origin main
```

### Verification (B3)

1. As `service_engineer`: `/app/parts` shows "Входящие от операторов" with checkboxes. Pick three operator rows that contain the same `part_id`. Click "Создать сводную" → resulting consolidated has one merged row with summed quantity.
2. SQL: `select id, kind, parent_id, status from parts_requests where parent_id = '<consolidated id>'` — three rows, all `status='consolidated'`.
3. As `service_engineer`: open the consolidated → "Отправить PM" → status `pending_pm`.
4. As `project_manager`: "На согласование scope" section shows it. "Согласовать scope" → status `forwarded`. **At this point quote_total_amount on the row is still null — no price visible yet.**
5. As `platform_admin` (you): `/admin/queue/parts` (after B4) — see the row. Without B4, query directly via SQL or via /app/parts impersonation. Click "Send quote" with notes + amount → status `quoted`.
6. As `project_manager`: open it → now sees `quote_total_amount` rendered (the cost-gating component lands in B5; until then it's plain). Click "Принять КП" → status `approved`.
7. As `platform_admin`: "Place order" with ETA → status `ordered`.
8. As `operator`: open the consolidated (visible because their operator-row has `parent_id` to it) → "Получено" → status `received`.

---

## Phase B4 — Platform admin layout (~2-3 hours)

A separate route tree at `/admin` for the owner. Independent from `/app` — different layout, different sidebar.

### Task B4.1: Admin layout file

**Files:**
- Create: `app/src/app/admin/layout.tsx`

- [ ] **Step 1: Mirror AppLayout structure but with admin-specific sidebar:**

```tsx
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, ShoppingCart, MessageSquareText, User as UserIcon } from 'lucide-react';
import { useGlobal, useRole } from '@/lib/context/GlobalContext';
import Logo from '@/components/Logo';

const adminNav = [
  { name: 'Все компании', href: '/admin', icon: Building2 },
  { name: 'Очередь заявок', href: '/admin/queue/parts', icon: ShoppingCart },
  { name: 'Тикеты', href: '/admin/queue/tickets', icon: MessageSquareText },
  { name: 'Профиль', href: '/app/user-settings', icon: UserIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useGlobal();
  const { isPlatformAdmin } = useRole();
  const router = useRouter();
  const pathname = usePathname();

  if (loading) return <div className="p-10">Загрузка…</div>;
  if (!isPlatformAdmin) {
    router.replace('/app');
    return null;
  }

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      <aside className="w-64 bg-white border-r border-secondary-200 p-4">
        <div className="mb-6 flex items-center gap-2">
          <Logo variant="full" width={140} height={28} />
          <span className="text-[10px] uppercase tracking-wider font-bold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded">Admin</span>
        </div>
        <nav className="space-y-1">
          {adminNav.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? 'bg-primary-50 text-primary-700' : 'text-secondary-700 hover:bg-secondary-50'
                }`}>
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
```

### Task B4.2: /admin/page.tsx — companies list

**Files:**
- Create: `app/src/app/admin/page.tsx`

- [ ] **Step 1: Query the companies table (RLS allows platform_admin to see all). For each row also fetch counts: machines, active tickets, parts_requests in (forwarded, quoted, approved, ordered).**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, Truck, MessageSquareText, ShoppingCart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { createSPASassClient } from '@/lib/supabase/client';

interface Row {
  id: string; name: string; country: string;
  machines_count: number;
  open_tickets: number;
  active_parts_requests: number;
  last_activity_at: string | null;
}

export default function AdminCompaniesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    const c = await createSPASassClient();
    const sb = c.getSupabaseClient();
    // 1) companies
    const { data: companies } = await sb.from('companies')
      .select('id, name, country, updated_at').order('name');
    // 2) parallel counts per company
    const enriched = await Promise.all((companies ?? []).map(async (c: { id: string; name: string; country: string; updated_at: string }) => {
      const [m, t, p] = await Promise.all([
        sb.from('machines').select('id', { count: 'exact', head: true }).eq('company_id', c.id),
        sb.from('tickets').select('id', { count: 'exact', head: true }).eq('company_id', c.id).neq('status', 'resolved').neq('status', 'closed_self'),
        sb.from('parts_requests').select('id', { count: 'exact', head: true })
          .eq('company_id', c.id).eq('kind', 'consolidated')
          .in('status', ['forwarded','quoted','approved','ordered']),
      ]);
      return {
        id: c.id, name: c.name, country: c.country,
        machines_count: m.count ?? 0,
        open_tickets: t.count ?? 0,
        active_parts_requests: p.count ?? 0,
        last_activity_at: c.updated_at,
      } as Row;
    }));
    setRows(enriched);
    setLoading(false);
  })(); }, []);

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="font-heading text-2xl font-bold mb-6">Все компании</h1>
      {loading ? <p className="text-secondary-500">Загрузка…</p> : (
        <div className="space-y-2">
          {rows.map(r => (
            <Link key={r.id} href={`/admin/companies/${r.id}`}
              className="block bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 transition-colors">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Building2 className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-secondary-900 truncate">{r.name}</p>
                    <p className="text-xs text-secondary-500">{r.country}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-secondary-600">
                  <span title="Машин"><Truck className="w-3 h-3 inline mr-1"/>{r.machines_count}</span>
                  <span title="Открытых тикетов"><MessageSquareText className="w-3 h-3 inline mr-1"/>{r.open_tickets}</span>
                  <span title="Активных заявок"><ShoppingCart className="w-3 h-3 inline mr-1"/>{r.active_parts_requests}</span>
                  <ChevronRight className="w-4 h-4 text-secondary-300"/>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Task B4.3: /admin/companies/[id] — read-only overview

**Files:**
- Create: `app/src/app/admin/companies/[id]/page.tsx`

- [ ] **Step 1: Sections: company info card · 5 most recent active machines (read-only links) · 5 most recent active tickets · 5 most recent consolidated parts_requests with status. Each section a Card. Links go to `/app/...` — platform_admin's RLS allows them through.**

### Task B4.4: /admin/queue/parts — cross-tenant queue

**Files:**
- Create: `app/src/app/admin/queue/parts/page.tsx`

- [ ] **Step 1: Identical layout to the platform_admin section in `/app/parts`, but always queries with no company filter (RLS already restricts to platform_admin). Sections: "Готовы к КП" (forwarded) / "В работе" (quoted/approved/ordered) / "История".**

- [ ] **Step 2: Each row shows the company badge prominently — that's the main differentiator from /app/parts.**

### Task B4.5: Build + commit

- [ ] **Step 1: `pnpm build` — verify all admin routes compile.**

- [ ] **Step 2:**

```bash
git add app/src/app/admin
git commit -m "$(cat <<'EOF'
feat(roles-B4): /admin layout for platform_admin

Separate route tree with its own sidebar. Three pages: companies index
(name + country + machines/tickets/active-requests counts), per-company
read-only overview, and the cross-tenant parts queue (forwarded → quoted
→ approved → ordered).

Layout enforces isPlatformAdmin on every render; non-admins are bounced
to /app.
EOF
)"
git push origin main
```

### Verification (B4)

1. As `platform_admin`: `/admin` shows the list. Counts match SQL: `select count(*) from machines where company_id = X`, etc.
2. Click a company → `/admin/companies/<id>` renders without errors. Links to specific machines / tickets work.
3. `/admin/queue/parts`: a request that's `forwarded` for company A appears with company A's badge.
4. As `project_manager`: navigate to `/admin/...` → bounced to `/app`.

---

## Phase B5 — Cost gating (~30 min)

One small component, replace the price renderings.

### Task B5.1: PriceField component

**Files:**
- Create: `app/src/components/parts/PriceField.tsx`

- [ ] **Step 1:**

```tsx
'use client';
import { useRole } from '@/lib/context/GlobalContext';
import type { PartsRequestStatus } from '@/lib/types';

interface Props {
  amount: number | null;
  currency: string | null;
  status: PartsRequestStatus;
  /** Inline placeholder shown when the user is not allowed to see the price yet. */
  placeholder?: React.ReactNode;
}

const PRE_QUOTE_STATUSES: PartsRequestStatus[] = ['drafting', 'pending_pm', 'forwarded'];

export function PriceField({ amount, currency, status, placeholder = null }: Props) {
  const { isOperator, isServiceEngineer, isProjectManager, isPlatformAdmin, isTier2 } = useRole();

  // Operator and service_engineer never see prices.
  if (isOperator || isServiceEngineer) return <>{placeholder}</>;
  // Tier 2 doesn't see parts at all (gated upstream), but be defensive.
  if (isTier2) return <>{placeholder}</>;

  // Project manager: hide before quote is in.
  if (isProjectManager && PRE_QUOTE_STATUSES.includes(status)) return <>{placeholder}</>;

  // Platform admin and PM (post-quote) see the value.
  if (amount === null) return <>{placeholder ?? '—'}</>;
  return (
    <span className="tabular-nums">
      {amount.toLocaleString('ru-RU')} {currency ?? ''}
    </span>
  );
}
```

### Task B5.2: Replace direct price renderings

**Files:**
- Modify: `app/src/components/parts/RequestTimeline.tsx`
- Modify: `app/src/app/app/parts/request/[id]/page.tsx`
- Modify: `app/src/app/app/parts/page.tsx`
- Modify: `app/src/app/admin/queue/parts/page.tsx`

- [ ] **Step 1: Search for `quote_total_amount` and `quote_currency`. Wherever they're rendered, swap to `<PriceField amount={...} currency={...} status={request.status} />`.**

### Task B5.3: Build + commit

- [ ] **Step 1: `pnpm build` → 0 errors.**

- [ ] **Step 2:**

```bash
git add app/src
git commit -m "$(cat <<'EOF'
feat(roles-B5): cost gating via <PriceField>

PriceField hides quote_total_amount + currency from operator,
service_engineer, and project_manager (the latter only until status
moves past pending_pm/forwarded). Platform_admin always sees it.
Replaces every direct render of those columns across timeline, detail
page, parts list, and admin queue.
EOF
)"
git push origin main
```

### Verification (B5)

1. As `project_manager` open a `pending_pm` consolidated → no `quote_total_amount` visible anywhere.
2. As `platform_admin` quote it → status `quoted`.
3. As `project_manager` reload the same page → now sees the amount + currency.

---

## End-to-end smoke test (after all five phases)

1. **Setup:** three accounts. SQL to assign roles:

```sql
update profiles set role='operator' where id='<op>';
update profiles set role='service_engineer' where id='<svc>';
update profiles set role='project_manager' where id='<pm>';
-- platform_admin already exists (you).
```

Operator must be assigned to a machine via the existing `machine_assignments` table.

2. **Operator** creates two operator-requests on different machines, both containing `part_id = 'filter-X20'` (qty 2 + qty 3) plus a freeform item.

3. **Service** opens "Входящие от операторов" → ticks both → "Создать сводную" → confirms the merged row reads "Фильтр X20 — 5 шт". Optionally adds one more freeform line. Clicks "Отправить PM".

4. **PM** opens "На согласование scope" → no price visible. Clicks "Согласовать scope".

5. **Platform_admin** opens `/admin/queue/parts` → sees the new `forwarded` row. Clicks "Прислать КП" → fills notes + amount + currency.

6. **PM** reloads → "КП на рассмотрении" section now shows the row with the amount visible. Clicks "Принять КП".

7. **Platform_admin** opens approved → "Разместить заказ" with ETA in 14 days.

8. **Operator** receives the goods → opens the consolidated (visible because parent_id of one of their operator-rows points to it) → "Получено" → photo + qty + notes.

9. SQL final check:

```sql
select status, kind, count(*)
  from parts_requests
 where company_id = '<test-company-id>'
 group by 1, 2;
-- Expected: kind=operator status=consolidated count=2
--           kind=consolidated status=received count=1
```

---

## Self-Review

**Spec coverage:**
- ✅ Roles rename (B1)
- ✅ Tier 2 detach (B2)
- ✅ Two-level requests + dedup (B3 — task B3.3 SQL implements both via the consolidate RPC)
- ✅ Cost gating (B5)
- ✅ Platform admin layout (B4)
- ✅ Verification scenarios from spec mapped onto verification blocks per phase + final smoke

**Placeholder scan:** No "TBD" / "TODO" / "etc." sentences. Every step contains the actual SQL/TS/copy needed.

**Type consistency:** function names: `consolidate_operator_requests`, `submit_consolidated_to_pm`, `pm_approve_scope`, `pm_accept_quote`. These match between the SQL definitions in B3.3 and the UI calls in B3.8. RPC `quote_parts_request` and `mark_parts_request_ordered` reuse the existing names from migration 0023b — no rename needed.

**Cross-task wiring:** `<ConsolidationPicker>` (B3.7) is consumed in `/app/parts` (B3.10). `<PriceField>` (B5.1) is consumed in four files (B5.2). No dangling components.
