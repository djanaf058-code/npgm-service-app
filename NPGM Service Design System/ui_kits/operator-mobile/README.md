# Operator Mobile · UI Kit

Field operator app — built for **phones, in gloves, outdoors in sunlight**.

## Screens (in `index.html`)
- **Login** — mesh-gradient brand panel at the top (logo + bilingual tagline) over a white form with locale switcher (matches the auth two-pane pattern from the codebase, collapsed for mobile).
- **Dashboard** — mesh-gradient hero card with role eyebrow + greeting; 2×2 KPI grid; "In progress now" active shifts feed (with animated green pulse for running shifts and red dot for blocked); "Upcoming work" list with `Submit request` CTAs; quick-access cards. Mirrors `/app/page.tsx`.
- **Start shift** — 3-step wizard (Machine → Checklist → Plan). Step 2 has binary OK / Not OK per item with critical-flag badges, photo attachment on fail, and a red warning callout when a critical item is "Not OK" (the same wording as the codebase's `critical_fail_warning_strong`).
- **New ticket** — machine link · subject · description · **priority P1-P5** (radio list with colored ring for P1/P2) · photo attach.
- **AI assistant** — per-machine chat ("Chat about MSZU-14-NPV"), confidence-% badge, "Didn't help — forward to engineer" escalation CTA, suggested follow-ups.

## Atoms (`Atoms.jsx`)
- `NPGM` — full token object (real codebase values).
- `Icons` — lucide-style icon set (stroke 1.75, 24-px viewBox).
- `Button`, `Input`, `Field`, `Badge`, `Card` — shadcn-style primitives.
- `LocaleSwitcher` — 🇷🇺 / 🇬🇧 pill switch (the only emoji in the system).
- `MeshHero` — signature mesh-gradient surface, reusable. Pass children to overlay.
- `AppTopBar`, `BottomNav` — mobile chrome.

## Conventions
- All tap targets ≥44 px. Button `size="lg"` is 48 px.
- Tables become stacked cards on mobile — no horizontal scroll in the operator app.
- All copy is bilingual; pass `lang="RU"|"EN"` to every screen.
- Numbers use `font-variant-numeric: tabular-nums`. Non-negotiable for the KPI grid.

The `Atoms.jsx`, `Login-Dashboard.jsx`, `Screens.jsx` files are the readable source; `index.html` is the bundled, self-contained preview.
