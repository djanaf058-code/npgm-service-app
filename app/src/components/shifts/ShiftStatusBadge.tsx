import { Badge } from '@/components/ui/badge';
import type { ShiftStatus } from '@/lib/types';

const LABELS: Record<ShiftStatus, { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  planned: { ru: 'Запланирована', variant: 'default' },
  in_progress: { ru: 'Идёт', variant: 'warning' },
  completed: { ru: 'Закрыта', variant: 'success' },
  cancelled: { ru: 'Отменена', variant: 'secondary' },
  blocked: { ru: 'Заблокирована', variant: 'destructive' },
};

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const cfg = LABELS[status] ?? { ru: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.ru}</Badge>;
}

export const SHIFT_STATUS_LABELS = LABELS;
