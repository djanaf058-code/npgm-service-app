import { Badge } from '@/components/ui/badge';
import type { PartsRequestStatus } from '@/lib/types';

const LABELS: Record<
  PartsRequestStatus,
  { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }
> = {
  // Two-step workflow (current).
  submitted: { ru: 'На рассмотрении', variant: 'secondary' },
  forwarded: { ru: 'У НПГМ',          variant: 'default' },
  quoted:    { ru: 'Получен КП',      variant: 'default' },
  approved:  { ru: 'Согласовано',     variant: 'warning' },
  ordered:   { ru: 'В пути',          variant: 'warning' },
  received:  { ru: 'Получено',        variant: 'success' },
  cancelled: { ru: 'Отменена',        variant: 'destructive' },
  // Legacy values (pre-migration 0023). Map them to the closest new label
  // so existing rows still render sensibly without a backfill.
  new:       { ru: 'На рассмотрении', variant: 'secondary' },
  delivered: { ru: 'Получено',        variant: 'success' },
};

export function RequestStatusBadge({ status }: { status: PartsRequestStatus }) {
  const cfg = LABELS[status] ?? { ru: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.ru}</Badge>;
}

export const REQUEST_STATUS_LABELS = LABELS;

// Display order for sections / sorting.
export const ACTIVE_REQUEST_STATUSES: PartsRequestStatus[] = [
  'submitted',
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
