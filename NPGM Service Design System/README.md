# NPGM Service Design System

> Design system, UI kit, and brand guidelines for the **NPGM Service App** — a B2B SaaS platform for blasting contractors in the mining industry, supporting operators of **MMU/MZB/MSZ emulsion chargers and drilling rigs** built by НИПИГОРМАШ.

---

## Index

| File | What it is |
|---|---|
| `README.md` | This file. Brand context, content + visual foundations, iconography. |
| `SKILL.md` | Agent-Skill manifest. Tells Claude how to use this system. |
| `colors_and_type.css` | CSS variables for all tokens — mirrors `app/src/app/globals.css` from the production code. Import this first. |
| `assets/logo-full.png` · `logo-mark.png` | Brand marks. `LogoNew.png` in the repo. |
| `assets/equipment/*.jpg` | **Real photography** of MMU units (Saudi desert sunset, Saudi convoy, NIPIGORMASH-branded unit at the factory). Use for marketing surfaces — the in-app UI never uses photography. |
| `preview/` | Design-system reference cards rendered in the Design System tab. |
| `ui_kits/operator-mobile/` | Field operator app surfaces (Login → Dashboard → Start shift → New ticket → AI assistant). |
| `ui_kits/manager-desktop/` | Service-manager desktop surfaces (Dashboard → Fleet → Machine detail → Garage). |

---

## Product context

**Company:** NPGM (НПГМ) — Russian engineering company; service platform partnered with **НИПИГОРМАШ** (NIPIGORMASH research institute, the OEM of the MMU/drill fleet).
**Product:** NPGM Service App — operational loop for an entire blasting fleet.
**Stack:** Next.js 15 + React 19 + TypeScript + TailwindCSS + **shadcn/ui** + lucide-react. **PWA** (installable on iOS/Android, offline-first). Supabase (Postgres + RLS + Realtime + Storage + pgvector). FastAPI for RAG search over technical manuals.
**Markets:** Saudi Arabia (Modern Chemical & Service Co.), UAE (Gulf Explosives), Russia/CIS. Pilot **August 2026**. Bilingual **EN/RU** out of the box (`next-intl`).
**Repo:** `github.com/djanaf058-code/npgm-service-app` (reviewed at SHA `eb27866`).

### Two audiences, opposite postures

1. **Field operators** — on **phones**, often **in gloves**, **outdoors in sunlight**, before/during/after a 12-hour shift.
   Tasks: pre-shift checklists, charging plans, photo-tickets to engineers, contextual AI assistant.
   → Mobile-first. High contrast. ≥44 px tap targets. Minimal typing.

2. **Service managers & NPGM Tier-2 engineers** — on **desktops**, in offices.
   Tasks: fleet roll-up, maintenance forecast (per machine, by **tons pumped** not just hours), garage (parts pipeline), consolidated requests to НИПИГОРМАШ, multi-tenant administration.

### Roles (from `roles.*` in messages files)

| Role | Russian label | Surface |
|---|---|---|
| `operator` | Оператор | Mobile app — shifts, checklists, tickets |
| `service_engineer` | Сервис-инженер | Desktop — incoming operator requests, consolidated requests |
| `project_manager` | Руководитель проекта | Desktop — full company management, approvals |
| `company_admin` | Сервис-менеджер | Desktop — single-company admin |
| `tier2_engineer` | НПГМ Tier 2 | Desktop — cross-tenant queue |
| `platform_admin` | NPGM Platform | `/admin` — all companies, all tenants |

### Equipment served

The product calls them **machines**, not "MEMU trucks". The OEM type catalog (from `MachineTypeBadge`):

| Type | Meaning |
|---|---|
| **МЗВ** | 100% emulsion charger |
| **МСЗ** | 100% ANFO charger |
| **МСЗУ** | Universal (emulsion + ANFO) |
| **МЗУ** | Blend 70/30 |

Plus drilling rigs. The "Fleet" UI label in EN is **"Fleet"**, in RU is **"Парк техники"**.

### Domain language — non-negotiable

- **Dual mileage**: every machine tracks **engine hours** (двигатель, гидравлика) AND **tons pumped** (насосы, шланги, насадки). Service intervals are typically by *tons*, not just hours — UI must show both, side by side.
- **Pit** (карьер / Block / Pit) — where the machine is located. Always specified.
- **Shift** = a full block of operator work; has a **charging plan** (planned tonnage, recipe, holes count). Recipes: `ANFO`, `100% emulsion`, `70/30`, `30/70`, `Other`.
- **Pre-shift checklist** is **binary per item: OK / Not OK**. Items may be marked **critical**. A critical "Not OK" sets the shift status to `blocked` (status badge: destructive red, label "Заблокирована"). The operator cannot start work until resolved.
- **Tickets** carry priorities **P1 critical → P5 non-urgent**.
- **Maintenance** statuses: `forecast` → `requested` → `planned` → `in_progress` → `completed` (or `cancelled`).
- **Garage** (`/app/parts`) is the parts UI — used as both "Garage" (EN) and "Запчасти" (RU).
- **Consolidated request** — service engineer rolls up multiple operator parts-requests into one consolidated order; PM approves; sent to NPGM Tier-2 for quoting.
- The auto-request to NIPIGORMASH 30 days before service is a literal product feature.

---

## Content fundamentals

### Voice
**Serious, industrial, premium B2B.** This is software for people whose job involves explosives, heavy machinery, and remote sites. Copy reads like an operations manual written by someone who has been on a drill pad — not a SaaS landing page.

- **Plain declarative sentences.** No "magical", "delightful", "supercharge".
- **Specificity is the brand.** Real numbers, real intervals, real part designators. The dashboard shows "Maintenance at output {next} tons · current output: {current} tons". The forecast says "TO-1000 in 380 tons · ≈ 12 d". This level of specificity is the design language.
- **Mechanism over benefit.** "Each company is a separate tenant with Postgres Row-Level Security." That is the literal landing-page bullet. Don't soften it.
- **RU and EN are sibling translations of the same engineering doc** — they share structure word-for-word. RU uses industry abbreviations (СЗМ, ТО, ПМ, НИПИГОРМАШ, МЗВ/МСЗ/МСЗУ/МЗУ) without ceremony.

### Person & address
- **Second person ("you") only at decision points** ("Pick from catalog…", "Forward to engineer"). Most copy is descriptive labelling.
- **No exclamation marks. No questions in headlines.**
- **No emoji** in product surfaces. Flag emoji `🇷🇺` `🇬🇧` is used **only** in the `LocaleSwitcher` component.

### Casing
- **Sentence case everywhere.** Headings, buttons, labels. ("Sign in", "Создать аккаунт", "Start shift").
- **Acronyms keep their casing:** NPGM, NIPIGORMASH, RLS, MFA, PWA, AAL, MMU, МЗВ, МСЗ, МСЗУ, МЗУ, ТО, P1–P5.
- **Eyebrows** (in dashboard hero) are **uppercase 10–12 px with `letter-spacing: 0.05em`**.

### Concrete examples (taken verbatim from messages files)

| EN | RU |
|---|---|
| Your fleet, under control | Парк техники, под контролем |
| Maintenance, checklists, parts, AI assistant. | ТО, чек-листы, запчасти, AI-помощник. |
| One platform for your entire fleet | Один контур для всего парка техники |
| From operator daily checklists to yearly parts budget. Built in partnership with NIPIGORMASH. | От ежедневного чек-листа оператора до годового бюджета на запчасти. Разрабатывается в партнёрстве с НИПИГОРМАШем. |
| Pre-shift inspection and loading plan with automatic load forecast. | Ежедневный осмотр перед сменой и план зарядки с автопрогнозом нагрузки. |
| Per-type maintenance regulations + auto-request to NIPIGORMASH 30 days before service. | Регламент по типу машины + автозаявка к НИПИГОРМАШу за 30 дней до ТО. |
| Each company is a separate tenant with Postgres Row-Level Security. | Каждая компания — отдельный tenant с Postgres Row-Level Security. |
| Maintenance forecast by pumped tons + request with auto-filled parts kit | Прогноз ТО по прокачанным тоннам + заявка с автозаполненным комплектом запчастей |
| MMU and drilling rig cards with dual mileage (engine hours + pumped tons) | Карточки СЗМ и буровых с двойным пробегом (моточасы + прокачанные тонны) |
| Pumped tons (pumps, hoses, nozzles) | Прокачано тонн (насосы, шланги, насадки) |
| Critical checklist failure. Continuing will create a shift in 'Blocked' status — the operator cannot start work until resolved. This is intentional, do not try to bypass. | Критическое замечание чек-листа. Продолжение создаст смену в статусе «Заблокирована» — оператор не сможет начать работу до устранения. Это намеренно, не пытайтесь обойти. |

Notice: every blurb is **one sentence**, **names the mechanism** (RLS, 30 days, autozayavka, dual mileage). That is the tone.

---

## Visual foundations

### Color

**Primary is BLUE**, not the indigo of the logo. The logo's indigo+red is the brand mark; the UI surface is `blue-500 / blue-600`. This is intentional — corporate, calm, accessible.

| Token | Hex | Role |
|---|---|---|
| `--color-primary-500` | `#2563eb` | brand blue |
| `--color-primary-600` | `#1d4ed8` | default for buttons, links, focused fields |
| `--color-primary-700` | `#1e40af` | hover on primary surfaces |
| `--color-accent-600`  | `#dc2626` | brand red — destructive, critical alerts, P1, blocked-shift |
| `--color-secondary-*` | slate 50–900 | neutrals (`--color-secondary-200` is the default border) |
| `emerald-50/700`      | tailwind | **success** badge (operator role, OK checklist, in-service) |
| `amber-50/700`        | tailwind | **warning** badge (shift in progress, maintenance-soon) |

The red is **sparing** — destructive actions, critical-priority tickets, blocked shifts, the right-edge accent stripe on the auth panel. Never a CTA color.

### Type

- **Headings:** `font-heading` → **IBM Plex Sans** 500/600/700, `tracking-tight` (`-0.01em`), `font-feature-settings: "ss01"`.
- **Body & UI:** `font-sans` → **Inter** 400/500/600, `font-feature-settings: "ss01", "cv11"` on `<body>`.
- **Mono:** **IBM Plex Mono** for SKUs, serial numbers, hours, tons (anywhere `tabular-nums` is implied).
- **Numbers:** **`tabular-nums`** on every KPI value, every "tons" / "h" figure. Non-negotiable — the dashboard depends on this for alignment.

### Signature motif — mesh-gradient hero

This is the brand's visible signature. Used in three places:
1. **Landing page** (full hero).
2. **Auth two-pane** (the right-hand brand panel — but as a softer linear gradient `from-primary-700 via-primary-800 to-secondary-900`, not the full mesh).
3. **Dashboard hero card** (rounded `--radius-xl` card at top of `/app`, same linear blue→slate gradient as the auth panel).

The full mesh is layered radial blobs:
- Base color: `#0b1437` (near-black-blue)
- Blobs at: `78% 8%` `#6366f1` · `12% 22%` `#1d4ed8` · `88% 80%` `#a855f7` · `18% 88%` `#312e81` · `50% 50%` `#1e3a8a`
- Over a **subtle 40 px white grid at 6% opacity** — the "industrial texture"
- And an **accent-600 red 1 px stripe on the right edge** (the only place where indigo gradient and red meet at full saturation)

This is built into `colors_and_type.css` as `.mesh-hero` — apply that class to a positioned `<div>` to get it for free.

### Backgrounds & imagery

- **Real photography is for marketing only** — landing page, slide decks, partner pitch decks. The **in-app UI shows no equipment photos**; it's pure data — type, badges, tables.
- **Backgrounds in-app are white surfaces over `secondary-50` (`#f8fafc`) page background.** No textures, no patterns, no decorative gradients beyond the mesh hero on dashboard.
- Equipment photos when used: **warm-neutral, slight desaturation**, square or 4:3 crop, real context (sand, sunset, factory rails), never studio.

### Borders, radii, shadows

- **Radii (matches `--radius` in shadcn):** `4px` (chips), `6px` (`--radius-md` — buttons, inputs), `8px` (`--radius-lg` — cards, the default), `12px` (`--radius-xl` — hero gradient card). Pill (`999px`) only for the locale switch and chip filters.
- **Borders:** 1 px `secondary-200` everywhere. Borders carry weight over shadows in dense layouts.
- **Shadows:** restrained.
  - `shadow-sm`: resting cards, KPI tiles.
  - `shadow-md`: popovers, dialogs, dropdown menus.
  - `shadow-lg`: landing-page CTA — `0 30px 80px rgba(15,23,42,0.15)`.
  - **Branded shadow**: `0 8px 24px rgba(29,78,216,0.30)` on the landing-page primary CTA (`shadow-primary-900/30`).

### Buttons (from `ui/button.tsx`)

- Sizes: `default h-10 px-4`, `sm h-9 px-3`, `lg h-11 px-8`, `icon h-10 w-10`.
- Variants:
  - **default** — `bg-primary text-primary-foreground` (blue / white). Hover: `bg-primary/90`.
  - **destructive** — red. Same hover pattern.
  - **outline** — `border border-input bg-background hover:bg-accent`.
  - **secondary** — slate-100 background.
  - **ghost** — transparent, hover slate-50.
  - **link** — text-primary underline on hover.
- All radii `--radius-md` (6 px).
- Disabled: `pointer-events-none opacity-50` (the codebase uses opacity — see Caveats below; the operator app may want a solid-fill alternative for sunlight).

### Badges (from `ui/badge.tsx`)

The full taxonomy of badge variants — copy these exactly:

| Variant | bg / text / ring | Used for |
|---|---|---|
| `default` | `primary-50 / primary-700 / primary-200` | machine type, scheduled |
| `secondary` | `secondary-100 / secondary-700 / secondary-200` | decommissioned, draft |
| `success` | `emerald-50 / emerald-700 / emerald-200` | active, completed shift, in-service |
| `warning` | `amber-50 / amber-700 / amber-200` | shift in progress, maintenance soon |
| `destructive` | `accent-50 / accent-700 / accent-200` | blocked, P1, critical fail |
| `outline` | `transparent / secondary-700 / secondary-300` | type fallback |

All badges share `rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap`.

### Animation

- **Restrained.** Default `transition-colors duration-150–200`. The only animated element is the green pulse dot on an **active shift** card (`animate-pulse`).
- No springs, no bounces, no parallax. Loaders are `animate-spin border-2 border-primary-600 border-t-transparent`.

### Layout rules

- **Mobile:** single-column. Sidebar collapses behind a scrim (`secondary-900/60`). Sticky top bar 64 px with hamburger + locale + user. Mobile = the operator's primary surface.
- **Desktop:** left rail nav `w-64` (fixed). Top sticky bar 64 px with breadcrumb-less header (just locale + user; the page title goes in the page heading). Main content `max-w-6xl mx-auto`, page padding `p-4 md:p-6`.
- **Tables** are full-width within the card. Use shadcn cards as table shells. Sticky header inside the scroll region.

### Transparency & blur

- The landing **top nav** uses `bg-white/85 backdrop-blur-md`. That's the only blur in the system.
- Modal scrims: `secondary-900/60`. No blur.

---

## Iconography

- **Primary set: `lucide-react`** — confirmed throughout `AppLayout.tsx`, `Logo.tsx`, dashboard, auth. Stroke 1.5–2 px, 24 px default, `currentColor`. **No FontAwesome, no Material Icons, no Heroicons.**
- **Routinely used icons:** `Truck` (fleet), `Wrench` (maintenance), `ClipboardCheck` (shifts), `MessageSquareText` (tickets), `Box` (garage), `Users` (team), `Shield` (admin / data isolation), `Home`, `User`, `LogOut`, `Key`, `ChevronDown`, `ChevronRight`, `Menu`, `X`, `AlertTriangle`, `Activity`, `ShoppingCart`, `Loader2`, `ArrowLeft`, `ArrowRight`.
- **Logo mark** (`assets/logo-mark.png`) is the favicon and the square app-icon (`Logo variant="mark"`). The wordmark (`LogoNew.png`) is `variant="full"` — used on auth screens and the desktop sidebar header. The component **never distorts aspect ratio**.
- **Flags** (`🇷🇺` `🇬🇧`) are the only emoji used in the entire system — rendered at the OS-native size inside the `LocaleSwitcher`. Do not substitute with SVGs.
- **No icon fonts.** lucide-react ships as React components and tree-shakes — keep it that way.

### Icon color rules
- Inline with text → `currentColor`.
- In `bg-primary` button → white.
- In nav rail → `text-secondary-400` resting / `text-primary-600` on the active item / `text-secondary-600` on hover.
- In a KPI tile → tinted by the tile's accent (`text-primary-700`, `text-emerald-700`, `text-amber-700`, `text-accent-700`).

### Sizes
- 16 px (icon-in-button next to text), 20 px (sidebar / nav), 24 px (default, hero icons), 32 px (empty states).

---

## How to use this system

If you are an LLM assembling NPGM-branded artifacts (slides, prototypes, marketing, throwaway mocks):

1. **Always** link `colors_and_type.css` and pull Inter + IBM Plex Sans from Google Fonts.
2. **Always** use the logo from `assets/` — never re-draw.
3. **Always** use the real domain vocabulary — *machines* (not "MEMU trucks"), *МЗВ/МСЗ/МСЗУ/МЗУ*, *tons pumped*, *pit*, *shift*, *charging plan*, *P1–P5*, *Garage*.
4. **Always** use shadcn-style badge variants and button variants — they are codified.
5. Pick screens from `ui_kits/operator-mobile/` (mobile-first, sunlight) or `ui_kits/manager-desktop/` (dense data).
6. The mesh-gradient hero is the brand's signature surface — use it on first-impression moments (landing, dashboard hero, auth right-panel) and nowhere else.

See `SKILL.md` for the agent-skill manifest.

---

## Caveats / open questions for the team

1. **Disabled-button opacity in sunlight.** The shadcn `Button` uses `opacity-50` when disabled. Field operators in direct sun may not see this — consider a solid `secondary-200` fill alternative for the operator app. *(Worth confirming with the field team.)*
2. **Mesh-gradient on the auth side-panel** is currently a linear `from-primary-700 via-primary-800 to-secondary-900`, not the full radial mesh. If the team wants the full mesh on auth too, it's a 4-line change. The mesh hero on `/` landing is the full thing.
3. **EPS logo not provided** — only PNG (439×117 wordmark, 155×155 mark). If you have a vector, ship it to `assets/logo.svg` and we'll wire it into the Logo component (it currently uses `next/image` with PNG only).
4. **Analytics & Schedule** screens aren't included in the manager-desktop UI kit — the codebase only has them as routes, the UI is light. We can mock them once the screens are designed.
