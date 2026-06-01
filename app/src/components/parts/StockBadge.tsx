'use client';

import { useTranslations, useLocale } from 'next-intl';

/**
 * Stock indicator: color-coded by quantity vs reorder_threshold.
 *  - 0 → red "out of stock"
 *  - <reorder → yellow with quantity
 *  - >=reorder → green with quantity
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
  const t = useTranslations('stock_status');
  const tUnits = useTranslations('units');
  const locale = useLocale();
  const numberLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  // tUnits.has(unit) ? tUnits(unit) : unit
  const unitLabel = ['pcs', 'm', 'kg', 'l', 'set'].includes(unit) ? tUnits(unit) : unit;
  const formattedQty = Number(quantity).toLocaleString(numberLocale);

  if (quantity === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200">
        {t('out_of_stock')}
      </span>
    );
  }

  if (threshold !== null && quantity < threshold) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 tabular-nums">
        {t('low_prefix')} {formattedQty} {unitLabel}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 tabular-nums">
      {t('ok_prefix')} {formattedQty} {unitLabel}
    </span>
  );
}
