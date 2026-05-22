'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Truck,
  ClipboardCheck,
  MessageSquareText,
  Wrench,
  ChevronRight,
  Box,
  ShoppingCart,
  Activity,
} from 'lucide-react';
import { useGlobal, useRole } from '@/lib/context/GlobalContext';
import { createSPASassClient } from '@/lib/supabase/client';
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
  PartsRequestStatus,
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

interface ActiveShiftRow {
  id: string;
  status: 'in_progress' | 'planned' | 'blocked';
  started_at: string | null;
  planned_for: string | null;
  plan_tons: number | null;
  machine: { model_code: string; machine_type: string } | null;
}

export default function DashboardContent() {
  const t = useTranslations('dashboard');
  const tKind = useTranslations('kind_labels');
  const { loading: globalLoading, user } = useGlobal();
  const { isOperator, isProjectManager, isPlatformAdmin } = useRole();
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleFull[]>([]);
  const [shiftTons, setShiftTons] = useState<ShiftTonsRow[]>([]);
  const [activeRequestsCount, setActiveRequestsCount] = useState<number | null>(null);
  const [openTicketsCount, setOpenTicketsCount] = useState<number | null>(null);
  const [activeShifts, setActiveShifts] = useState<ActiveShiftRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const kindLabel = (kind: MaintenanceKind) => tKind(kind);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        // For the parts-requests KPI tile: count rows that need *this role's* attention.
        //   PM             → submitted (waiting on me to forward)
        //   platform_admin → forwarded / quoted / approved / ordered (queue I drive)
        //   else           → any active (legacy semantics)
        const requestsActionFilter: PartsRequestStatus[] | null = isProjectManager
          ? ['submitted']
          : isPlatformAdmin
          ? ['forwarded', 'quoted', 'approved', 'ordered']
          : null;

        const requestsCountQuery = supabase
          .from('parts_requests')
          .select('id', { count: 'exact', head: true });

        const [machinesResp, schedulesResp, requestsResp, ticketsResp, shiftsResp, shiftTonsResp] = await Promise.all([
          supabase
            .from('machines')
            .select('id, machine_type, model_code, internal_name, tons_pumped, status')
            .eq('status', 'active')
            .order('model_code'),
          supabase
            .from('maintenance_schedules')
            .select('id, machine_type, kind, interval_tons, alternates_with, work_items, parts_required, total_hours_norm'),
          requestsActionFilter
            ? requestsCountQuery.in('status', requestsActionFilter)
            : requestsCountQuery
                .neq('status', 'delivered')
                .neq('status', 'cancelled')
                .neq('status', 'received'),
          supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .neq('status', 'resolved')
            .neq('status', 'closed_self'),
          supabase
            .from('shifts')
            .select(
              'id, status, started_at, planned_for, plan_tons, machine:machines(model_code, machine_type)'
            )
            .in('status', ['in_progress', 'planned', 'blocked'])
            .order('started_at', { ascending: false, nullsFirst: false })
            .limit(5),
          // Completed shifts with actual tonnage — used to estimate each
          // machine's real charging rate (tons/day) for the forecast.
          supabase
            .from('shifts')
            .select('machine_id, actual_tons, planned_for, started_at')
            .eq('status', 'completed')
            .not('actual_tons', 'is', null)
            .order('planned_for', { ascending: false, nullsFirst: false })
            .limit(300),
        ]);
        setMachines((machinesResp.data ?? []) as MachineRow[]);
        setSchedules((schedulesResp.data ?? []) as unknown as ScheduleFull[]);
        setActiveRequestsCount(requestsResp.count ?? 0);
        setOpenTicketsCount(ticketsResp.count ?? 0);
        setActiveShifts((shiftsResp.data ?? []) as unknown as ActiveShiftRow[]);
        setShiftTons((shiftTonsResp.data ?? []) as ShiftTonsRow[]);
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [user]);

  // Per-machine charging rate (tons/day) from completed shifts.
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

  const upcomingMaintenance = useMemo(() => {
    return machines
      .map((m) => {
        const f = forecastNextMaintenance(m.machine_type, Number(m.tons_pumped), schedules);
        if (!f) return null;
        const rateInfo = rateByMachine[m.id] ?? { rate: DEFAULT_TONS_PER_DAY, isReal: false };
        const schedule = schedules.find((s) => s.id === f.schedule_id) ?? null;
        return {
          machine: m,
          forecast: f,
          days: estimateDaysUntilDue(f.tons_remaining, rateInfo.rate),
          rate: rateInfo.rate,
          rateIsReal: rateInfo.isReal,
          schedule,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.days - b.days)
      .slice(0, 3);
  }, [machines, schedules, rateByMachine]);

  const greeting = user?.full_name || user?.email?.split('@')[0] || t('default_greeting');
  const roleHero = isProjectManager
    ? {
        title: t('hero_pm_title'),
        subtitle: t('hero_pm_subtitle'),
      }
    : isOperator
    ? {
        title: t('hero_operator_title'),
        subtitle: t('hero_operator_subtitle'),
      }
    : { title: t('hero_default_title'), subtitle: '' };

  if (globalLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Hero — signature mesh-gradient surface */}
      <div className="rounded-xl mesh-hero text-white p-6 md:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent-600 z-10" />
        <div className="relative z-10">
          <p className="text-primary-200 text-xs font-semibold uppercase tracking-wider mb-2">
            {roleHero.title}
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold mb-2">
            {t('greeting', { name: greeting })}
          </h1>
          <p className="text-primary-100 max-w-2xl text-sm md:text-base">
            {roleHero.subtitle}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          icon={Truck}
          label={t('kpi_active_machines')}
          value={dataLoading ? '…' : machines.length}
          accent="primary"
          href="/app/machines"
        />
        <KPICard
          icon={Wrench}
          label={t('kpi_upcoming_maintenance')}
          value={dataLoading ? '…' : upcomingMaintenance.length}
          accent="warning"
          href="/app/maintenance"
        />
        <KPICard
          icon={ShoppingCart}
          label={
            isProjectManager
              ? t('kpi_pending_review')
              : isPlatformAdmin
              ? t('kpi_queue_npgm')
              : t('kpi_parts_requests')
          }
          value={dataLoading ? '…' : activeRequestsCount ?? 0}
          accent="success"
          href="/app/parts"
        />
        <KPICard
          icon={MessageSquareText}
          label={t('kpi_open_tickets')}
          value={dataLoading ? '…' : openTicketsCount ?? 0}
          accent="destructive"
          href="/app/tickets"
        />
      </div>

      {/* Active shifts now */}
      {!dataLoading && activeShifts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-semibold text-secondary-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              {t('section_active_shifts')}
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/shifts">
                {t('all_shifts')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {activeShifts.map((s) => {
              const blocked = s.status === 'blocked';
              return (
                <Link
                  key={s.id}
                  href={`/app/shifts/${s.id}`}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                    blocked
                      ? 'bg-accent-50/40 border-accent-200 hover:border-accent-300'
                      : 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`flex-shrink-0 inline-block w-2 h-2 rounded-full ${
                        blocked ? 'bg-accent-500' : 'bg-emerald-500 animate-pulse'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-secondary-900 truncate">
                        {s.machine?.model_code ?? '—'}{' '}
                        <span className="text-xs text-secondary-500">
                          ({s.machine?.machine_type ?? ''})
                        </span>
                      </p>
                      <p className="text-xs text-secondary-600">
                        {blocked
                          ? t('shift_blocked')
                          : s.status === 'in_progress'
                          ? t('shift_in_progress')
                          : t('shift_planned')}
                        {s.plan_tons
                          ? t('shift_plan_suffix', { tons: Number(s.plan_tons).toLocaleString('ru-RU') })
                          : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-secondary-400 flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Upcoming maintenance */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg font-semibold text-secondary-900">
            {t('section_upcoming_work')}
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/app/maintenance">
              {t('all_machines')}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {dataLoading ? (
          <Card className="p-6">
            <p className="text-sm text-secondary-500">{t('loading_forecast')}</p>
          </Card>
        ) : upcomingMaintenance.length === 0 ? (
          <Card className="p-6 text-center">
            <Truck className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
            <p className="text-secondary-600 text-sm">
              {t('no_active_machines')}{' '}
              <Link href="/app/machines/new" className="text-primary-600 hover:underline">
                {t('add_machine_link')}
              </Link>
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {upcomingMaintenance.map(({ machine, forecast, days, rate, rateIsReal, schedule }) => (
              <MaintenanceForecastCard
                key={machine.id}
                machineId={machine.id}
                machineLabel={machine.internal_name?.trim() || machine.model_code}
                machineType={machine.machine_type}
                modelCode={machine.model_code}
                kindLabel={kindLabel(forecast.next_kind)}
                tonsRemaining={forecast.tons_remaining}
                days={days}
                rate={rate}
                rateIsReal={rateIsReal}
                workItems={schedule?.work_items ?? []}
                partsRequired={schedule?.parts_required ?? []}
                totalHours={schedule?.total_hours_norm ?? null}
                requestHref={`/app/maintenance/new?machine=${machine.id}&schedule=${forecast.schedule_id}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-secondary-900 mb-3">
          {t('section_quick_access')}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <QuickLinkCard
            href="/app/machines"
            icon={Truck}
            title={t('quick_machines_title')}
            description={t('quick_machines_desc')}
          />
          <QuickLinkCard
            href="/app/tickets"
            icon={MessageSquareText}
            title={t('quick_tickets_title')}
            description={t('quick_tickets_desc')}
          />
          <QuickLinkCard
            href="/app/maintenance"
            icon={Wrench}
            title={t('quick_maintenance_title')}
            description={t('quick_maintenance_desc')}
          />
          <QuickLinkCard
            href="/app/parts"
            icon={Box}
            title={t('quick_parts_title')}
            description={t('quick_parts_desc')}
          />
          <QuickLinkCard
            href="/app/parts/request"
            icon={ShoppingCart}
            title={t('quick_order_parts_title')}
            description={t('quick_order_parts_desc')}
          />
          <QuickLinkCard
            href="/app/shifts"
            icon={ClipboardCheck}
            title={t('quick_shifts_title')}
            description={t('quick_shifts_desc')}
          />
        </div>
      </section>

      {/* What's already working */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">{t('platform_status_title')}</CardTitle>
          <CardDescription>{t('platform_status_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-secondary-700">
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>{t('feature_multi_tenant')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>{t('feature_dual_mileage')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>{t('feature_tickets')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>{t('feature_forecast')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>{t('feature_garage')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>{t('feature_shifts')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent-600 mt-1">●</span>
              <span>
                <strong>{t('feature_soon')}</strong> {t('feature_soon_desc')}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  accent,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent: 'primary' | 'success' | 'warning' | 'destructive';
  href: string;
}) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    destructive: 'bg-accent-50 text-accent-700',
  };
  return (
    <Link
      href={href}
      className="block bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-secondary-500 font-medium uppercase tracking-wider">{label}</p>
          <p className="font-heading text-2xl font-bold text-secondary-900 tabular-nums">{value}</p>
        </div>
      </div>
    </Link>
  );
}

function QuickLinkCard({
  href,
  icon: Icon,
  title,
  description,
  soon = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  soon?: boolean;
}) {
  const t = useTranslations('dashboard');
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 p-4 bg-white border border-secondary-200 rounded-xl hover:border-primary-300 hover:shadow-sm transition-all"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-medium text-secondary-900">{title}</h3>
          {soon && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-secondary-400">
              {t('soon')}
            </span>
          )}
        </div>
        <p className="text-sm text-secondary-600 mt-0.5 leading-snug">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-secondary-300 self-center" />
    </Link>
  );
}
