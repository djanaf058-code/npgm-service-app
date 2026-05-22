# Manager Desktop · UI Kit

Service-manager web app — mirrors the production `AppLayout.tsx` and `/app/page.tsx` patterns from the npgm-service-app codebase.

## Screens (in `index.html`)
- **Dashboard** — mesh-gradient hero card (role-aware eyebrow + greeting), 4-up KPI grid, active shifts feed, upcoming maintenance with inline "Submit request" CTA, quick-access grid. Direct port of `/app/page.tsx`.
- **Fleet** — machine list with the real columns (Model · Type · Serial · Pit · Engine hours · Tons · Status). Search, add-machine CTA.
- **Machine detail** — passport card (type/model/tonnage/serial/in-service/pit/auger/GGD) + dual mileage stat boxes + Next maintenance card with forecast + service history table.
- **Garage** — parts pipeline: incoming from operators, my consolidated in progress, stock table. Urgency badges (Critical/Urgent/Normal) per row.

## Sidebar (`Sidebar`)
- Mirrors `AppLayout.tsx`. Role-filtered nav (`operator`, `service_engineer`, `project_manager`, `platform_admin`).
- Items: Home · Fleet · Shifts · Tickets · Maintenance · Garage · Team · Admin · Profile.
- Active item: `bg-primary-50` + `text-primary-700` + `text-primary-600` icon.
- Bottom block: role badge + user avatar.

## Tokens & components (`Atoms.jsx`)
- `NPGM` token object — blue primary, red accent, slate secondary, plus emerald/amber for status.
- `Icons` — lucide-style stroke icons.
- `Badge` — six shadcn variants (default / secondary / success / warning / destructive / outline).
- `Button` — six variants × three sizes.
- `MeshHero` — signature mesh-gradient surface (5 radial blobs + grid + red edge stripe).
- `Sidebar` + `TopBar` — composable shell.

## What's intentionally NOT in this kit
- Analytics screen — codebase only has a stub.
- Schedule (maintenance forecast list) — present as a sidebar item but only the per-machine forecast is built. Add when the screen is designed.
- Admin (`/admin`) cross-tenant views — separate surface.

The `Atoms.jsx` and `Screens.jsx` files are the readable source; `index.html` is the bundled, self-contained preview.
