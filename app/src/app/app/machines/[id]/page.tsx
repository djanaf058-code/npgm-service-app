'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Truck,
  Calendar,
  MapPin,
  Hash,
  Gauge,
  Droplets,
  AlertCircle,
  Loader2,
  Trash2,
  Wrench,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MachineTypeBadge } from '@/components/machines/MachineTypeBadge';
import { MachineStatusBadge } from '@/components/machines/MachineStatusBadge';
import {
  forecastNextMaintenance,
  estimateDaysUntilDue,
  type ScheduleSummary,
  type ForecastResult,
} from '@/lib/calculations/maintenance';
import type { MaintenanceKind } from '@/lib/types';

interface MachineDetail {
  id: string;
  company_id: string;
  machine_type: string;
  model_code: string;
  tonnage_t: number;
  auger_position: 'upper' | 'lower' | 'none';
  has_drum: boolean;
  component_count: number;
  ggd_type: string | null;
  serial_number: string | null;
  in_service_since: string | null;
  pit_location: string | null;
  engine_hours: number;
  tons_pumped: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const AUGER_LABEL: Record<string, string> = {
  upper: 'Верхний (ВП)',
  lower: 'Нижний (НП)',
  none: 'Нет',
};

const GGD_LABEL: Record<string, string> = {
  SN: 'SN (нитрит натрия)',
  acetic_acid: 'Acetic Acid (уксусная кислота)',
};

const KIND_LABELS: Record<MaintenanceKind, string> = {
  TO: 'ТО',
  'TO-1': 'ТО-1',
  'TO-2': 'ТО-2',
  annual: 'Годовое ТО',
  unscheduled: 'Внеплановое',
};

export default function MachineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const [machineResp, schedulesResp] = await Promise.all([
          supabase.from('machines').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('maintenance_schedules')
            .select('id, machine_type, kind, interval_tons, alternates_with'),
        ]);

        if (machineResp.error) throw machineResp.error;
        if (!machineResp.data) {
          setError('Машина не найдена или у вас нет к ней доступа');
          return;
        }
        const m = machineResp.data as MachineDetail;
        setMachine(m);

        const schedules = (schedulesResp.data ?? []) as ScheduleSummary[];
        setForecast(forecastNextMaintenance(m.machine_type, Number(m.tons_pumped), schedules));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Удалить машину? Это действие необратимо.')) return;
    setDeleting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const { error } = await supabase.from('machines').delete().eq('id', id);
      if (error) throw error;
      router.push('/app/machines');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось удалить');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Загрузка…
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/app/machines"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> К списку машин
        </Link>
        <Card className="p-6 text-center">
          <AlertCircle className="w-8 h-8 text-accent-600 mx-auto mb-3" />
          <p className="text-secondary-900 font-medium">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <Link
        href="/app/machines"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> К списку машин
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
                {machine.model_code}
              </h1>
              <MachineTypeBadge type={machine.machine_type} />
              <MachineStatusBadge status={machine.status} />
            </div>
            <p className="text-secondary-600 text-sm mt-1">
              Грузоподъёмность {Number(machine.tonnage_t).toLocaleString('ru-RU')} т
              {machine.serial_number && (
                <>
                  {' · '}серийник{' '}
                  <span className="font-mono text-secondary-900">{machine.serial_number}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Удалить
        </Button>
      </div>

      {/* Stats: dual mileage */}
      <div className="grid md:grid-cols-2 gap-4">
        <StatCard
          icon={Gauge}
          label="Моточасы (двигатель, гидравлика)"
          value={Number(machine.engine_hours).toLocaleString('ru-RU')}
          unit="ч"
        />
        <StatCard
          icon={Droplets}
          label="Тонн прокачки (насосы, шланги, форсунки)"
          value={Number(machine.tons_pumped).toLocaleString('ru-RU')}
          unit="т"
          accent
        />
      </div>

      {/* Next maintenance forecast */}
      {forecast && (
        <NextMaintenanceCard
          machineId={machine.id}
          forecast={forecast}
          tonsPumped={Number(machine.tons_pumped)}
        />
      )}

      {/* Passport */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Паспорт машины</CardTitle>
          <CardDescription>Технические характеристики и привязка к месту работы</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <Row label="Тип" value={`${machine.machine_type}`} />
            <Row label="Модель" value={machine.model_code} mono />
            <Row label="Грузоподъёмность" value={`${machine.tonnage_t} т`} />
            <Row label="Серийник" value={machine.serial_number ?? '—'} mono />
            <Row
              label="В эксплуатации с"
              value={
                machine.in_service_since
                  ? new Date(machine.in_service_since).toLocaleDateString('ru-RU')
                  : '—'
              }
              icon={Calendar}
            />
            <Row label="Карьер" value={machine.pit_location ?? '—'} icon={MapPin} />
            {/* МСЗ — единственный тип, где положение шнека различает модификацию */}
            {machine.machine_type === 'МСЗ' && machine.auger_position !== 'none' && (
              <Row label="Положение шнека" value={AUGER_LABEL[machine.auger_position]} />
            )}
            {/* ГГД показываем только если фактически прописан */}
            {machine.ggd_type && (
              <Row label="ГГД" value={GGD_LABEL[machine.ggd_type]} />
            )}
          </dl>
        </CardContent>
      </Card>

      {machine.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Заметки</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-700 whitespace-pre-wrap">{machine.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Future-modules teaser */}
      <Card className="bg-secondary-50/60 border-dashed">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold mb-3">
            Скоро здесь появится
          </p>
          <ul className="space-y-1.5 text-sm text-secondary-700">
            <li>· Журнал ТО и расход запчастей (Sprint 3)</li>
            <li>· Назначенные операторы и их смены (Sprint 1.9 / Sprint 3)</li>
            <li>· Открытые тикеты по этой машине (Sprint 2)</li>
            <li>· Календарь планового ТО с автозаявкой к НИПИГОРМАШу (Sprint 3)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function NextMaintenanceCard({
  machineId,
  forecast,
  tonsPumped,
}: {
  machineId: string;
  forecast: ForecastResult;
  tonsPumped: number;
}) {
  const days = estimateDaysUntilDue(forecast.tons_remaining);
  const tonsRem = forecast.tons_remaining;
  const urgency =
    tonsRem === 0 ? 'critical' : tonsRem < 200 ? 'high' : tonsRem < 500 ? 'medium' : 'low';
  const styles = {
    critical: 'border-accent-300 bg-accent-50/30',
    high: 'border-amber-300 bg-amber-50/30',
    medium: 'border-secondary-200',
    low: 'border-secondary-200',
  }[urgency];

  return (
    <Card className={`p-5 ${styles}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading font-semibold text-secondary-900">Следующее ТО</h3>
              <Badge variant="default">{KIND_LABELS[forecast.next_kind]}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider font-semibold">
                  Через
                </p>
                <p className="font-bold text-secondary-900 tabular-nums">
                  {Number(tonsRem).toLocaleString('ru-RU')} тонн
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Примерно
                </p>
                <p className="font-bold text-secondary-900 tabular-nums">
                  {days < 365 ? `${days} дн` : '≥ года'}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider font-semibold">
                  ТО при выработке
                </p>
                <p className="font-bold text-secondary-900 tabular-nums">
                  {Number(forecast.next_at_tons).toLocaleString('ru-RU')} т
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-secondary-500">
              Текущая выработка: {Number(tonsPumped).toLocaleString('ru-RU')} тонн ·
              регламент машины — каждые 2000 тонн прокачки
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link
            href={`/app/maintenance/new?machine=${machineId}&schedule=${forecast.schedule_id}`}
          >
            Подать заявку
            <ChevronRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
            accent ? 'bg-accent-50 text-accent-600' : 'bg-primary-50 text-primary-600'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold">
            {label}
          </p>
          <p className="font-heading text-2xl font-bold text-secondary-900 mt-1 tabular-nums">
            {value} <span className="text-base font-normal text-secondary-500">{unit}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  mono = false,
  icon: Icon = Hash,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <dt className="flex items-center gap-2 text-secondary-500 flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </dt>
      <dd className={`text-secondary-900 text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
