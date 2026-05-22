---
name: npgm-design
description: Use this skill to generate well-branded interfaces and assets for the NPGM Service App (B2B SaaS for blasting contractors in mining — MMU/MZB/MSZ emulsion chargers and drilling rigs by НИПИГОРМАШ; Next.js 15 + shadcn/ui stack; bilingual EN/RU). Contains real-codebase tokens, type rules, mesh-gradient brand motif, lucide-react iconography, and operator-mobile + manager-desktop UI kits.
user-invocable: true
---

Read `README.md` first — it covers brand context, content fundamentals (with verbatim copy samples from the production messages files), visual foundations, and iconography. Then explore:

- `colors_and_type.css` — drop-in tokens that mirror `app/src/app/globals.css`. Always import first. Includes the mesh-gradient as a reusable `.mesh-hero` class.
- `preview/` — design-system reference cards (color scales, mesh hero, machine-type badges, KPI tiles, buttons, badges, inputs, cards).
- `assets/logo-full.png` (`LogoNew.png` in the repo) and `assets/logo-mark.png` — bundled brand marks.
- `assets/equipment/*.jpg` — real MMU photography (provided by the product owner). **Marketing use only.** The in-app UI shows no equipment photos.
- `ui_kits/operator-mobile/` — field-operator screens (Login · Dashboard · Start-shift wizard · New ticket · AI assistant).
- `ui_kits/manager-desktop/` — service-manager screens (Dashboard · Fleet · Machine detail · Garage).

## Non-negotiable rules

1. **Primary blue, accent red.** `#2563eb` brand blue / `#1d4ed8` default / `#dc2626` accent. The logo is purple+red but the UI is blue+red. Don't mix them.
2. **Real domain language.** Machines, not "MEMU trucks". **МЗВ / МСЗ / МСЗУ / МЗУ** are the machine-type designators (stay Cyrillic in EN copy too). **Dual mileage** (engine hours + tons pumped). **Pit** (карьер). **Shift** with charging plan. **OK / Not OK** binary checklist with critical flag. **P1–P5** ticket priorities. **Garage** = parts. **Consolidated request** = service-engineer roll-up.
3. **shadcn/ui patterns.** Badges have six variants; Buttons have six variants × three sizes. Codified in `colors_and_type.css` and `preview/components-*.html`. Use them.
4. **Mesh gradient is the signature surface.** Used on landing hero, dashboard hero card, and auth right-panel. Use `MeshHero` component or the `.mesh-hero` class — don't improvise.
5. **No emoji except 🇷🇺 / 🇬🇧** in the locale switcher.
6. **Type:** IBM Plex Sans for headings (`font-heading`), Inter for body (`font-sans`). All numbers use `font-variant-numeric: tabular-nums`.
7. **Lucide-react icons** — stroke 1.5–2, 24-px viewBox, `currentColor`. No FontAwesome, no Heroicons, no Material.

## When you're invoked

If the user invokes without other guidance, ask:
1. Which surface — operator mobile, manager desktop, marketing, or slides?
2. Which screen / component specifically?
3. EN, RU, or both?
4. Production code or static mock?

Then act as an expert designer rooted in this system. Output bilingual when in doubt. Borders before shadows. Real photos for marketing only. Specificity (part numbers, hours, tons, intervals) before marketing language.

## Repo

`github.com/djanaf058-code/npgm-service-app` — reviewed at SHA `eb27866`. Stack: Next.js 15 + React 19 + TypeScript + TailwindCSS + shadcn/ui + lucide-react + PWA + Supabase + FastAPI/RAG.
