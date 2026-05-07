import type { ChargingRecipe } from '@/lib/types';

// Which recipes are physically possible on each machine type.
// МЗВ — pure emulsion only (no auger, no AS bunker)
// МСЗ — pure ANFO only (no emulsion tank)
// МСЗУ — universal: anything
// МЗУ — emulsion + 70/30 blend (no pure ANFO load)
const RECIPES_BY_MACHINE_TYPE: Record<string, ChargingRecipe[]> = {
  МЗВ: ['EMULSION'],
  МСЗ: ['ANFO'],
  МСЗУ: ['ANFO', 'EMULSION', 'BLEND_70_30', 'BLEND_30_70', 'OTHER'],
  МЗУ: ['EMULSION', 'BLEND_70_30'],
};

export function getAllowedRecipes(machineType: string | null | undefined): ChargingRecipe[] {
  if (!machineType) return ['ANFO', 'EMULSION', 'BLEND_70_30', 'BLEND_30_70', 'OTHER'];
  return RECIPES_BY_MACHINE_TYPE[machineType] ?? ['OTHER'];
}

export function isBlendRecipe(recipe: ChargingRecipe): boolean {
  return recipe === 'BLEND_70_30' || recipe === 'BLEND_30_70';
}

// Default emulsion : AN (ammonium nitrate) ratio for the named blend.
export function getBlendRatio(recipe: ChargingRecipe): { emulsion: number; an: number } | null {
  if (recipe === 'BLEND_70_30') return { emulsion: 0.7, an: 0.3 };
  if (recipe === 'BLEND_30_70') return { emulsion: 0.3, an: 0.7 };
  return null;
}
