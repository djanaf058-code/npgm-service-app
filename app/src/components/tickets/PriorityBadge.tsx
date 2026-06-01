'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

const VARIANTS: Record<number, React.ComponentProps<typeof Badge>['variant']> = {
  1: 'destructive',
  2: 'destructive',
  3: 'warning',
  4: 'secondary',
  5: 'outline',
};

export function PriorityBadge({ priority }: { priority: number }) {
  const t = useTranslations('priority');
  const variant = VARIANTS[priority] ?? 'warning';
  const safe = priority >= 1 && priority <= 5 ? priority : 3;
  return (
    <Badge variant={variant}>
      P{priority} · {t(String(safe))}
    </Badge>
  );
}
