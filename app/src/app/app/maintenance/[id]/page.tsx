'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowLeft,
  Loader2,
  Wrench,
  Truck,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import type {
  MaintenanceKind,
  MaintenanceStatus,
  MaintenanceBomItem,
  MaintenanceFreeformItem,
  MaintenanceWorkItem,
} from '@/lib/types';

interface EventDetail {
  id: string;
  company_id: string;
  machine_id: string;
  schedule_id: string | null;
  kind: MaintenanceKind;
  status: MaintenanceStatus;
  tons_at_creation: number | null;
  forecast_tons: number | null;
  planned_date: string | null;
  completed_at: string | null;
  parts_requested: MaintenanceBomItem[];
  parts_freeform: MaintenanceFreeformItem[];
  works_performed: MaintenanceWorkItem[] | null;
  notes: string | null;
  created_at: string;
  machine: { id: string; model_code: string; machine_type: string } | null;
  schedule: { work_items: MaintenanceWorkItem[]; total_hours_norm: number | null } | null;
  requester: { full_name: string } | null;
}

const STATUS_VARIANTS: Record<MaintenanceStatus, React.ComponentProps<typeof Badge>['variant']> = {
  forecast: 'outline',
  requested: 'warning',
  planned: 'default',
  in_progress: 'default',
  completed: 'success',
  cancelled: 'secondary',
};

const STATUS_KEYS: MaintenanceStatus[] = [
  'forecast',
  'requested',
  'planned',
  'in_progress',
  'completed',
  'cancelled',
];

export default function MaintenanceEventPage() {
  const t = useTranslations('maintenance');
  const tKind = useTranslations('kind_labels');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';

  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useGlobal();
  const eventId = params.id;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  void user;

  const reload = async () => {
    setLoading(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const { data, error: err } = await supabase
        .from('maintenance_events')
        .select(
          'id, company_id, machine_id, schedule_id, kind, status, tons_at_creation, forecast_tons, planned_date, completed_at, parts_requested, parts_freeform, works_performed, notes, created_at, machine:machines(id, model_code, machine_type), schedule:maintenance_schedules(work_items, total_hours_norm), requester:profiles!maintenance_events_requested_by_fkey(full_name)'
        )
        .eq('id', eventId)
        .maybeSingle();
      if (err) throw err;
      if (!data) {
        setError(t('detail.not_found'));
      } else {
        setEvent(data as unknown as EventDetail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('detail.load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const updateStatus = async (newStatus: MaintenanceStatus) => {
    if (!event) return;
    setUpdatingStatus(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const update: { status: MaintenanceStatus; completed_at?: string | null } = { status: newStatus };
      if (newStatus === 'completed') {
        update.completed_at = new Date().toISOString();
      } else {
        update.completed_at = null;
      }
      const { error: err } = await supabase
        .from('maintenance_events')
        .update(update)
        .eq('id', eventId);
      if (err) throw err;
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('detail.status_change_failed'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('detail.loading')}
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/app/maintenance"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> {t('detail.back')}
        </Link>
        <Card className="p-6 text-center">
          <AlertCircle className="w-6 h-6 text-accent-600 mx-auto mb-3" />
          <p className="text-accent-700 whitespace-pre-wrap">{error ?? t('detail.not_found')}</p>
        </Card>
      </div>
    );
  }

  const isClosed = event.status === 'completed' || event.status === 'cancelled';

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href="/app/maintenance"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('detail.back')}
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant={STATUS_VARIANTS[event.status]}>
                  {t(`status.${event.status}`)}
                </Badge>
                <Badge variant="outline">{tKind(event.kind)}</Badge>
              </div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-secondary-900">
                {tKind(event.kind)} —{' '}
                {event.machine ? (
                  <Link
                    href={`/app/machines/${event.machine.id}`}
                    className="hover:underline text-primary-700"
                  >
                    {event.machine.model_code}
                  </Link>
                ) : (
                  '—'
                )}
              </h1>
              <p className="text-sm text-secondary-600 mt-1">
                {t('detail.created_by')}: <strong>{event.requester?.full_name ?? '—'}</strong> ·{' '}
                {new Date(event.created_at).toLocaleString(dateLocale, {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {event.planned_date && (
                  <>
                    {' · '}
                    <Calendar className="inline w-3 h-3" /> {t('detail.plan_prefix')}{' '}
                    {new Date(event.planned_date).toLocaleDateString(dateLocale)}
                  </>
                )}
              </p>
            </div>
          </div>

          {!isClosed && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={event.status}
                onChange={(e) => updateStatus(e.target.value as MaintenanceStatus)}
                disabled={updatingStatus}
                className="max-w-[200px]"
              >
                {STATUS_KEYS.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus('completed')}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {t('detail.close')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Forecast info */}
      {(event.tons_at_creation !== null || event.forecast_tons !== null) && (
        <Card className="p-4 bg-primary-50/30 border-primary-100">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold">
                {t('detail.tons_at_creation')}
              </p>
              <p className="font-bold text-secondary-900 tabular-nums">
                {event.tons_at_creation !== null
                  ? Number(event.tons_at_creation).toLocaleString(dateLocale)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold">
                {t('detail.forecast_tons_at')}
              </p>
              <p className="font-bold text-secondary-900 tabular-nums">
                {event.forecast_tons !== null
                  ? `${Number(event.forecast_tons).toLocaleString(dateLocale)} ${t('detail.tons_short')}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold">
                {t('detail.machine')}
              </p>
              <p className="font-bold text-secondary-900">
                {event.machine?.machine_type ?? '—'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Parts requested */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Truck className="w-4 h-4" /> {t('detail.parts_requested_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {event.parts_requested.length === 0 ? (
            <p className="text-sm text-secondary-500 italic">{t('detail.parts_requested_empty')}</p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {event.parts_requested.map((p, idx) => (
                <li key={idx} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="text-secondary-900">{p.display_name_ru}</span>
                  <span className="text-secondary-700 tabular-nums">
                    {p.quantity} {t('detail.qty_short')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Freeform parts */}
      {event.parts_freeform.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">{t('detail.freeform_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {event.parts_freeform.map((item, idx) => (
                <li key={idx} className="border border-secondary-200 rounded-lg p-3">
                  <p className="text-sm text-secondary-900 whitespace-pre-wrap">
                    {item.description}
                  </p>
                  {item.quantity_estimate != null && (
                    <p className="text-xs text-secondary-500 mt-1">
                      {t('detail.freeform_qty_estimate', { qty: item.quantity_estimate })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Schedule work items */}
      {event.schedule && event.schedule.work_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              {t('detail.work_items_title', { count: event.schedule.work_items.length })}
              {event.schedule.total_hours_norm && (
                <span className="ml-2 text-secondary-500 font-normal text-sm">
                  {t('detail.work_items_total_hours', { hours: event.schedule.total_hours_norm })}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-secondary-800 list-decimal list-inside">
              {event.schedule.work_items.map((w, idx) => (
                <li key={idx} className="flex items-baseline gap-2">
                  <span className="flex-1">{w.name_ru}</span>
                  {w.hours_norm && (
                    <span className="text-xs text-secondary-500 tabular-nums">
                      {t('detail.work_item_hours', { hours: w.hours_norm })}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {event.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">{t('detail.notes_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-700 whitespace-pre-wrap">{event.notes}</p>
          </CardContent>
        </Card>
      )}

      {!isClosed && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => updateStatus('cancelled')}
            disabled={updatingStatus}
          >
            <XCircle className="w-4 h-4" />
            {t('detail.cancel_request')}
          </Button>
        </div>
      )}

      {void router}
    </div>
  );
}
