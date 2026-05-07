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
  tons_remaining: number;
  schedule_id: string;
  /** how many ТО of this kind have already passed (0 if first one) */
  cycles_completed: number;
}

/**
 * Returns the next maintenance event a machine is approaching based on its
 * accumulated tons_pumped, or null if no schedule applies to its type.
 */
export function forecastNextMaintenance(
  machineType: string,
  tonsPumped: number,
  schedules: ScheduleSummary[]
): ForecastResult | null {
  const ofType = schedules.filter((s) => s.machine_type === machineType);
  if (ofType.length === 0) return null;

  // Single-kind type (МЗВ)
  const single = ofType.find((s) => s.alternates_with === null);
  if (single) {
    const cyclesCompleted = Math.floor(tonsPumped / single.interval_tons);
    const nextAt = (cyclesCompleted + 1) * single.interval_tons;
    return {
      next_kind: single.kind,
      next_at_tons: nextAt,
      tons_remaining: Math.max(0, nextAt - tonsPumped),
      schedule_id: single.id,
      cycles_completed: cyclesCompleted,
    };
  }

  // Alternating ТО-1 / ТО-2 (МСЗ, МСЗУ, МЗУ)
  // Baseline interval = 2000 t (smallest interval); kind alternates each cycle.
  const interval = ofType[0].interval_tons; // assume same for all kinds of one type
  const cyclesCompleted = Math.floor(tonsPumped / interval);
  const nextCycle = cyclesCompleted + 1; // 1-indexed

  // Convention:
  //   1st (cycle index 1) → ТО-1
  //   2nd (cycle index 2) → ТО-2
  //   3rd → ТО-1
  //   4th → ТО-2
  const expectedKind: MaintenanceKind = nextCycle % 2 === 1 ? 'TO-1' : 'TO-2';
  const schedule = ofType.find((s) => s.kind === expectedKind);
  if (!schedule) return null;

  const nextAt = nextCycle * interval;
  return {
    next_kind: expectedKind,
    next_at_tons: nextAt,
    tons_remaining: Math.max(0, nextAt - tonsPumped),
    schedule_id: schedule.id,
    cycles_completed: cyclesCompleted,
  };
}

/**
 * Convert tons_remaining → estimated days, assuming a default daily charging rate.
 * Tunable via the avgTonsPerDay parameter; default 30 t/day is a starting point
 * we'll calibrate from real shift data in Sprint 1.11.
 */
export function estimateDaysUntilDue(
  tonsRemaining: number,
  avgTonsPerDay = 30
): number {
  if (avgTonsPerDay <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(tonsRemaining / avgTonsPerDay);
}
