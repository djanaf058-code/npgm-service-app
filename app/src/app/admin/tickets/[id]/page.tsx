'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowLeft,
  Loader2,
  Truck,
  Building2,
  User as UserIcon,
  Calendar,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { SLATimer } from '@/components/tickets/SLATimer';
import { MessageBubble } from '@/components/tickets/MessageBubble';
import type { TicketStatus, MessageSender } from '@/lib/types';

interface AdminTicketDetail {
  id: string;
  company_id: string;
  status: TicketStatus;
  priority: number;
  title: string | null;
  resolution_summary: string | null;
  originated_from: string | null;
  created_at: string;
  resolved_at: string | null;
  company: { id: string; name: string; country: string | null } | null;
  machine: { id: string; model_code: string; machine_type: string; internal_name: string | null } | null;
  operator: { id: string; full_name: string } | null;
}

interface MessageRow {
  id: string;
  ticket_id: string;
  sender_type: MessageSender;
  sender_id: string;
  text: string | null;
  image_url: string | null;
  created_at: string;
  sender: { full_name: string } | null;
}

export default function AdminTicketDetailPage() {
  const t = useTranslations('admin_tickets.detail');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const params = useParams<{ id: string }>();
  const ticketId = params.id;

  const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();

        const { data: ticketData, error: ticketErr } = await supabase
          .from('tickets')
          .select(
            'id, company_id, status, priority, title, resolution_summary, originated_from, created_at, resolved_at, company:companies(id, name, country), machine:machines(id, model_code, machine_type, internal_name), operator:profiles!tickets_operator_id_fkey(id, full_name)'
          )
          .eq('id', ticketId)
          .maybeSingle();
        if (ticketErr) throw ticketErr;
        if (!ticketData) {
          if (!cancelled) setError(t('not_found'));
          return;
        }
        if (!cancelled) setTicket(ticketData as unknown as AdminTicketDetail);

        const { data: msgData, error: msgErr } = await supabase
          .from('ticket_messages')
          .select(
            'id, ticket_id, sender_type, sender_id, text, image_url, created_at, sender:profiles!ticket_messages_sender_id_fkey(full_name)'
          )
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });
        if (msgErr) throw msgErr;
        if (!cancelled) setMessages((msgData ?? []) as unknown as MessageRow[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('error_load'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('loading_ticket')}
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link
          href="/admin/tickets"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />{t('back_to_list')}
        </Link>
        <Card className="p-6 text-center">
          <p className="text-accent-700">{error ?? t('load_failed')}</p>
        </Card>
      </div>
    );
  }

  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed_self';
  const isAIEscalation = ticket.originated_from === 'ai_escalation';

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href="/admin/tickets"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />{t('back_to_list')}
      </Link>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TicketStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <SLATimer createdAt={ticket.created_at} resolved={isResolved} />
            {isAIEscalation && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                <Sparkles className="w-3 h-3" />
                {t('ai_escalation_badge')}
              </span>
            )}
          </div>
          <span className="text-xs text-secondary-500">
            {t('created_label', { date: new Date(ticket.created_at).toLocaleString(dateLocale) })}
          </span>
        </div>

        <h1 className="font-heading text-xl md:text-2xl font-bold text-secondary-900 mb-2">
          {ticket.title ?? <span className="text-secondary-400 italic">{t('no_title_placeholder')}</span>}
        </h1>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-secondary-400" />
            <dt className="text-secondary-500">{t('company_label')}</dt>
            <dd className="font-medium">
              {ticket.company ? (
                <Link
                  href={`/admin/companies/${ticket.company.id}`}
                  className="text-primary-700 hover:underline"
                >
                  {ticket.company.name}
                </Link>
              ) : (
                '—'
              )}
              {ticket.company?.country && (
                <span className="text-xs text-secondary-400 ml-1">({ticket.company.country})</span>
              )}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-secondary-400" />
            <dt className="text-secondary-500">{t('machine_label')}</dt>
            <dd className="font-medium">
              {ticket.machine ? (
                <>
                  {ticket.machine.internal_name?.trim() || ticket.machine.model_code}
                  {ticket.machine.internal_name?.trim() && (
                    <span className="text-xs text-secondary-400 ml-1">
                      · {ticket.machine.model_code}
                    </span>
                  )}
                  <span className="text-xs text-secondary-500 ml-1">({ticket.machine.machine_type})</span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-secondary-400" />
            <dt className="text-secondary-500">{t('operator_label')}</dt>
            <dd className="font-medium">{ticket.operator?.full_name ?? '—'}</dd>
          </div>
          {ticket.resolved_at && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <dt className="text-secondary-500">{t('closed_label')}</dt>
              <dd className="font-medium">
                {new Date(ticket.resolved_at).toLocaleString(dateLocale)}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {isResolved && ticket.resolution_summary && (
        <Card className="p-5 bg-emerald-50 border-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-heading font-semibold text-emerald-900 mb-1">{t('resolution_title')}</h3>
              <p className="text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">
                {ticket.resolution_summary}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-heading font-semibold text-secondary-900 mb-3">
          {t('messages_title', { count: messages.length })}
        </h3>
        {messages.length === 0 ? (
          <p className="text-sm text-secondary-500 text-center py-6">
            {t('no_messages')}
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                text={m.text}
                imagePath={m.image_url}
                senderType={m.sender_type}
                senderName={m.sender?.full_name ?? '—'}
                createdAt={m.created_at}
                isOwn={false}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 bg-secondary-50 border-secondary-200">
        <p className="text-xs text-secondary-600">
          <strong>{t('readonly_strong')}</strong> {t('readonly_rest')} <code>/app/tickets</code>.
        </p>
      </Card>
    </div>
  );
}
