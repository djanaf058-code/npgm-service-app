'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, MessageSquareText, Loader2, Search, ArrowUpDown } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { TicketStatusBadge, TICKET_STATUS_LABELS } from '@/components/tickets/TicketStatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { SLATimer } from '@/components/tickets/SLATimer';
import type { TicketStatus } from '@/lib/types';

interface TicketRow {
  id: string;
  status: TicketStatus;
  priority: number;
  title: string | null;
  created_at: string;
  resolved_at: string | null;
  machine: { id: string; model_code: string; machine_type: string } | null;
  operator: { full_name: string } | null;
}

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all' | 'open'>('open');

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { data, error } = await supabase
          .from('tickets')
          .select(
            'id, status, priority, title, created_at, resolved_at, machine:machines(id, model_code, machine_type), operator:profiles!tickets_operator_id_fkey(full_name)'
          )
          .order('created_at', { ascending: false });
        if (error) throw error;
        setTickets((data ?? []) as unknown as TicketRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить тикеты');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = tickets.filter((t) => {
    if (statusFilter === 'open' && (t.status === 'resolved' || t.status === 'closed_self')) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const inTitle = t.title?.toLowerCase().includes(q);
      const inMachine = t.machine?.model_code.toLowerCase().includes(q);
      const inOperator = t.operator?.full_name.toLowerCase().includes(q);
      return Boolean(inTitle || inMachine || inOperator);
    }
    return true;
  });

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">Тикеты</h1>
          <p className="text-secondary-600 text-sm mt-1">
            Связь оператор ↔ сервисный инженер. История, статус, SLA.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/tickets/new">
            <Plus className="w-4 h-4" />
            Новый тикет
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <Input
            placeholder="Поиск по теме, машине, оператору…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-secondary-400" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="max-w-[200px]"
          >
            <option value="open">Все открытые</option>
            <option value="all">Все тикеты</option>
            {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                Только: {TICKET_STATUS_LABELS[s].ru}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-secondary-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Загружаем тикеты…
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <p className="text-accent-700">{error}</p>
        </Card>
      ) : tickets.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-secondary-600 text-sm">Нет тикетов под текущий фильтр</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/app/tickets/${t.id}`}
              className="block bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <TicketStatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                    <SLATimer createdAt={t.created_at} resolved={t.status === 'resolved' || t.status === 'closed_self'} />
                  </div>
                  <h3 className="font-medium text-secondary-900 truncate">
                    {t.title ?? <span className="text-secondary-400 italic">без темы</span>}
                  </h3>
                  <p className="text-sm text-secondary-600 mt-0.5">
                    {t.machine ? (
                      <>
                        <span className="font-medium">{t.machine.model_code}</span>
                        {' · '}
                      </>
                    ) : (
                      <span className="italic text-secondary-400">машина не указана · </span>
                    )}
                    оператор: {t.operator?.full_name ?? '—'}
                  </p>
                </div>
                <div className="text-xs text-secondary-500 flex-shrink-0 text-right">
                  {new Date(t.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 mb-4">
        <MessageSquareText className="w-6 h-6" />
      </div>
      <h3 className="font-heading font-semibold text-secondary-900 mb-2">Тикетов пока нет</h3>
      <p className="text-secondary-600 text-sm max-w-md mx-auto mb-6">
        Создайте первый тикет, когда нужна помощь сервисного инженера. Прикрепите фото
        неисправности — инженер увидит контекст сразу.
      </p>
      <Button asChild>
        <Link href="/app/tickets/new">
          <Plus className="w-4 h-4" />
          Создать тикет
        </Link>
      </Button>
    </Card>
  );
}
