import { Badge } from '@/components/ui/badge';
import type { TicketStatus } from '@/lib/types';

const LABELS: Record<TicketStatus, { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  new: { ru: 'Новый', variant: 'destructive' },
  tier2_responding: { ru: 'У команды НПГМ', variant: 'warning' },
  awaiting_operator: { ru: 'Ждёт оператора', variant: 'default' },
  resolved: { ru: 'Решён', variant: 'success' },
  closed_self: { ru: 'Закрыт оператором', variant: 'secondary' },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const cfg = LABELS[status] ?? { ru: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.ru}</Badge>;
}

export const TICKET_STATUS_LABELS = LABELS;
