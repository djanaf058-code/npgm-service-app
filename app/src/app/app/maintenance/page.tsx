'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Wrench, Truck, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  forecastNextMaintenance,
  estimateDaysUntilDue,
  computeAvgTonsPerDay,
  DEFAULT_TONS_PER_DAY,
  type ScheduleSummary,
} from '@/lib/calculations/maintenance';
import { MaintenanceForecastCard } from '@/components/maintenance/MaintenanceForecastCard';
import type {
  MaintenanceKind,
  MaintenanceStatus,
  MaintenanceWorkItem,
  MaintenanceBomItem,
} from '@/lib/types';

interface MachineRow {
  id: string;
  machine_type: string;
  model_code: string;
  internal_name: string | null;
  tons_pumped: number;
  status: string;
}

interface ScheduleFull extends ScheduleSummary {
  work_items: MaintenanceWorkItem[] | null;
  parts_required: MaintenanceBomItem[] | null;
  total_hours_norm: number | null;
}

interface ShiftTonsRow {
  machine_id: string;
  actual_tons: number | null;
  planned_for: string | null;
  started_at: string | null;
}

interface EventRow {
  id: string;
  machine_id: string;
  kind: MaintenanceKind;
  status: MaintenanceStatus;
  forecast_tons: number | null;
  planned_date: string | null;
  created_at: string;
  machine: { model_code: string } | null;
}

const STATUS_VARIANTS: Record<MaintenanceStatus, React.ComponentProps<typeof Badge>['variant']> = {
  forecast: 'outline',
  requested: 'warning',
  planned: 'default',
  in_progress: 'default',
  completed: 'success',
  cancelled: 'secondary',
};

export default function MaintenancePage() {
  const t = useTranslations('maintenance');
  const tKind = useTranslations('kind_labels');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';

  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleFull[]>([]);
  const [activeEvents, setActiveEvents] = useState<EventRow[]>([]);
  const [shiftTons, setShiftTons] = useState<ShiftTonsRow[]>([]);
  const [completedByMachine, setCompletedByMachine] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();

        const [machinesResp, schedulesResp, eventsResp, shiftTonsResp, completedEventsResp] = await Promise.all([
          supabase
            .from('machines')
            .select('id, machine_type, model_code, internal_name, tons_pumped, status')
            .order('model_code'),
          supabase
            .from('maintenance_schedules')
            .select('id, machine_type, kind, interval_tons, alternates_with, work_items, parts_required, total_hours_norm'),
          supabase
            .from('maintenance_events')
            .select(
              'id, machine_id, kind, status, forecast_tons, planned_date, created_at, machine:machines(model_code)'
            )
            .neq('status', 'completed')
            .neq('status', 'cancelled')
            .order('planned_date', { ascending: true, nullsFirst: false }),
          supabase
            .from('shifts')
            .select('machine_id, actual_tons, planned_for, started_at')
            .eq('status', 'completed')
            .not('actual_tons', 'is', null)
            .order('planned_for', { ascending: false, nullsFirst: false })
            .limit(300),
          supabase
            .from('maintenance_events')
            .select('machine_id')
            .eq('status', 'completed'),
        ]);

        if (machinesResp.error) throw machinesResp.error;
        if (schedulesResp.error) throw schedulesResp.error;
        if (eventsResp.error) throw eventsResp.error;

        setMachines((machinesResp.data ?? []) as MachineRow[]);
        setSchedules((schedulesResp.data ?? []) as unknown as ScheduleFull[]);
        setActiveEvents((eventsResp.data ?? []) as unknown as EventRow[]);
        setShiftTons((shiftTonsResp.data ?? []) as ShiftTonsRow[]);
        const counts: Record<string, number> = {};
        for (const e of (completedEventsResp.data ?? []) as { machine_id: string }[]) {
          counts[e.machine_id] = (counts[e.machine_id] ?? 0) + 1;
        }
        setCompletedByMachine(counts);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('list.load_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  const rateByMachine = useMemo(() => {
    const grouped: Record<string, { date: string | null; actual_tons: number | null }[]> = {};
    for (const s of shiftTons) {
      (grouped[s.machine_id] ??= []).push({
        date: s.planned_for ?? s.started_at,
        actual_tons: s.actual_tons,
      });
    }
    const map: Record<string, { rate: number; isReal: boolean }> = {};
    for (const [mid, pts] of Object.entries(grouped)) {
      const real = computeAvgTonsPerDay(pts);
      map[mid] = real != null ? { rate: real, isReal: true } : { rate: DEFAULT_TONS_PER_DAY, isReal: false };
    }
    return map;
  }, [shiftTons]);

  /**
   * For each active machine, compute the next maintenance forecast
   * (skipping machines that already have a non-completed event of the
   * predicted kind in flight).
   */
  const forecasts = useMemo(() => {
    const inFlightByMachine = new Map<string, EventRow[]>();
    for (const ev of activeEvents) {
      const arr = inFlightByMachine.get(ev.machine_id) ?? [];
      arr.push(ev);
      inFlightByMachine.set(ev.machine_id, arr);
    }

    return machines
      .filter((m) => m.status === 'active')
      .map((m) => {
        const forecast = forecastNextMaintenance(
          m.machine_type,
          Number(m.tons_pumped),
          schedules,
          completedByMachine[m.id] ?? 0
        );
        const inFlight = inFlightByMachine.get(m.id) ?? [];
        const blocking = forecast
          ? inFlight.find((e) => e.kind === forecast.next_kind)
          : null;
        const rateInfo = rateByMachine[m.id] ?? { rate: DEFAULT_TONS_PER_DAY, isReal: false };
        const schedule = forecast ? schedules.find((s) => s.id === forecast.schedule_id) ?? null : null;
        return { machine: m, forecast, blockingEvent: blocking, rateInfo, schedule };
      })
      .sort((a, b) => {
        // Machines without a schedule sink to the bottom; otherwise by urgency (days).
        if (!a.forecast) return 1;
        if (!b.forecast) return -1;
        const da = estimateDaysUntilDue(a.forecast.tons_remaining, a.rateInfo.rate);
        const db = estimateDaysUntilDue(b.forecast.tons_remaining, b.rateInfo.rate);
        return da - db;
      });
  }, [machines, schedules, activeEvents, rateByMachine, completedByMachine]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          {t('list.title')}
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          {t('list.subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-secondary-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('list.loading')}
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <AlertCircle className="w-6 h-6 text-accent-600 mx-auto mb-3" />
          <p className="text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      ) : (
        <>
          {/* Forecast for each machine */}
          <section>
            <h2 className="font-heading text-lg font-semibold text-secondary-900 mb-3">
              {t('list.section_upcoming')}
            </h2>
            {forecasts.length === 0 ? (
              <Card className="p-12 text-center">
                <Truck className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
                <p className="text-secondary-600">
                  {t('list.no_active_machines')}{' '}
                  <Link href="/app/machines/new" className="text-primary-600 hover:underline">
                    {t('list.add_machine_link')}
                  </Link>
                </p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {forecasts.map(({ machine, forecast, blockingEvent, rateInfo, schedule }) => {
                  if (!forecast) {
                    return (
                      <Card key={machine.id} className="p-4 border-dashed">
                        <div className="flex items-center gap-3">
                          <Truck className="w-5 h-5 text-secondary-400" />
                          <div>
                            <p className="font-medium text-secondary-900">
                              {machine.internal_name?.trim() || machine.model_code}
                            </p>
                            <p className="text-sm text-secondary-500">
                              {t('list.no_schedule_for_type', { type: machine.machine_type })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  }
                  return (
                    <MaintenanceForecastCard
                      key={machine.id}
                      machineId={machine.id}
                      machineLabel={machine.internal_name?.trim() || machine.model_code}
                      machineType={machine.machine_type}
                      modelCode={machine.model_code}
                      kindLabel={tKind(forecast.next_kind)}
                      tonsRemaining={forecast.tons_remaining}
                      days={estimateDaysUntilDue(forecast.tons_remaining, rateInfo.rate)}
                      rate={rateInfo.rate}
                      rateIsReal={rateInfo.isReal}
                      workItems={schedule?.work_items ?? []}
                      partsRequired={schedule?.parts_required ?? []}
                      totalHours={schedule?.total_hours_norm ?? null}
                      requestHref={`/app/maintenance/new?machine=${machine.id}&kind=${forecast.next_kind}&schedule=${forecast.schedule_id}`}
                      blockingHref={blockingEvent ? `/app/maintenance/${blockingEvent.id}` : null}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Active events (requests in flight) */}
          {activeEvents.length > 0 && (
            <section>
              <h2 className="font-heading text-lg font-semibold text-secondary-900 mb-3">
                {t('list.section_active_events')}
              </h2>
              <div className="space-y-2">
                {activeEvents.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/app/maintenance/${ev.id}`}
                    className="block bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Wrench className="w-5 h-5 text-primary-600" />
                        <div>
                          <p className="font-medium text-secondary-900">
                            {tKind(ev.kind)} ·{' '}
                            <span className="text-primary-700">
                              {ev.machine?.model_code ?? '—'}
                            </span>
                          </p>
                          <p className="text-xs text-secondary-500">
                            {t('list.created_label')}{' '}
                            {new Date(ev.created_at).toLocaleString(dateLocale, {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {ev.planned_date && (
                              <>
                                {' · '}
                                {t('list.plan_label')}{' '}
                                {new Date(ev.planned_date).toLocaleDateString(dateLocale)}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANTS[ev.status]}>
                          {t(`status.${ev.status}`)}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-secondary-300" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
