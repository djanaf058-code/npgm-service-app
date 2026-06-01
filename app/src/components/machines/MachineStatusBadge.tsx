'use client';

import { Badge } from "@/components/ui/badge";
import { useTranslations } from 'next-intl';

export function MachineStatusBadge({ status }: { status: string }) {
  const t = useTranslations('machine_status');
  switch (status) {
    case "active":
      return <Badge variant="success">{t('operational')}</Badge>;
    case "maintenance":
      return <Badge variant="warning">{t('maintenance')}</Badge>;
    case "decommissioned":
      return <Badge variant="secondary">{t('decommissioned')}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
