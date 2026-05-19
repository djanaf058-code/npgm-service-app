'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  ShoppingCart,
  ChevronRight,
  Inbox,
  Clock,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createSPASassClient } from '@/lib/supabase/client';
import { RequestStatusBadge } from '@/components/parts/RequestStatusBadge';
import type { PartsRequestStatus, PartsRequestUrgency } from '@/lib/types';

interface QueueRow {
  id: string;
  status: PartsRequestStatus;
  urgency: PartsRequestUrgency;
  created_at: string;
  expected_delivery_date: string | null;
  parts_requested: { display_name_ru: string; quantity: number }[];
  parts_freeform: { description: string }[];
  company: { id: string; name: string } | null;
}

const URGENCY_ICON: Record<
  PartsRequestUrgency,
  React.ComponentType<{ className?: string }> | null
> = {
  normal: null,
  urgent: AlertCircle,
  critical: AlertTriangle,
};

function sortByUrgencyAndDate(a: QueueRow, b: QueueRow): number {
  const order: PartsRequestUrgency[] = ['critical', 'urgent', 'normal'];
  const ua = order.indexOf(a.urgency);
  const ub = order.indexOf(b.urgency);
  if (ua !== ub) return ua - ub;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export default function AdminPartsQueuePage() {
  const t = useTranslations('admin_queue');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await createSPASassClient();
        const sb = c.getSupabaseClient();
        // RLS only lets platform_admin see kind='consolidated' that have been
        // forwarded+. Just ask for everything visible — server filters.
        const { data, error: err } = await sb
          .from('parts_requests')
          .select(
            'id, status, urgency, created_at, expected_delivery_date, parts_requested, parts_freeform, company:companies(id, name)'
          )
          .eq('kind', 'consolidated')
          .order('created_at', { ascending: false })
          .limit(200);
        if (err) throw err;
        if (cancelled) return;
        setRows((data ?? []) as unknown as QueueRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buckets = useMemo(() => {
    const readyForQuote = rows
      .filter((r) => r.status === 'forwarded')
      .sort(sortByUrgencyAndDate);
    const inFlight = rows
      .filter((r) => ['quoted', 'approved', 'ordered'].includes(r.status))
      .sort(sortByUrgencyAndDate);
    const history = rows
      .filter((r) => ['received', 'cancelled'].includes(r.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { readyForQuote, inFlight, history };
  }, [rows]);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          {t('title')}
        </h1>
        <p className="text-secondary-600 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {error && (
        <Card className="p-4 border-accent-300 bg-accent-50/30">
          <p className="text-sm text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center text-secondary-500 py-10">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('loading_queue')}
        </div>
      ) : (
        <>
          <Section
            title={t('section_for_quote', { n: buckets.readyForQuote.length })}
            subtitle={t('section_for_quote_desc')}
            icon={Inbox}
            items={buckets.readyForQuote}
            accent="amber"
          />
          <Section
            title={t('section_in_flight', { n: buckets.inFlight.length })}
            subtitle={t('section_in_flight_desc')}
            icon={ShoppingCart}
            items={buckets.inFlight}
          />
          {buckets.history.length > 0 && (
            <Section
              title={t('section_history', { n: buckets.history.length })}
              subtitle={t('section_history_desc')}
              icon={Clock}
              items={buckets.history.slice(0, 50)}
              muted
            />
          )}
          {!loading && rows.length === 0 && (
            <Card className="p-10 text-center">
              <ShoppingCart className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
              <p className="text-sm text-secondary-600">{t('empty_queue')}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  items,
  accent,
  muted = false,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  items: QueueRow[];
  accent?: 'amber';
  muted?: boolean;
}) {
  const t = useTranslations('admin_queue');
  if (items.length === 0) return null;
  const headerTone =
    accent === 'amber'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-secondary-700 bg-secondary-50 border-secondary-200';
  return (
    <section className={muted ? 'opacity-90' : ''}>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${headerTone} mb-2`}>
        <Icon className="w-4 h-4" />
        <h2 className="text-[11px] uppercase tracking-wider font-bold">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-secondary-500 px-3 mb-2">{subtitle}</p>}
      <div className="space-y-2">
        {items.map((r) => {
          const UIcon = URGENCY_ICON[r.urgency];
          const itemsCount = r.parts_requested.length + r.parts_freeform.length;
          const urgencyLabel =
            r.urgency === 'critical'
              ? t('urgency_critical')
              : r.urgency === 'urgent'
              ? t('urgency_urgent')
              : t('urgency_normal');
          const itemsLabel =
            itemsCount === 1
              ? t('items_count_one', { n: itemsCount })
              : itemsCount < 5
              ? t('items_count_few', { n: itemsCount })
              : t('items_count_many', { n: itemsCount });
          return (
            <Link
              key={r.id}
              href={`/app/parts/request/${r.id}`}
              className="block p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                  <RequestStatusBadge status={r.status} />
                  {r.company?.name && <Badge variant="outline">{r.company.name}</Badge>}
                  {r.urgency !== 'normal' && (
                    <Badge variant={r.urgency === 'critical' ? 'destructive' : 'warning'}>
                      {UIcon && <UIcon className="w-3 h-3 inline mr-1" />}
                      {urgencyLabel}
                    </Badge>
                  )}
                  <span className="text-sm text-secondary-900">{itemsLabel}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-xs text-secondary-500">
                  {r.expected_delivery_date && (
                    <span title={t('eta_label')}>
                      {t('eta_prefix')}{' '}
                      {new Date(r.expected_delivery_date).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  )}
                  <span>
                    {new Date(r.created_at).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                  <ChevronRight className="w-4 h-4 text-secondary-300" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
