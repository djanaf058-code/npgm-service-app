'use client';

import { useRole } from '@/lib/context/GlobalContext';
import type { PartsRequestStatus } from '@/lib/types';

interface Props {
  amount: number | null;
  currency: string | null;
  status: PartsRequestStatus;
  /** Inline placeholder shown when the user is not allowed to see the price yet. */
  placeholder?: React.ReactNode;
  /** When true, hide the row title too (use sparingly — most call sites want
   * the label visible with a placeholder so users see the field exists). */
  hideWhenForbidden?: boolean;
}

// Statuses where the price has not yet materialised: PM has approved scope
// (or earlier) but platform_admin hasn't sent a quote yet. Showing a number
// here would be premature.
const PRE_QUOTE_STATUSES: PartsRequestStatus[] = [
  'drafting',
  'pending_pm',
  'forwarded',
  'submitted',
  'consolidated',
  'new', // legacy
];

export function PriceField({
  amount,
  currency,
  status,
  placeholder = null,
  hideWhenForbidden = false,
}: Props) {
  const {
    isOperator,
    isServiceEngineer,
    isProjectManager,
    isPlatformAdmin,
  } = useRole();

  // Operator and service_engineer never see prices — they don't drive the
  // financial decision and shouldn't anchor on the supplier's number.
  if (isOperator || isServiceEngineer) {
    return hideWhenForbidden ? null : <>{placeholder}</>;
  }

  // Project manager: hide before the quote stage. Once status >= quoted, show.
  if (isProjectManager && PRE_QUOTE_STATUSES.includes(status)) {
    return hideWhenForbidden ? null : <>{placeholder}</>;
  }

  // Platform_admin always sees; project_manager sees from 'quoted' onwards.
  if (!isPlatformAdmin && !isProjectManager) return null;

  if (amount === null) {
    return <>{placeholder ?? '—'}</>;
  }

  return (
    <span className="tabular-nums">
      {amount.toLocaleString('ru-RU')} {currency ?? ''}
    </span>
  );
}
