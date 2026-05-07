'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Truck,
  ClipboardCheck,
  MessageSquareText,
  Wrench,
  ChevronRight,
  Box,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClient } from '@/lib/supabase/client';
import {
  forecastNextMaintenance,
  estimateDaysUntilDue,
  type ScheduleSummary,
} from '@/lib/calculations/maintenance';
import type { MaintenanceKind } from '@/lib/types';

interface MachineRow {
  id: string;
  machine_type: string;
  model_code: string;
  tons_pumped: number;
  status: string;
}

const KIND_LABELS: Record<MaintenanceKind, string> = {
  TO: 'ТО',
  'TO-1': 'ТО-1',
  'TO-2': 'ТО-2',
  annual: 'Годовое ТО',
  unscheduled: 'Внеплановое',
};

export default function DashboardContent() {
  const { loading: globalLoading, user } = useGlobal();
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [activeRequestsCount, setActiveRequestsCount] = useState<number | null>(null);
  const [openTicketsCount, setOpenTicketsCount] = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const [machinesResp, schedulesResp, requestsResp, ticketsResp] = await Promise.all([
          supabase
            .from('machines')
            .select('id, machine_type, model_code, tons_pumped, status')
            .eq('status', 'active')
            .order('model_code'),
          supabase
            .from('maintenance_schedules')
            .select('id, machine_type, kind, interval_tons, alternates_with'),
          supabase
            .from('parts_requests')
            .select('id', { count: 'exact', head: true })
            .neq('status', 'delivered')
            .neq('status', 'cancelled'),
          supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .neq('status', 'resolved')
            .neq('status', 'closed_self'),
        ]);
        setMachines((machinesResp.data ?? []) as MachineRow[]);
        setSchedules((schedulesResp.data ?? []) as ScheduleSummary[]);
        setActiveRequestsCount(requestsResp.count ?? 0);
        setOpenTicketsCount(ticketsResp.count ?? 0);
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [user]);

  const upcomingMaintenance = useMemo(() => {
    return machines
      .map((m) => {
        const f = forecastNextMaintenance(m.machine_type, Number(m.tons_pumped), schedules);
        if (!f) return null;
        return {
          machine: m,
          forecast: f,
          days: estimateDaysUntilDue(f.tons_remaining),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.forecast.tons_remaining - b.forecast.tons_remaining)
      .slice(0, 3);
  }, [machines, schedules]);

  const greeting = user?.email?.split('@')[0] ?? 'оператор';

  if (globalLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-br from-primary-700 via-primary-800 to-secondary-900 text-white p-6 md:p-8 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent-600" />
        <div className="relative">
          <p className="text-primary-200 text-xs font-semibold uppercase tracking-wider mb-2">
            NPGM Service App · Pilot
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold mb-2">
            Здравствуйте, {greeting}
          </h1>
          <p className="text-primary-100 max-w-2xl text-sm md:text-base">
            Парк техники, плановое ТО, заявки на запчасти и техподдержка — в одном
            окне.
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          icon={Truck}
          label="Активных машин"
          value={dataLoading ? '…' : machines.length}
          accent="primary"
          href="/app/machines"
        />
        <KPICard
          icon={Wrench}
          label="ТО на горизонте"
          value={dataLoading ? '…' : upcomingMaintenance.length}
          accent="warning"
          href="/app/maintenance"
        />
        <KPICard
          icon={ShoppingCart}
          label="Заявок на запчасти"
          value={dataLoading ? '…' : activeRequestsCount ?? 0}
          accent="success"
          href="/app/parts"
        />
        <KPICard
          icon={MessageSquareText}
          label="Открытых тикетов"
          value={dataLoading ? '…' : openTicketsCount ?? 0}
          accent="destructive"
          href="/app/tickets"
        />
      </div>

      {/* Upcoming maintenance */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg font-semibold text-secondary-900">
            Ближайшие работы
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/app/maintenance">
              Все машины
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {dataLoading ? (
          <Card className="p-6">
            <p className="text-sm text-secondary-500">Загружаем прогноз ТО…</p>
          </Card>
        ) : upcomingMaintenance.length === 0 ? (
          <Card className="p-6 text-center">
            <Truck className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
            <p className="text-secondary-600 text-sm">
              Нет активных машин с настроенным регламентом ТО.{' '}
              <Link href="/app/machines/new" className="text-primary-600 hover:underline">
                Добавить машину →
              </Link>
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {upcomingMaintenance.map(({ machine, forecast, days }) => {
              const tonsRem = forecast.tons_remaining;
              const urgency =
                tonsRem === 0 ? 'critical' : tonsRem < 200 ? 'high' : tonsRem < 500 ? 'medium' : 'low';
              const urgencyStyle = {
                critical: 'border-accent-300 bg-accent-50/30',
                high: 'border-amber-300 bg-amber-50/30',
                medium: 'border-secondary-200',
                low: 'border-secondary-200',
              }[urgency];

              return (
                <Card key={machine.id} className={`p-4 ${urgencyStyle}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                        {urgency === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-accent-600" />
                        ) : (
                          <Truck className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-secondary-900">{machine.model_code}</h3>
                          <Badge variant="outline">{machine.machine_type}</Badge>
                        </div>
                        <p className="text-sm text-secondary-600 mt-0.5">
                          <strong>{KIND_LABELS[forecast.next_kind]}</strong> через{' '}
                          <strong className="tabular-nums">
                            {Number(tonsRem).toLocaleString('ru-RU')} тонн
                          </strong>
                          {days < 365 && <> · ≈ {days} дн</>}
                        </p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant={urgency === 'critical' ? 'default' : 'outline'}>
                      <Link
                        href={`/app/maintenance/new?machine=${machine.id}&schedule=${forecast.schedule_id}`}
                      >
                        Подать заявку
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-secondary-900 mb-3">
          Быстрый доступ
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <QuickLinkCard
            href="/app/machines"
            icon={Truck}
            title="Парк техники"
            description="Карточки СЗМ и буровых, наработка, история ТО"
          />
          <QuickLinkCard
            href="/app/tickets"
            icon={MessageSquareText}
            title="Тикеты"
            description="Связь оператор ↔ сервисный инженер с фото"
          />
          <QuickLinkCard
            href="/app/maintenance"
            icon={Wrench}
            title="ТО"
            description="Прогноз ТО по машинам и заявки на обслуживание"
          />
          <QuickLinkCard
            href="/app/parts"
            icon={Box}
            title="Гараж"
            description="Склад запчастей, остатки и заявки на закупку"
          />
          <QuickLinkCard
            href="/app/parts/request"
            icon={ShoppingCart}
            title="Заказать запчасти"
            description="Заявка вне ТО — просто нужны запчасти"
          />
          <QuickLinkCard
            href="/app/shifts"
            icon={ClipboardCheck}
            title="Смены и чек-листы"
            description="План зарядки, ежедневные осмотры"
            soon
          />
        </div>
      </section>

      {/* What's already working */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Что уже работает</CardTitle>
          <CardDescription>Технический фундамент платформы</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-secondary-700">
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>
                Multi-tenant регистрация компаний с изоляцией данных через Postgres RLS
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>
                Парк машин с двойной наработкой (моточасы + тонны прокачки)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>
                Тикеты с фото, real-time чат оператор ↔ Tier 2, привязка к машине
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>
                Прогноз ТО по тоннам прокачки + заявка с автозаполненным комплектом запчастей
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>
                Гараж: каталог + кастомные запчасти + фото + остатки с порогом пополнения
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent-600 mt-1">●</span>
              <span>
                <strong>Скоро:</strong> смены, чек-листы операторов, план зарядки
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
              скоро
            </span>
          )}
        </div>
        <p className="text-sm text-secondary-600 mt-0.5 leading-snug">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-secondary-300 self-center" />
    </Link>
  );
}
