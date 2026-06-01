'use client';

import { Badge } from "@/components/ui/badge";
import { useTranslations } from 'next-intl';

const KNOWN_TYPES = ['МЗВ', 'МСЗ', 'МСЗУ', 'МЗУ'];

export function MachineTypeBadge({ type }: { type: string }) {
  const tShort = useTranslations('machine_type_short');
  if (!KNOWN_TYPES.includes(type)) return <Badge variant="outline">{type}</Badge>;
  // Short tag (the code itself, language-neutral) + localized tooltip description.
  return (
    <Badge variant="default" title={tShort(type)}>
      {type}
    </Badge>
  );
}
