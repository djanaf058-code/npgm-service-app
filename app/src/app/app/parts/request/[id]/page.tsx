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
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import { RequestStatusBadge } from '@/components/parts/RequestStatusBadge';
import { RequestTimeline } from '@/components/parts/RequestTimeline';
import { RequestActionPanel } from '@/components/parts/RequestActionPanel';
import type {
  MaintenanceBomItem,
  MaintenanceFreeformItem,
  PartsRequestKind,
  PartsRequestStatus,
  PartsRequestUrgency,
} from '@/lib/types';

interface RequestDetail {
  id: string;
  company_id: string;
  kind: PartsRequestKind;
  parent_id: string | null;
  status: PartsRequestStatus;
  urgency: PartsRequestUrgency;
  parts_requested: MaintenanceBomItem[];
  parts_freeform: MaintenanceFreeformItem[];
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  submitted_at: string | null;
  consolidated_at: string | null;
  submitted_to_pm_at: string | null;
  forwarded_at: string | null;
  quoted_at: string | null;
  quote_notes: string | null;
  quote_total_amount: number | null;
  quote_currency: string | null;
  approved_at: string | null;
  ordered_at: string | null;
  expected_delivery_date: string | null;
  received_at: string | null;
  received_quantity_text: string | null;
  received_photo_url: string | null;
  received_notes: string | null;
  cancel_reason: string | null;
  machine: { id: string; model_code: string } | null;
  requester: { full_name: string } | null;
  submitted_to_pm_by_profile: { full_name: string } | null;
  forwarded_by_profile: { full_name: string } | null;
  quoted_by_profile: { full_name: string } | null;
  approved_by_profile: { full_name: string } | null;
  ordered_by_profile: { full_name: string } | null;
  received_by_profile: { full_name: string } | null;
  company: { name: string } | null;
}

interface ChildOperatorRow {
  id: string;
  status: PartsRequestStatus;
  urgency: PartsRequestUrgency;
  parts_requested: MaintenanceBomItem[];
  parts_freeform: MaintenanceFreeformItem[];
  machine: { model_code: string } | null;
  requester: { full_name: string } | null;
  created_at: string;
}

const URGENCY_LABELS: Record<
  PartsRequestUrgency,
  { ru: string; variant: React.ComponentProps<typeof Badge>['variant']; icon: React.ComponentType<{ className?: string }> | null }
> = {
  normal: { ru: 'Обычная', variant: 'outline', icon: null },
  urgent: { ru: 'Срочная', variant: 'warning', icon: AlertCircle },
  critical: { ru: 'Критическая', variant: 'destructive', icon: AlertTriangle },
};

export default function PartsRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [children, setChildren] = useState<ChildOperatorRow[]>([]);
  const [parent, setParent] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const { data, error: err } = await supabase
        .from('parts_requests')
        .select(
          [
            'id, company_id, kind, parent_id, status, urgency, parts_requested, parts_freeform, notes,',
            'created_at, resolved_at,',
            'submitted_at, consolidated_at, submitted_to_pm_at,',
            'forwarded_at, quoted_at, quote_notes, quote_total_amount, quote_currency,',
            'approved_at, ordered_at, expected_delivery_date,',
            'received_at, received_quantity_text, received_photo_url, received_notes, cancel_reason,',
            'machine:machines(id, model_code),',
            'requester:profiles!parts_requests_requested_by_fkey(full_name),',
            'submitted_to_pm_by_profile:profiles!parts_requests_submitted_to_pm_by_fkey(full_name),',
            'forwarded_by_profile:profiles!parts_requests_forwarded_by_fkey(full_name),',
            'quoted_by_profile:profiles!parts_requests_quoted_by_fkey(full_name),',
            'approved_by_profile:profiles!parts_requests_approved_by_fkey(full_name),',
            'ordered_by_profile:profiles!parts_requests_ordered_by_fkey(full_name),',
            'received_by_profile:profiles!parts_requests_received_by_fkey(full_name),',
            'company:companies(name)',
          ].join(' ')
        )
        .eq('id', requestId)
        .maybeSingle();
      if (err) throw err;
      if (!data) {
        setError('Заявка не найдена или у вас нет к ней доступа');
      } else {
        const detail = data as unknown as RequestDetail;
        setRequest(detail);
        // For consolidated rows, fetch the operator children too.
        if (detail.kind === 'consolidated') {
          const { data: ch } = await supabase
            .from('parts_requests')
            .select(
              'id, status, urgency, parts_requested, parts_freeform, created_at, machine:machines(model_code), requester:profiles!parts_requests_requested_by_fkey(full_name)'
            )
            .eq('parent_id', detail.id)
            .order('created_at', { ascending: true });
          setChildren((ch ?? []) as unknown as ChildOperatorRow[]);
          setParent(null);
        } else if (detail.parent_id) {
          // For operator rows that have been consolidated, just remember the parent id.
          setParent({ id: detail.parent_id });
          setChildren([]);
        } else {
          setChildren([]);
          setParent(null);
        }
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
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <RequestStatusBadge status={request.status} />
                <Badge variant={URGENCY_LABELS[request.urgency].variant}>
                  {UrgencyIcon && <UrgencyIcon className="w-3 h-3 inline mr-1" />}
                  {URGENCY_LABELS[request.urgency].ru}
                </Badge>
                {request.company?.name && (
                  <Badge variant="outline">{request.company.name}</Badge>
                )}
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
                Создал: <strong>{request.requester?.full_name ?? '—'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Action panel — kept right under the header for visibility */}
        <div className="mt-4 pt-4 border-t border-secondary-100">
          <RequestActionPanel
            requestId={request.id}
            status={request.status}
            kind={request.kind}
            companyId={request.company_id}
            onChanged={reload}
            onError={(e) => setError(e)}
          />
        </div>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Лента событий</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestTimeline
            kind={request.kind}
            status={request.status}
            submitted_at={request.submitted_at ?? request.created_at}
            consolidated_at={request.consolidated_at}
            submitted_to_pm_at={request.submitted_to_pm_at}
            forwarded_at={request.forwarded_at}
            quoted_at={request.quoted_at}
            quote_notes={request.quote_notes}
            quote_total_amount={request.quote_total_amount}
            quote_currency={request.quote_currency}
            approved_at={request.approved_at}
            ordered_at={request.ordered_at}
            expected_delivery_date={request.expected_delivery_date}
            received_at={request.received_at}
            received_quantity_text={request.received_quantity_text}
            received_notes={request.received_notes}
            cancel_reason={request.cancel_reason}
            submitted_to_pm_by_name={request.submitted_to_pm_by_profile?.full_name ?? null}
            forwarded_by_name={request.forwarded_by_profile?.full_name ?? null}
            quoted_by_name={request.quoted_by_profile?.full_name ?? null}
            approved_by_name={request.approved_by_profile?.full_name ?? null}
            ordered_by_name={request.ordered_by_profile?.full_name ?? null}
            received_by_name={request.received_by_profile?.full_name ?? null}
          />
        </CardContent>
      </Card>

      {/* For an operator-row that has been consolidated, link to the parent. */}
      {request.kind === 'operator' && parent && (
        <Card className="p-4 bg-secondary-50/40">
          <p className="text-sm text-secondary-700">
            Эта заявка вошла в сводную:{' '}
            <Link
              href={`/app/parts/request/${parent.id}`}
              className="text-primary-700 font-medium hover:underline"
            >
              открыть сводную →
            </Link>
          </p>
        </Card>
      )}

      {/* For a consolidated request, list its operator children. */}
      {request.kind === 'consolidated' && children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              Дочерние заявки операторов ({children.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-secondary-100">
              {children.map((c) => {
                const itemsCount = c.parts_requested.length + c.parts_freeform.length;
                return (
                  <li key={c.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                      <Badge variant="outline">{c.machine?.model_code ?? '—'}</Badge>
                      <span className="text-sm text-secondary-900">
                        {itemsCount} {itemsCount === 1 ? 'позиция' : 'позиций'}
                      </span>
                      {c.requester?.full_name && (
                        <span className="text-xs text-secondary-500">
                          · {c.requester.full_name}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/app/parts/request/${c.id}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      открыть →
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

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
            <CardTitle className="font-heading text-base">Примечания оператора</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-700 whitespace-pre-wrap">{request.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Received confirmation card */}
      {request.status === 'received' && request.received_photo_url && (
        <Card className="border-emerald-300 bg-emerald-50/30">
          <CardHeader>
            <CardTitle className="font-heading text-base">Подтверждение получения</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {request.received_quantity_text && (
                <p className="text-sm text-secondary-900">
                  <strong>Получено:</strong> {request.received_quantity_text}
                </p>
              )}
              {request.received_notes && (
                <p className="text-xs text-secondary-700 italic whitespace-pre-wrap">{request.received_notes}</p>
              )}
              <div className="max-w-xs">
                <PhotoUploader
                  bucket="parts-photos"
                  companyId={request.company_id}
                  context="received"
                  initialPath={request.received_photo_url}
                  onUploaded={() => {}}
                  onError={() => {}}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
