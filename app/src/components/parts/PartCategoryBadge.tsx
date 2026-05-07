import { Badge } from '@/components/ui/badge';
import type { PartCategory } from '@/lib/types';

const LABELS: Record<PartCategory, { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  filter: { ru: 'Фильтр', variant: 'default' },
  seal: { ru: 'Уплотнение', variant: 'secondary' },
  sensor: { ru: 'Датчик', variant: 'warning' },
  module: { ru: 'Модуль', variant: 'destructive' },
  pump_part: { ru: 'Узел насоса', variant: 'destructive' },
  consumable: { ru: 'Расходник', variant: 'outline' },
};

export function PartCategoryBadge({ category }: { category: PartCategory }) {
  const cfg = LABELS[category] ?? { ru: category, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.ru}</Badge>;
}

export const CATEGORY_LABELS = LABELS;
