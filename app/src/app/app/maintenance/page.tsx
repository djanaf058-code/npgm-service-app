'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Wrench, Truck, Loader2, AlertCircle, Clock, ChevronRight, Plus } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  forecastNextMaintenance,
  estimateDaysUntilDue,
  type ScheduleSummary,
} from '@/lib/calculations/maintenance';
import type { MaintenanceKind, MaintenanceStatus } from '@/lib/types';

interface MachineRow {
  id: string;
  machine_type: string;
  model_code: string;
  tons_pumped: number;
  status: string;
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
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [activeEvents, setActiveEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();

        const [machinesResp, schedulesResp, eventsResp] = await Promise.all([
          supabase
            .from('machines')
            .select('id, machine_type, model_code, tons_pumped, status')
            .order('model_code'),
          supabase
            .from('maintenance_schedules')
            .select('id, machine_type, kind, interval_tons, alternates_with'),
          supabase
            .from('maintenance_events')
            .select(
              'id, machine_id, kind, status, forecast_tons, planned_date, created_at, machine:machines(model_code)'
            )
            .neq('status', 'completed')
            .neq('status', 'cancelled')
            .order('planned_date', { ascending: true, nullsFirst: false }),
        ]);

        if (machinesResp.error) throw machinesResp.error;
        if (schedulesResp.error) throw schedulesResp.error;
        if (eventsResp.error) throw eventsResp.error;

        setMachines((machinesResp.data ?? []) as MachineRow[]);
        setSchedules((schedulesResp.data ?? []) as ScheduleSummary[]);
        setActiveEvents((eventsResp.data ?? []) as unknown as EventRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('list.load_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

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
          schedules
        );
        const inFlight = inFlightByMachine.get(m.id) ?? [];
        const blocking = forecast
          ? inFlight.find((e) => e.kind === forecast.next_kind)
          : null;
        return { machine: m, forecast, blockingEvent: blocking };
      });
  }, [machines, schedules, activeEvents]);

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
                {forecasts.map(({ machine, forecast, blockingEvent }) => (
                  <ForecastCard
                    key={machine.id}
                    machine={machine}
                    forecast={forecast}
                    blockingEvent={blockingEvent}
                  />
                ))}
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

function ForecastCard({
  machine,
  forecast,
  blockingEvent,
}: {
  machine: MachineRow;
  forecast: ReturnType<typeof forecastNextMaintenance>;
  blockingEvent: EventRow | null | undefined;
}) {
  const t = useTranslations('maintenance');
  const tKind = useTranslations('kind_labels');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';

  if (!forecast) {
    return (
      <Card className="p-4 border-dashed">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-secondary-400" />
          <div>
            <p className="font-medium text-secondary-900">{machine.model_code}</p>
            <p className="text-sm text-secondary-500">
              {t('list.no_schedule_for_type', { type: machine.machine_type })}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const days = estimateDaysUntilDue(forecast.tons_remaining);
  const tonsRem = forecast.tons_remaining;
  const urgency =
    tonsRem === 0
      ? 'critical'
      : tonsRem < 200
        ? 'high'
        : tonsRem < 500
          ? 'medium'
          : 'low';

  const urgencyStyle = {
    critical: 'border-accent-300 bg-accent-50/30',
    high: 'border-amber-300 bg-amber-50/30',
    medium: 'border-secondary-200',
    low: 'border-secondary-200',
  }[urgency];

  return (
    <Card className={`p-4 ${urgencyStyle}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-secondary-900">{machine.model_code}</h3>
              <Badge variant="outline">{machine.machine_type}</Badge>
              {blockingEvent && (
                <Badge variant="warning">
                  {t('list.request_already_submitted')}
                </Badge>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider">
                  {t('list.next')}
                </p>
                <p className="font-semibold text-secondary-900">
                  {tKind(forecast.next_kind)}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider">{t('list.through')}</p>
                <p className="font-semibold text-secondary-900 tabular-nums">
                  {Number(forecast.tons_remaining).toLocaleString(dateLocale)} {t('list.tons_unit')}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t('list.approx')}
                </p>
                <p className="font-semibold text-secondary-900 tabular-nums">
                  {days < 365 ? t('list.approx_days', { days }) : t('list.approx_year_plus')}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-secondary-500">
              {t('list.current_output', {
                current: Number(machine.tons_pumped).toLocaleString(dateLocale),
                next: Number(forecast.next_at_tons).toLocaleString(dateLocale),
              })}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {blockingEvent ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/maintenance/${blockingEvent.id}`}>
                {t('list.open_request')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link
                href={`/app/maintenance/new?machine=${machine.id}&kind=${forecast.next_kind}&schedule=${forecast.schedule_id}`}
              >
                <Plus className="w-4 h-4" />
                {t('list.submit_request')}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
