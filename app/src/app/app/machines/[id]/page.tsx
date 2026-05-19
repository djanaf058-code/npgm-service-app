'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { useRole } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MachineTypeBadge } from '@/components/machines/MachineTypeBadge';
import { MachineStatusBadge } from '@/components/machines/MachineStatusBadge';
import { MachineOperatorsSection } from '@/components/machines/MachineOperatorsSection';
import { AIChatDrawer } from '@/components/ai-chat/AIChatDrawer';
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

export default function MachineDetailPage() {
  const t = useTranslations('machines');
  const tCommon = useTranslations('common');
  const tKind = useTranslations('kind_labels');
  const augerLabel = (pos: string): string => {
    if (pos === 'upper') return t('auger_upper');
    if (pos === 'lower') return t('auger_lower');
    return t('auger_none');
  };
  const ggdLabel = (g: string): string => (g === 'SN' ? t('ggd_sn') : t('ggd_acetic'));
  const kindLabel = (k: MaintenanceKind) => tKind(k);
  const { canManageCompany, isOperator } = useRole();
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
          setError(t('not_found'));
          return;
        }
        const m = machineResp.data as MachineDetail;
        setMachine(m);

        const schedules = (schedulesResp.data ?? []) as ScheduleSummary[];
        setForecast(forecastNextMaintenance(m.machine_type, Number(m.tons_pumped), schedules));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loading_error'));
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(t('confirm_delete'))) return;
    setDeleting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const { error } = await supabase.from('machines').delete().eq('id', id);
      if (error) throw error;
      router.push('/app/machines');
    } catch (err) {
      alert(err instanceof Error ? err.message : t('delete_failed'));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {tCommon('loading')}
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
          <ArrowLeft className="w-4 h-4" /> {t('back_to_list')}
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
        <ArrowLeft className="w-4 h-4" /> {t('back_to_list')}
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
              {t('tonnage_t', { t: Number(machine.tonnage_t).toLocaleString('ru-RU') })}
              {machine.serial_number && (
                <>
                  {' · '}{t('serial_label')}{' '}
                  <span className="font-mono text-secondary-900">{machine.serial_number}</span>
                </>
              )}
            </p>
          </div>
        </div>
        {canManageCompany && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {tCommon('delete')}
          </Button>
        )}
      </div>

      {/* Stats: dual mileage */}
      <div className="grid md:grid-cols-2 gap-4">
        <StatCard
          icon={Gauge}
          label={t('stat_engine_hours')}
          value={Number(machine.engine_hours).toLocaleString('ru-RU')}
          unit={tCommon('hours_short')}
        />
        <StatCard
          icon={Droplets}
          label={t('stat_tons_pumped')}
          value={Number(machine.tons_pumped).toLocaleString('ru-RU')}
          unit={tCommon('tons_short')}
          accent
        />
      </div>

      {/* Next maintenance forecast */}
      {forecast && (
        <NextMaintenanceCard
          machineId={machine.id}
          forecast={forecast}
          tonsPumped={Number(machine.tons_pumped)}
          kindLabel={kindLabel}
        />
      )}

      {/* Passport */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">{t('passport_title')}</CardTitle>
          <CardDescription>{t('passport_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <Row label={t('row_type')} value={`${machine.machine_type}`} />
            <Row label={t('row_model')} value={machine.model_code} mono />
            <Row label={t('row_tonnage')} value={`${machine.tonnage_t} ${tCommon('tons_short')}`} />
            <Row label={t('row_serial')} value={machine.serial_number ?? '—'} mono />
            <Row
              label={t('row_in_service')}
              value={
                machine.in_service_since
                  ? new Date(machine.in_service_since).toLocaleDateString('ru-RU')
                  : '—'
              }
              icon={Calendar}
            />
            <Row label={t('row_pit')} value={machine.pit_location ?? '—'} icon={MapPin} />
            {/* МСЗ — единственный тип, где положение шнека различает модификацию */}
            {machine.machine_type === 'МСЗ' && machine.auger_position !== 'none' && (
              <Row label={t('row_auger')} value={augerLabel(machine.auger_position)} />
            )}
            {/* ГГД показываем только если фактически прописан */}
            {machine.ggd_type && (
              <Row label={t('row_ggd')} value={ggdLabel(machine.ggd_type)} />
            )}
          </dl>
        </CardContent>
      </Card>

      {machine.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">{t('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-700 whitespace-pre-wrap">{machine.notes}</p>
          </CardContent>
        </Card>
      )}

      <MachineOperatorsSection machineId={machine.id} companyId={machine.company_id} />

      {isOperator && (
        <AIChatDrawer machineId={machine.id} machineLabel={machine.model_code} />
      )}
    </div>
  );
}

function NextMaintenanceCard({
  machineId,
  forecast,
  tonsPumped,
  kindLabel,
}: {
  machineId: string;
  forecast: ForecastResult;
  tonsPumped: number;
  kindLabel: (k: MaintenanceKind) => string;
}) {
  const t = useTranslations('machines');
  const tCommon = useTranslations('common');
  const tDash = useTranslations('dashboard');
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
              <h3 className="font-heading font-semibold text-secondary-900">{t('next_maintenance')}</h3>
              <Badge variant="default">{kindLabel(forecast.next_kind)}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider font-semibold">
                  {t('next_through')}
                </p>
                <p className="font-bold text-secondary-900 tabular-nums">
                  {Number(tonsRem).toLocaleString('ru-RU')} {tDash('tons_unit')}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {t('next_approx')}
                </p>
                <p className="font-bold text-secondary-900 tabular-nums">
                  {days < 365 ? t('approx_days', { days }) : t('approx_year_plus')}
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500 uppercase tracking-wider font-semibold">
                  {t('next_at_output')}
                </p>
                <p className="font-bold text-secondary-900 tabular-nums">
                  {Number(forecast.next_at_tons).toLocaleString('ru-RU')} {tCommon('tons_short')}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-secondary-500">
              {t('current_output_hint', { tons: Number(tonsPumped).toLocaleString('ru-RU') })}
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link
            href={`/app/maintenance/new?machine=${machineId}&schedule=${forecast.schedule_id}`}
          >
            {tDash('submit_request')}
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
