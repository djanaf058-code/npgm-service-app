'use client';

import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import type { PartCategory } from '@/lib/types';

const VARIANTS: Record<PartCategory, React.ComponentProps<typeof Badge>['variant']> = {
  filter: 'default',
  seal: 'secondary',
  sensor: 'warning',
  module: 'destructive',
  pump_part: 'destructive',
  consumable: 'outline',
};

export const PART_CATEGORIES: PartCategory[] = [
  'filter',
  'seal',
  'sensor',
  'module',
  'pump_part',
  'consumable',
];

export function PartCategoryBadge({ category }: { category: PartCategory }) {
  const t = useTranslations('parts_category');
  return <Badge variant={VARIANTS[category] ?? 'outline'}>{t(category)}</Badge>;
}
