# Operator Training & Certification — Design Spec

> Status: **DEFERRED** — captured for after the pilot test phase. Do not implement
> until the existing app has been validated with real operators (MCS / Gulf
> Explosives). Decided 2026-05-25.

## Goal

A "Training" tab where new operators learn each machine type from the manuals
and pass a short assessment, earning a **certification record** ("Certified for
{type}") visible to managers. Certification is a **status/badge only — no shift
gating** (decided to de-risk the pilot).

## Decisions (from brainstorming 2026-05-25)

- **Purpose:** training + assessment with a certification record.
- **Content source:** AI drafts lessons + quiz questions from the manuals
  (RAG over `manual_chunks`); an admin reviews/edits and publishes. Never
  auto-published unreviewed — accuracy matters for an "admission" record.
- **Gating:** status only. An uncertified operator can still start shifts; the
  badge is informational (profile + team list; optional non-blocking notice at
  shift start).
- **Pass threshold:** 80% per module (default; tunable later). Unlimited retakes.
- **Languages:** generate RU + EN (consistent with the app's i18n + cross-lingual
  manuals).

## Concept

One **course per machine type** (МЗВ / МСЗ / МСЗУ / МЗУ). A course has ordered
**modules** (e.g. Safety, Pre-shift, Charging, Basic maintenance). Each module
has a short lesson (phone-readable) + 3–5 multiple-choice questions. Pass all
modules → "Certified for {type}" with date + best score.

## Content authoring flow

1. Admin/НПГМ: "Generate course for {type}".
2. AI assembles a draft from manual chunks: 4–6 modules, each with lesson text +
   3–5 questions (with the source chunk ids recorded for traceability).
3. Draft status → admin reviews, edits, deletes weak items.
4. Publish → visible to operators.

## Operator experience

- "Training" tab → list of courses by machine type.
- Module = short lesson + end-of-module quiz.
- 80% to pass; retake allowed.
- All modules passed → certification recorded.

## Where it shows

- Badge "Certified: МЗУ, МСЗ" in operator profile and in the Team list (manager
  sees who's certified).
- Optional non-blocking info line at shift start: "Not certified for this type."

## Data model (new tables)

- `training_courses` — `id, machine_type, status (draft|published), created_at`.
- `training_modules` — `id, course_id, order, title_ru, title_en, body_ru,
  body_en, source_chunk_ids (jsonb)`.
- `training_questions` — `id, module_id, question_ru, question_en, options
  (jsonb), correct_index`.
- `training_progress` — `id, operator_id, module_id, score, completed_at`.
- `operator_certifications` — `id, operator_id, machine_type, certified_at,
  best_score`.
- RLS: courses/modules/questions readable by all members; authoring restricted
  to platform_admin. Progress/certifications scoped to the operator + visible to
  their company's managers.

## Reuses (≈70% already built)

RAG retrieval over manuals, `manual_chunks`, Claude, machine types, i18n (RU/EN),
roles.

## Implementation sub-sprints (when un-deferred)

1. **Schema + generation + admin review** — migration (5 tables + RLS), course
   generation API (Claude over RAG), admin review/publish UI.
2. **Operator flow** — course list, module reader, quiz, scoring, certification
   recording.
3. **Badges + integration** — profile + team-list badges; optional shift-start
   notice.

## Open items (resolve at implementation time)

- Module set per machine type — fixed taxonomy vs AI-decided sections.
- Whether to regenerate a course when its manual is re-ingested (versioning).
- Certification expiry (e.g. re-certify yearly) — out of scope for v1.
