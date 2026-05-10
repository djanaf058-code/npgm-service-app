import { Badge } from '@/components/ui/badge';
import type { PartsRequestStatus } from '@/lib/types';

const LABELS: Record<
  PartsRequestStatus,
  { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }
> = {
  // Operator-level statuses.
  submitted:    { ru: 'У сервисника',    variant: 'secondary' },
  consolidated: { ru: 'В сводной',       variant: 'outline' },
  // Consolidated-level statuses.
  drafting:     { ru: 'Черновик сводной', variant: 'outline' },
  pending_pm:   { ru: 'Ждёт PM',          variant: 'warning' },
  forwarded:    { ru: 'У НПГМ',           variant: 'default' },
  quoted:       { ru: 'Получен КП',       variant: 'default' },
  approved:     { ru: 'Согласовано',      variant: 'warning' },
  ordered:      { ru: 'В пути',           variant: 'warning' },
  received:     { ru: 'Получено',         variant: 'success' },
  cancelled:    { ru: 'Отменена',         variant: 'destructive' },
  // Legacy values (pre-migration 0023).
  new:          { ru: 'У сервисника',     variant: 'secondary' },
  delivered:    { ru: 'Получено',         variant: 'success' },
};

export function RequestStatusBadge({ status }: { status: PartsRequestStatus }) {
  const cfg = LABELS[status] ?? { ru: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.ru}</Badge>;
}

export const REQUEST_STATUS_LABELS = LABELS;

// Display order for sections / sorting.
// Operator-level: submitted only (consolidated is "absorbed" — final-ish for ops).
// Consolidated-level: drafting → pending_pm → forwarded → quoted → approved → ordered.
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
