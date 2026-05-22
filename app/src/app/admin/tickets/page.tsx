'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowUpDown,
  Building2,
  Loader2,
  Search,
  Truck,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TicketStatusBadge, TICKET_STATUS_LABELS } from '@/components/tickets/TicketStatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { SLATimer } from '@/components/tickets/SLATimer';
import type { TicketStatus } from '@/lib/types';

interface AdminTicketRow {
  id: string;
  company_id: string;
  status: TicketStatus;
  priority: number;
  title: string | null;
  created_at: string;
  resolved_at: string | null;
  company: { id: string; name: string } | null;
  machine: { id: string; model_code: string; machine_type: string; internal_name: string | null } | null;
  operator: { full_name: string } | null;
}

type StatusFilter = TicketStatus | 'all' | 'open';

export default function AdminTicketsPage() {
  const t = useTranslations('admin_tickets');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [companyFilter, setCompanyFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { data, error } = await supabase
          .from('tickets')
          .select(
            'id, company_id, status, priority, title, created_at, resolved_at, company:companies(id, name), machine:machines(id, model_code, machine_type, internal_name), operator:profiles!tickets_operator_id_fkey(full_name)'
          )
          .order('created_at', { ascending: false });
        if (error) throw error;
        setTickets((data ?? []) as unknown as AdminTicketRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('load_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const tk of tickets) {
      if (tk.company) map.set(tk.company.id, tk.company.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tickets]);

  const filtered = tickets.filter((tk) => {
    if (statusFilter === 'open' && (tk.status === 'resolved' || tk.status === 'closed_self')) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && tk.status !== statusFilter) return false;
    if (companyFilter !== 'all' && tk.company_id !== companyFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const inTitle = tk.title?.toLowerCase().includes(q);
      const inCompany = tk.company?.name.toLowerCase().includes(q);
      const inMachine =
        tk.machine?.model_code.toLowerCase().includes(q) ||
        (tk.machine?.internal_name?.toLowerCase().includes(q) ?? false);
      const inOperator = tk.operator?.full_name.toLowerCase().includes(q);
      return Boolean(inTitle || inCompany || inMachine || inOperator);
    }
    return true;
  });

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          {t('title')}
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <Input
            placeholder={t('search_placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-secondary-400" />
          <Select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="max-w-[220px]"
          >
            <option value="all">{t('all_companies')}</option>
            {companies.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-secondary-400" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="max-w-[200px]"
          >
            <option value="open">{t('filter_open')}</option>
            <option value="all">{t('filter_all')}</option>
            {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {t('filter_only_prefix', { label: TICKET_STATUS_LABELS[s].ru })}
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
        <Card className="p-12 text-center">
          <p className="text-secondary-600 text-sm">{t('no_tickets_empty')}</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-secondary-600 text-sm">{t('no_filter_match')}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((tk) => (
            <Link
              key={tk.id}
              href={`/admin/tickets/${tk.id}`}
              className="block bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <TicketStatusBadge status={tk.status} />
                    <PriorityBadge priority={tk.priority} />
                    <SLATimer
                      createdAt={tk.created_at}
                      resolved={tk.status === 'resolved' || tk.status === 'closed_self'}
                    />
                    {tk.company && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                        <Building2 className="w-3 h-3" />
                        {tk.company.name}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-secondary-900 truncate">
                    {tk.title ?? <span className="text-secondary-400 italic">{t('no_title_placeholder')}</span>}
                  </h3>
                  <p className="text-sm text-secondary-600 mt-0.5">
                    {tk.machine ? (
                      <span className="inline-flex items-center gap-1">
                        <Truck className="w-3 h-3 text-secondary-400" />
                        <span className="font-medium">
                          {tk.machine.internal_name?.trim() || tk.machine.model_code}
                        </span>
                        {tk.machine.internal_name?.trim() && (
                          <span className="text-xs text-secondary-400 ml-1">· {tk.machine.model_code}</span>
                        )}
                        {' · '}
                      </span>
                    ) : (
                      <span className="italic text-secondary-400">{t('no_machine')}</span>
                    )}
                    {t('operator_label', { name: tk.operator?.full_name ?? '—' })}
                  </p>
                </div>
                <div className="text-xs text-secondary-500 flex-shrink-0 text-right">
                  {new Date(tk.created_at).toLocaleString(dateLocale, {
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
