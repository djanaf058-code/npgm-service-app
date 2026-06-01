'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import type { ShiftStatus } from '@/lib/types';

const VARIANTS: Record<ShiftStatus, React.ComponentProps<typeof Badge>['variant']> = {
  planned: 'default',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'secondary',
  blocked: 'destructive',
};

export function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const t = useTranslations('shift_status_badge');
  return <Badge variant={VARIANTS[status] ?? 'outline'}>{t(status)}</Badge>;
}
