import { Clock } from 'lucide-react';

/**
 * Visual SLA indicator: green if <2h since creation, yellow 2-4h,
 * red >4h. Pure visual, no actual auto-escalation in MVP — just helps
 * the manager spot stale tickets at a glance.
 */
export function SLATimer({ createdAt, resolved }: { createdAt: string; resolved?: boolean }) {
  if (resolved) {
    return null;
  }
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const hours = (now - created) / (1000 * 60 * 60);

  let color = 'text-emerald-600 bg-emerald-50 ring-emerald-200';
  let label: string;
  if (hours < 1) {
    label = `${Math.round(hours * 60)} мин`;
  } else if (hours < 24) {
    label = `${Math.round(hours)} ч`;
  } else {
    label = `${Math.floor(hours / 24)} д`;
  }

  if (hours >= 4) color = 'text-accent-700 bg-accent-50 ring-accent-200';
  else if (hours >= 2) color = 'text-amber-700 bg-amber-50 ring-amber-200';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}
      title="Время с момента создания тикета"
    >
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}
