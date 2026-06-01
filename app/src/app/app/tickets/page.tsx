'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Plus, MessageSquareText, Loader2, Search, ArrowUpDown } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { TicketStatusBadge, TICKET_STATUSES } from '@/components/tickets/TicketStatusBadge';
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
  machine: { id: string; model_code: string; machine_type: string; internal_name: string | null } | null;
  operator: { full_name: string } | null;
}

export default function TicketsListPage() {
  const t = useTranslations('tickets');
  const tStatus = useTranslations('ticket_status');
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
            'id, status, priority, title, created_at, resolved_at, machine:machines(id, model_code, machine_type, internal_name), operator:profiles!tickets_operator_id_fkey(full_name)'
          )
          .order('created_at', { ascending: false });
        if (error) throw error;
        setTickets((data ?? []) as unknown as TicketRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('load_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = tickets.filter((t) => {
    if (statusFilter === 'open' && (t.status === 'resolved' || t.status === 'closed_self')) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const inTitle = t.title?.toLowerCase().includes(q);
      const inMachine =
        t.machine?.model_code.toLowerCase().includes(q) ||
        (t.machine?.internal_name?.toLowerCase().includes(q) ?? false);
      const inOperator = t.operator?.full_name.toLowerCase().includes(q);
      return Boolean(inTitle || inMachine || inOperator);
    }
    return true;
  });

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">{t('title')}</h1>
          <p className="text-secondary-600 text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/tickets/new">
            <Plus className="w-4 h-4" />
            {t('new_ticket')}
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <Input
            placeholder={t('search_placeholder')}
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
            <option value="open">{t('filter_open')}</option>
            <option value="all">{t('filter_all')}</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t('filter_only_prefix', { label: tStatus(s) })}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-secondary-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('loading_tickets')}
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <p className="text-accent-700">{error}</p>
        </Card>
      ) : tickets.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-secondary-600 text-sm">{t('no_filter_match')}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((tk) => (
            <Link
              key={tk.id}
              href={`/app/tickets/${tk.id}`}
              className="block bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <TicketStatusBadge status={tk.status} />
                    <PriorityBadge priority={tk.priority} />
                    <SLATimer createdAt={tk.created_at} resolved={tk.status === 'resolved' || tk.status === 'closed_self'} />
                  </div>
                  <h3 className="font-medium text-secondary-900 truncate">
                    {tk.title ?? <span className="text-secondary-400 italic">{t('no_title_placeholder')}</span>}
                  </h3>
                  <p className="text-sm text-secondary-600 mt-0.5">
                    {tk.machine ? (
                      <>
                        <span className="font-medium">{tk.machine.internal_name?.trim() || tk.machine.model_code}</span>
                        {' · '}
                      </>
                    ) : (
                      <span className="italic text-secondary-400">{t('no_machine')}</span>
                    )}
                    {t('operator_label', { name: tk.operator?.full_name ?? '—' })}
                  </p>
                </div>
                <div className="text-xs text-secondary-500 flex-shrink-0 text-right">
                  {new Date(tk.created_at).toLocaleString('ru-RU', {
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
  const t = useTranslations('tickets');
  return (
    <Card className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 mb-4">
        <MessageSquareText className="w-6 h-6" />
      </div>
      <h3 className="font-heading font-semibold text-secondary-900 mb-2">{t('no_tickets_title')}</h3>
      <p className="text-secondary-600 text-sm max-w-md mx-auto mb-6">
        {t('no_tickets_desc')}
      </p>
      <Button asChild>
        <Link href="/app/tickets/new">
          <Plus className="w-4 h-4" />
          {t('create_first')}
        </Link>
      </Button>
    </Card>
  );
}
