'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function EscalationBanner({ ticketId }: { ticketId: string }) {
  const t = useTranslations('ai');
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
      <p className="text-amber-900 mb-2">{t('escalated_message')}</p>
      <Link
        href={`/app/tickets/${ticketId}`}
        className="inline-flex items-center gap-1 text-primary-700 hover:underline font-medium"
      >
        {t('view_ticket')} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
