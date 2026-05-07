// Per-machine recipe specs.
//
// Each machine type imposes a different rule on which components an
// operator can load and in what proportions:
//
//   МЗВ  — pure emulsion only.
//   МЗУ  — emulsion + AN. Em ranges 70-100%, AN ranges 0-30%.
//          No diesel. (One degree of freedom — Em%.)
//   МСЗ  — pure ANFO: AN + diesel locked at 95/5. (No degrees.)
//   МСЗУ — emulsion + AN + diesel. All three components free,
//          must sum to 100%. (Two degrees of freedom.)

export type ComponentMix = {
  emulsion_pct: number; // 0..100
  an_pct: number;       // 0..100
  diesel_pct: number;   // 0..100
};

export type RecipeSpec =
  | { kind: 'fixed'; mix: ComponentMix; label: string }
  | {
      kind: 'em_an_range';
      emulsionMinPct: number;
      emulsionMaxPct: number; // AN_pct = 100 - emulsion_pct
      label: string;
    }
  | { kind: 'free_three'; label: string };

export function getRecipeSpec(machineType: string | null | undefined): RecipeSpec {
  switch (machineType) {
    case 'МЗВ':
      return {
        kind: 'fixed',
        mix: { emulsion_pct: 100, an_pct: 0, diesel_pct: 0 },
        label: '100% эмульсия',
      };
    case 'МСЗ':
      return {
        kind: 'fixed',
        mix: { emulsion_pct: 0, an_pct: 95, diesel_pct: 5 },
        label: 'ANFO (95% AN + 5% дизель)',
      };
    case 'МЗУ':
      return {
        kind: 'em_an_range',
        emulsionMinPct: 70,
        emulsionMaxPct: 100,
        label: 'Эмульсия 70–100% + AN 0–30%',
      };
    case 'МСЗУ':
      return {
        kind: 'free_three',
        label: 'Универсал — Эмульсия / AN / Дизель',
      };
    default:
      // Unknown type → safest default: free three-component.
      return { kind: 'free_three', label: 'Свой состав' };
  }
}

// Convert mix percentages + total tonnage to per-component tons.
// Returns null for components not used by this machine type
// (so the DB stores null, not zero — preserves "this column is N/A here").
export function computeComponentTons(
  spec: RecipeSpec,
  totalTons: number,
  customMix?: ComponentMix
): { emulsion: number | null; an: number | null; diesel: number | null } {
  const round3 = (x: number) => Math.round(x * 1000) / 1000;
  let mix: ComponentMix;
  switch (spec.kind) {
    case 'fixed':
      mix = spec.mix;
      break;
    case 'em_an_range':
    case 'free_three':
      if (!customMix) {
        return { emulsion: null, an: null, diesel: null };
      }
      mix = customMix;
      break;
  }
  const em = mix.emulsion_pct > 0 ? round3((totalTons * mix.emulsion_pct) / 100) : null;
  const an = mix.an_pct > 0 ? round3((totalTons * mix.an_pct) / 100) : null;
  const diesel = mix.diesel_pct > 0 ? round3((totalTons * mix.diesel_pct) / 100) : null;
  return { emulsion: em, an, diesel };
}

// Useful presets for МСЗУ — quick buttons in the UI.
export const MSZU_PRESETS: { label: string; mix: ComponentMix }[] = [
  { label: '100% Эмульсия', mix: { emulsion_pct: 100, an_pct: 0, diesel_pct: 0 } },
  { label: 'ANFO (95/5)', mix: { emulsion_pct: 0, an_pct: 95, diesel_pct: 5 } },
  { label: '70/30 (Em/AN)', mix: { emulsion_pct: 70, an_pct: 30, diesel_pct: 0 } },
  { label: '30/70 (Em/AN)', mix: { emulsion_pct: 30, an_pct: 70, diesel_pct: 0 } },
  { label: '50/50 + дизель', mix: { emulsion_pct: 50, an_pct: 47.5, diesel_pct: 2.5 } },
];

export function isValidMix(mix: ComponentMix, tolerance = 0.5): boolean {
  const sum = mix.emulsion_pct + mix.an_pct + mix.diesel_pct;
  return Math.abs(sum - 100) <= tolerance;
}
