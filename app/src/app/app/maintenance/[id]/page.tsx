'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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

const STATUS_LABELS: Record<MaintenanceStatus, { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  forecast: { ru: 'Прогноз', variant: 'outline' },
  requested: { ru: 'Заявка подана', variant: 'warning' },
  planned: { ru: 'Запланировано', variant: 'default' },
  in_progress: { ru: 'В работе', variant: 'default' },
  completed: { ru: 'Выполнено', variant: 'success' },
  cancelled: { ru: 'Отменено', variant: 'secondary' },
};

const KIND_LABELS: Record<MaintenanceKind, string> = {
  TO: 'ТО',
  'TO-1': 'ТО-1',
  'TO-2': 'ТО-2',
  annual: 'Годовое ТО',
  unscheduled: 'Внеплановое',
};

export default function MaintenanceEventPage() {
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
        setError('Заявка не найдена или у вас нет к ней доступа');
      } else {
        setEvent(data as unknown as EventDetail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
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
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус');
    } finally {
      setUpdatingStatus(false);
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

  if (error || !event) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/app/maintenance"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> К списку ТО
        </Link>
        <Card className="p-6 text-center">
          <AlertCircle className="w-6 h-6 text-accent-600 mx-auto mb-3" />
          <p className="text-accent-700 whitespace-pre-wrap">{error ?? 'Заявка не найдена'}</p>
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
        <ArrowLeft className="w-4 h-4" />К списку ТО
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
                <Badge variant={STATUS_LABELS[event.status].variant}>
                  {STATUS_LABELS[event.status].ru}
                </Badge>
                <Badge variant="outline">{KIND_LABELS[event.kind]}</Badge>
              </div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-secondary-900">
                {KIND_LABELS[event.kind]} —{' '}
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
                Создал: <strong>{event.requester?.full_name ?? '—'}</strong> ·{' '}
                {new Date(event.created_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {event.planned_date && (
                  <>
                    {' · '}
                    <Calendar className="inline w-3 h-3" /> план:{' '}
                    {new Date(event.planned_date).toLocaleDateString('ru-RU')}
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
                {(Object.keys(STATUS_LABELS) as MaintenanceStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s].ru}
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
                Закрыть
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
                Тонн при создании
              </p>
              <p className="font-bold text-secondary-900 tabular-nums">
                {event.tons_at_creation !== null
                  ? Number(event.tons_at_creation).toLocaleString('ru-RU')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold">
                Прогноз ТО при
              </p>
              <p className="font-bold text-secondary-900 tabular-nums">
                {event.forecast_tons !== null
                  ? `${Number(event.forecast_tons).toLocaleString('ru-RU')} т`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-secondary-500 font-semibold">
                Машина
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
            <Truck className="w-4 h-4" /> Запрошенные запчасти
          </CardTitle>
        </CardHeader>
        <CardContent>
          {event.parts_requested.length === 0 ? (
            <p className="text-sm text-secondary-500 italic">Запчасти не указаны</p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {event.parts_requested.map((p, idx) => (
                <li key={idx} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="text-secondary-900">{p.display_name_ru}</span>
                  <span className="text-secondary-700 tabular-nums">{p.quantity} шт</span>
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
            <CardTitle className="font-heading text-base">Дополнительные запчасти</CardTitle>
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
                      кол-во ≈ {item.quantity_estimate}
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
              Перечень работ ({event.schedule.work_items.length})
              {event.schedule.total_hours_norm && (
                <span className="ml-2 text-secondary-500 font-normal text-sm">
                  · {event.schedule.total_hours_norm} н/ч суммарно
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
                      {w.hours_norm} н/ч
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
            <CardTitle className="font-heading text-base">Примечания</CardTitle>
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
            Отменить заявку
          </Button>
        </div>
      )}

      {void router}
    </div>
  );
}
