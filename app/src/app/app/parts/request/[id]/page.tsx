'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Package,
  Calendar,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import type {
  MaintenanceBomItem,
  MaintenanceFreeformItem,
  PartsRequestStatus,
  PartsRequestUrgency,
} from '@/lib/types';

interface RequestDetail {
  id: string;
  company_id: string;
  status: PartsRequestStatus;
  urgency: PartsRequestUrgency;
  parts_requested: MaintenanceBomItem[];
  parts_freeform: MaintenanceFreeformItem[];
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  machine: { id: string; model_code: string } | null;
  requester: { full_name: string } | null;
}

const STATUS_LABELS: Record<PartsRequestStatus, { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  new: { ru: 'Новая', variant: 'destructive' },
  approved: { ru: 'Согласована', variant: 'warning' },
  ordered: { ru: 'Заказано', variant: 'default' },
  delivered: { ru: 'Получено', variant: 'success' },
  cancelled: { ru: 'Отменена', variant: 'secondary' },
};

const URGENCY_LABELS: Record<PartsRequestUrgency, { ru: string; variant: React.ComponentProps<typeof Badge>['variant']; icon: React.ComponentType<{ className?: string }> | null }> = {
  normal: { ru: 'Обычная', variant: 'outline', icon: null },
  urgent: { ru: 'Срочная', variant: 'warning', icon: AlertCircle },
  critical: { ru: 'Критическая', variant: 'destructive', icon: AlertTriangle },
};

export default function PartsRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const { data, error: err } = await supabase
        .from('parts_requests')
        .select(
          'id, company_id, status, urgency, parts_requested, parts_freeform, notes, created_at, resolved_at, machine:machines(id, model_code), requester:profiles!parts_requests_requested_by_fkey(full_name)'
        )
        .eq('id', requestId)
        .maybeSingle();
      if (err) throw err;
      if (!data) {
        setError('Заявка не найдена или у вас нет к ней доступа');
      } else {
        setRequest(data as unknown as RequestDetail);
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
  }, [requestId]);

  const updateStatus = async (newStatus: PartsRequestStatus) => {
    if (!request) return;
    setUpdating(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const update: { status: PartsRequestStatus; resolved_at?: string | null } = { status: newStatus };
      update.resolved_at =
        newStatus === 'delivered' || newStatus === 'cancelled' ? new Date().toISOString() : null;
      const { error: err } = await supabase.from('parts_requests').update(update).eq('id', requestId);
      if (err) throw err;
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус');
    } finally {
      setUpdating(false);
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

  if (error || !request) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/app/parts"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> К гаражу
        </Link>
        <Card className="p-6 text-center">
          <p className="text-accent-700 whitespace-pre-wrap">{error ?? 'Заявка не найдена'}</p>
        </Card>
      </div>
    );
  }

  const isClosed = request.status === 'delivered' || request.status === 'cancelled';
  const UrgencyIcon = URGENCY_LABELS[request.urgency].icon;

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href="/app/parts"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />К гаражу
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant={STATUS_LABELS[request.status].variant}>
                  {STATUS_LABELS[request.status].ru}
                </Badge>
                <Badge variant={URGENCY_LABELS[request.urgency].variant}>
                  {UrgencyIcon && <UrgencyIcon className="w-3 h-3 inline mr-1" />}
                  {URGENCY_LABELS[request.urgency].ru}
                </Badge>
              </div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-secondary-900">
                Заказ запчастей
                {request.machine && (
                  <>
                    {' — '}
                    <Link
                      href={`/app/machines/${request.machine.id}`}
                      className="text-primary-700 hover:underline"
                    >
                      {request.machine.model_code}
                    </Link>
                  </>
                )}
              </h1>
              <p className="text-sm text-secondary-600 mt-1">
                Создал: <strong>{request.requester?.full_name ?? '—'}</strong> ·{' '}
                <Calendar className="inline w-3 h-3" />{' '}
                {new Date(request.created_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {!isClosed && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={request.status}
                onChange={(e) => updateStatus(e.target.value as PartsRequestStatus)}
                disabled={updating}
                className="max-w-[200px]"
              >
                {(Object.keys(STATUS_LABELS) as PartsRequestStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s].ru}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </Card>

      {/* Catalog parts */}
      {request.parts_requested.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Из каталога ({request.parts_requested.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-secondary-100">
              {request.parts_requested.map((p, idx) => (
                <li key={idx} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="text-secondary-900">{p.display_name_ru}</span>
                  <span className="text-secondary-700 tabular-nums">{p.quantity} шт</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Freeform parts */}
      {request.parts_freeform.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Свободные позиции ({request.parts_freeform.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {request.parts_freeform.map((item, idx) => (
                <li key={idx} className="border border-secondary-200 rounded-lg p-3">
                  <p className="text-sm text-secondary-900 whitespace-pre-wrap">{item.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {item.quantity_estimate != null && (
                      <p className="text-xs text-secondary-500">кол-во ≈ {item.quantity_estimate}</p>
                    )}
                    {item.photo_url && (
                      <PhotoUploader
                        bucket="parts-photos"
                        companyId={request.company_id}
                        context="request-freeform"
                        initialPath={item.photo_url}
                        onUploaded={() => {}}
                        onError={() => {}}
                        compact
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {request.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Примечания</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-700 whitespace-pre-wrap">{request.notes}</p>
          </CardContent>
        </Card>
      )}

      {!isClosed && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => updateStatus('cancelled')} disabled={updating}>
            Отменить заявку
          </Button>
        </div>
      )}
    </div>
  );
}
