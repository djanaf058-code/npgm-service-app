import { Badge } from '@/components/ui/badge';

const LABELS: Record<number, { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  1: { ru: 'Авария', variant: 'destructive' },
  2: { ru: 'Высокий', variant: 'destructive' },
  3: { ru: 'Средний', variant: 'warning' },
  4: { ru: 'Низкий', variant: 'secondary' },
  5: { ru: 'Несрочный', variant: 'outline' },
};

export function PriorityBadge({ priority }: { priority: number }) {
  const cfg = LABELS[priority] ?? LABELS[3];
  return <Badge variant={cfg.variant}>P{priority} · {cfg.ru}</Badge>;
}
