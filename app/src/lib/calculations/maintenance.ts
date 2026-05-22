import type { MaintenanceKind } from '@/lib/types';

/**
 * Compute the next maintenance event for a single machine given its current
 * tons_pumped and the schedules for its type.
 *
 * Rules observed in CODE/maintenance_specs/<тип>/ТО для <тип>.docx:
 *   - МЗВ has one schedule (kind='TO'), every 2000 t.
 *   - МСЗ/МСЗУ/МЗУ alternate ТО-1 and ТО-2 every 2000 t each, so the same
 *     kind effectively recurs every 4000 t starting from a baseline.
 *
 * Baseline assumption (good enough for MVP forecasting): every 2000 t a
 * maintenance is due; type and intervals decide which kind. Specifically:
 *   - Even-numbered counts (0, 4000, 8000, ...) → ТО-1
 *   - Odd-numbered counts (2000, 6000, 10000, ...) → ТО-2
 * (МЗВ → always 'TO' regardless.)
 */

export interface ScheduleSummary {
  id: string;
  machine_type: string;
  kind: MaintenanceKind;
  interval_tons: number;
  alternates_with: MaintenanceKind | null;
}

export interface ForecastResult {
  next_kind: MaintenanceKind;
  next_at_tons: number;
  /** Tons to the next service. NEGATIVE when the machine is overdue (it has
   *  crossed a service threshold that has no completed maintenance event). */
  tons_remaining: number;
  schedule_id: string;
  /** how many ТО of this kind have already passed (0 if first one) */
  cycles_completed: number;
  /** true when more services were due-by-now than have been completed */
  is_overdue: boolean;
}

/**
 * Returns the next maintenance event a machine is approaching based on its
 * accumulated tons_pumped, or null if no schedule applies to its type.
 *
 * `completedCount` is how many maintenance events the machine has actually
 * completed. When the machine has crossed more service thresholds than it has
 * completed services, it is OVERDUE: the forecast targets the first
 * un-serviced threshold (already behind it) and `tons_remaining` goes negative.
 */
export function forecastNextMaintenance(
  machineType: string,
  tonsPumped: number,
  schedules: ScheduleSummary[],
  completedCount = 0
): ForecastResult | null {
  const ofType = schedules.filter((s) => s.machine_type === machineType);
  if (ofType.length === 0) return null;

  const buildResult = (
    interval: number,
    kindForCycle: (cycle: number) => MaintenanceKind,
    scheduleFor: (kind: MaintenanceKind) => ScheduleSummary | undefined
  ): ForecastResult | null => {
    const dueByNow = Math.floor(tonsPumped / interval); // thresholds crossed
    const overdue = completedCount < dueByNow;
    // Overdue → first un-serviced threshold (behind us). Otherwise → the next
    // threshold after whichever is further along: thresholds crossed vs services done.
    const targetCycle = overdue ? completedCount + 1 : Math.max(dueByNow, completedCount) + 1;
    const kind = kindForCycle(targetCycle);
    const schedule = scheduleFor(kind);
    if (!schedule) return null;
    const nextAt = targetCycle * interval;
    return {
      next_kind: kind,
      next_at_tons: nextAt,
      tons_remaining: nextAt - tonsPumped, // negative when overdue
      schedule_id: schedule.id,
      cycles_completed: completedCount,
      is_overdue: overdue,
    };
  };

  // Single-kind type (МЗВ)
  const single = ofType.find((s) => s.alternates_with === null);
  if (single) {
    return buildResult(
      single.interval_tons,
      () => single.kind,
      () => single
    );
  }

  // Alternating ТО-1 / ТО-2 (МСЗ, МСЗУ, МЗУ). Odd cycle → ТО-1, even → ТО-2.
  const interval = ofType[0].interval_tons;
  return buildResult(
    interval,
    (cycle) => (cycle % 2 === 1 ? 'TO-1' : 'TO-2'),
    (kind) => ofType.find((s) => s.kind === kind)
  );
}

/** Fallback charging rate when a machine has too few shifts to infer its own. */
export const DEFAULT_TONS_PER_DAY = 30;

/** How many days before the due date a service request must be filed. */
export const REQUEST_LEAD_DAYS = 30;

export interface ShiftTonsPoint {
  /** planned_for or started_at — any parseable date string */
  date: string | null;
  actual_tons: number | null;
}

/**
 * Estimate a machine's real charging rate (tons/day) from its completed shifts.
 * Sums actual tons over the calendar span between the earliest and latest shift.
 * Returns null when there isn't enough signal (fewer than 2 dated shifts, or
 * all on the same day) — the caller then falls back to DEFAULT_TONS_PER_DAY.
 */
export function computeAvgTonsPerDay(shifts: ShiftTonsPoint[]): number | null {
  const points = shifts
    .filter((s) => s.actual_tons != null && s.actual_tons > 0 && s.date)
    .map((s) => ({ t: new Date(s.date as string).getTime(), tons: s.actual_tons as number }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return null;
  const totalTons = points.reduce((sum, p) => sum + p.tons, 0);
  const spanDays = (points[points.length - 1].t - points[0].t) / 86_400_000;
  if (spanDays < 1) return null;
  return totalTons / spanDays;
}

/**
 * Convert tons_remaining → estimated days using a daily charging rate.
 * Pass a rate computed from real shifts; defaults to DEFAULT_TONS_PER_DAY.
 */
export function estimateDaysUntilDue(
  tonsRemaining: number,
  avgTonsPerDay: number = DEFAULT_TONS_PER_DAY
): number {
  if (avgTonsPerDay <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(tonsRemaining / avgTonsPerDay);
}

export type MaintenanceUrgency = 'overdue' | 'due_soon' | 'upcoming' | 'ok';

/**
 * Urgency tier driven by estimated days-to-due. A request must be filed
 * REQUEST_LEAD_DAYS (30) before the due date, so anything within that window
 * (or already past) is the "act now" red zone.
 */
export function urgencyFromDays(days: number, tonsRemaining: number): MaintenanceUrgency {
  if (tonsRemaining <= 0 || days <= 0) return 'overdue';
  if (days <= REQUEST_LEAD_DAYS) return 'due_soon';
  if (days <= 60) return 'upcoming';
  return 'ok';
}
