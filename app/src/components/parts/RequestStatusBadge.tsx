'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import type { PartsRequestStatus } from '@/lib/types';

const VARIANTS: Record<PartsRequestStatus, React.ComponentProps<typeof Badge>['variant']> = {
  submitted: 'secondary',
  consolidated: 'outline',
  drafting: 'outline',
  pending_pm: 'warning',
  forwarded: 'default',
  quoted: 'default',
  approved: 'warning',
  ordered: 'warning',
  received: 'success',
  cancelled: 'destructive',
  new: 'secondary',
  delivered: 'success',
};

export function RequestStatusBadge({ status }: { status: PartsRequestStatus }) {
  const t = useTranslations('parts_status');
  return <Badge variant={VARIANTS[status] ?? 'outline'}>{t(status)}</Badge>;
}

// Display order for sections / sorting. Internal — not exported as a label map
// anymore (labels live in i18n).
export const ACTIVE_REQUEST_STATUSES: PartsRequestStatus[] = [
  'submitted',
  'drafting',
  'pending_pm',
  'forwarded',
  'quoted',
  'approved',
  'ordered',
];

export const FINAL_REQUEST_STATUSES: PartsRequestStatus[] = [
  'received',
  'cancelled',
  'delivered', // legacy
];

export function isFinalStatus(s: PartsRequestStatus): boolean {
  return FINAL_REQUEST_STATUSES.includes(s);
}
