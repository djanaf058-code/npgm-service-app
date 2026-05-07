/**
 * Stock indicator: color-coded by quantity vs reorder_threshold.
 *  - 0 → red "нет в наличии"
 *  - <reorder → yellow "мало"
 *  - >=reorder → green count
 *  - no threshold set → neutral count
 */
export function StockBadge({
  quantity,
  threshold,
  unit,
}: {
  quantity: number;
  threshold: number | null;
  unit: string;
}) {
  const unitRu = unit === 'pcs' ? 'шт' : unit === 'm' ? 'м' : unit === 'l' ? 'л' : unit === 'kg' ? 'кг' : unit === 'set' ? 'компл.' : unit;

  if (quantity === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200">
        🔴 нет в наличии
      </span>
    );
  }

  if (threshold !== null && quantity < threshold) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 tabular-nums">
        🟡 {Number(quantity).toLocaleString('ru-RU')} {unitRu}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 tabular-nums">
      ✓ {Number(quantity).toLocaleString('ru-RU')} {unitRu}
    </span>
  );
}
