import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, { ru: string; description: string }> = {
  МЗВ: { ru: "МЗВ", description: "100% эмульсия" },
  МСЗ: { ru: "МСЗ", description: "100% ANFO" },
  МСЗУ: { ru: "МСЗУ", description: "Универсал" },
  МЗУ: { ru: "МЗУ", description: "Смесевой 70/30" },
};

export function MachineTypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type];
  if (!label) return <Badge variant="outline">{type}</Badge>;
  return (
    <Badge variant="default" title={label.description}>
      {label.ru}
    </Badge>
  );
}
