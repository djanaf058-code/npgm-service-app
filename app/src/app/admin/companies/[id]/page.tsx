'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Building2,
  Truck,
  MessageSquareText,
  ShoppingCart,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createSPASassClient } from '@/lib/supabase/client';
import { RequestStatusBadge } from '@/components/parts/RequestStatusBadge';
import type { PartsRequestKind, PartsRequestStatus, PartsRequestUrgency } from '@/lib/types';

interface Company {
  id: string;
  name: string;
  country: string;
  language: string;
  timezone: string;
  created_at: string;
}

interface MachineRow {
  id: string;
  machine_type: string;
  model_code: string;
  status: string;
  pit_location: string | null;
  tons_pumped: number;
}

interface TicketRow {
  id: string;
  status: string;
  title: string;
  created_at: string;
}

interface PartsRequestRow {
  id: string;
  kind: PartsRequestKind;
  status: PartsRequestStatus;
  urgency: PartsRequestUrgency;
  created_at: string;
  expected_delivery_date: string | null;
}

export default function AdminCompanyOverviewPage() {
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const [company, setCompany] = useState<Company | null>(null);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [requests, setRequests] = useState<PartsRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await createSPASassClient();
        const sb = c.getSupabaseClient();

        const [companyResp, machinesResp, ticketsResp, requestsResp] = await Promise.all([
          sb.from('companies').select('*').eq('id', companyId).maybeSingle(),
          sb
            .from('machines')
            .select('id, machine_type, model_code, status, pit_location, tons_pumped')
            .eq('company_id', companyId)
            .order('model_code')
            .limit(20),
          sb
            .from('tickets')
            .select('id, status, title, created_at')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(10),
          sb
            .from('parts_requests')
            .select('id, kind, status, urgency, created_at, expected_delivery_date')
            .eq('company_id', companyId)
            .eq('kind', 'consolidated')
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        if (companyResp.error) throw companyResp.error;
        if (machinesResp.error) throw machinesResp.error;
        if (ticketsResp.error) throw ticketsResp.error;
        if (requestsResp.error) throw requestsResp.error;

        if (cancelled) return;
        setCompany(companyResp.data as Company | null);
        setMachines((machinesResp.data ?? []) as MachineRow[]);
        setTickets((ticketsResp.data ?? []) as TicketRow[]);
        setRequests((requestsResp.data ?? []) as PartsRequestRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Загрузка…
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-6 max-w-2xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Все компании
        </Link>
        <Card className="p-6 text-center">
          <p className="text-accent-700 whitespace-pre-wrap">{error ?? 'Компания не найдена'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" /> Все компании
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-secondary-900">
              {company.name}
            </h1>
            <p className="text-sm text-secondary-500">
              {company.country || '—'} · {company.language} · {company.timezone}
            </p>
          </div>
        </div>
      </Card>

      {/* Machines */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary-600" />
            Парк техники ({machines.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {machines.length === 0 ? (
            <p className="text-sm text-secondary-500">У компании пока нет машин.</p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {machines.map((m) => (
                <li
                  key={m.id}
                  className="py-2 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Badge variant="outline">{m.machine_type}</Badge>
                    <span className="text-sm font-medium text-secondary-900">{m.model_code}</span>
                    {m.pit_location && (
                      <span className="text-xs text-secondary-500">· {m.pit_location}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-secondary-500">
                    <span className="tabular-nums">
                      {Number(m.tons_pumped).toLocaleString('ru-RU')} т
                    </span>
                    <Link
                      href={`/app/machines/${m.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      открыть →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tickets */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-primary-600" />
            Последние тикеты ({tickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="text-sm text-secondary-500">Тикетов пока нет.</p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {tickets.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 truncate text-sm text-secondary-900">
                    {t.title}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline">{t.status}</Badge>
                    <Link
                      href={`/app/tickets/${t.id}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      открыть →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Parts requests */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary-600" />
            Сводные заявки ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-secondary-500">Сводных заявок пока нет.</p>
          ) : (
            <ul className="divide-y divide-secondary-100">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="py-2 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <RequestStatusBadge status={r.status} />
                    {r.urgency !== 'normal' && (
                      <Badge variant={r.urgency === 'critical' ? 'destructive' : 'warning'}>
                        {r.urgency}
                      </Badge>
                    )}
                    <span className="text-xs text-secondary-500">
                      {new Date(r.created_at).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs text-secondary-500">
                    {r.expected_delivery_date && (
                      <span>
                        ETA{' '}
                        {new Date(r.expected_delivery_date).toLocaleDateString('ru-RU', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    )}
                    <Link
                      href={`/app/parts/request/${r.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      открыть →
                    </Link>
                    <ChevronRight className="w-4 h-4 text-secondary-300" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
