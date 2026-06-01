'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import type { TicketStatus } from '@/lib/types';

// Status → badge variant. Labels come from i18n (namespace "ticket_status")
// so the badge follows the user's locale instead of being hardcoded RU.
const VARIANTS: Record<TicketStatus, React.ComponentProps<typeof Badge>['variant']> = {
  new: 'destructive',
  tier2_responding: 'warning',
  awaiting_operator: 'default',
  resolved: 'success',
  closed_self: 'secondary',
};

export const TICKET_STATUSES: TicketStatus[] = [
  'new',
  'tier2_responding',
  'awaiting_operator',
  'resolved',
  'closed_self',
];

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const t = useTranslations('ticket_status');
  return <Badge variant={VARIANTS[status] ?? 'outline'}>{t(status)}</Badge>;
}
