'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  Loader2,
  Truck,
  AlertCircle,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { TicketStatusBadge, TICKET_STATUS_LABELS } from '@/components/tickets/TicketStatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { SLATimer } from '@/components/tickets/SLATimer';
import { MessageBubble } from '@/components/tickets/MessageBubble';
import { PhotoUpload } from '@/components/tickets/PhotoUpload';
import { ResolveTicketDialog } from '@/components/tickets/ResolveTicketDialog';
import type { TicketStatus, MessageSender } from '@/lib/types';

interface TicketDetail {
  id: string;
  company_id: string;
  status: TicketStatus;
  priority: number;
  title: string | null;
  resolution_summary: string | null;
  originated_from: string | null;
  created_at: string;
  resolved_at: string | null;
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

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const { user } = useGlobal();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reply, setReply] = useState('');
  const [replyPhoto, setReplyPhoto] = useState<string | null>(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [sending, setSending] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<{ role: string; full_name: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();

        // Profile (for my role/name when sending messages)
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', user.id)
            .single();
          if (!cancelled && prof) setMyProfile(prof as { role: string; full_name: string });
        }

        // Ticket header
        const { data: ticketData, error: ticketErr } = await supabase
          .from('tickets')
          .select(
            'id, company_id, status, priority, title, resolution_summary, originated_from, created_at, resolved_at, machine:machines(id, model_code, machine_type, internal_name), operator:profiles!tickets_operator_id_fkey(id, full_name)'
          )
          .eq('id', ticketId)
          .maybeSingle();
        if (ticketErr) throw ticketErr;
        if (!ticketData) {
          if (!cancelled) setError('Тикет не найден или у вас нет к нему доступа');
          return;
        }
        if (!cancelled) setTicket(ticketData as unknown as TicketDetail);

        // Messages
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [ticketId, user]);

  // Realtime subscription to new messages on this ticket
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabaseRef: any = null;
    let cancelled = false;
    // Unique per mount avoids "add callbacks after subscribe()" when React
    // Strict Mode double-mounts and the previous async cleanup hasn't completed.
    const channelName = `ticket-${ticketId}-${Math.random().toString(36).slice(2, 10)}`;

    (async () => {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      supabaseRef = supabase;
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel = (supabase as any)
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ticket_messages',
            filter: `ticket_id=eq.${ticketId}`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async (payload: any) => {
            if (cancelled) return;
            const newRow = payload.new as MessageRow;
            const { data: sender } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newRow.sender_id)
              .single();
            const enriched: MessageRow = {
              ...newRow,
              sender: sender ? (sender as { full_name: string }) : null,
            };
            setMessages((prev) =>
              prev.find((m) => m.id === enriched.id) ? prev : [...prev, enriched]
            );
            setTimeout(scrollToBottom, 50);
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel && supabaseRef) {
        supabaseRef.removeChannel(channel);
      }
    };
  }, [ticketId, scrollToBottom]);

  // Scroll to bottom on initial load + when messages array grows
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const senderTypeForMe = ((): MessageSender => {
    const role = myProfile?.role;
    if (role === 'tier2_engineer' || role === 'platform_admin') return 'tier2';
    if (role === 'service_engineer' || role === 'project_manager') {
      return 'service_engineer';
    }
    return 'operator';
  })();

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() && !replyPhoto) return;

    setSending(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      const { error: insertErr } = await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_type: senderTypeForMe,
        sender_id: user!.id,
        text: reply.trim() || null,
        image_url: replyPhoto,
      });
      if (insertErr) throw insertErr;

      // If status was 'new' or 'awaiting_operator' and a service_engineer/tier2 replies →
      // bump to tier2_responding; if operator replies → keep as is or mark awaiting_operator depending.
      if (ticket && senderTypeForMe !== 'operator' && ticket.status === 'new') {
        await supabase
          .from('tickets')
          .update({ status: 'tier2_responding' })
          .eq('id', ticketId);
        setTicket({ ...ticket, status: 'tier2_responding' });
      } else if (ticket && senderTypeForMe === 'operator' && ticket.status === 'awaiting_operator') {
        await supabase
          .from('tickets')
          .update({ status: 'tier2_responding' })
          .eq('id', ticketId);
        setTicket({ ...ticket, status: 'tier2_responding' });
      }

      setReply('');
      setReplyPhoto(null);
      setShowPhotoUpload(false);

      // Operator messages trigger AI assistant: it reads the latest history
      // and posts a reply. Fire-and-forget so the operator isn't blocked by
      // Claude latency. AI itself bails out if the last message isn't from
      // the operator (e.g. an engineer cut in).
      if (senderTypeForMe === 'operator') {
        void fetch('/api/tickets/ai-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_id: ticketId }),
        }).catch(() => {
          // intentional — see comment above
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return;
    // Closing as 'resolved' goes through the dialog so we capture a
    // resolution_summary — that field powers the AI learning loop.
    if (newStatus === 'resolved') {
      setResolveDialogOpen(true);
      return;
    }
    setUpdatingStatus(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const update: {
        status: TicketStatus;
        resolved_at?: string | null;
        resolved_by?: string | null;
      } = { status: newStatus };
      if (newStatus === 'closed_self') {
        update.resolved_at = new Date().toISOString();
      } else {
        update.resolved_at = null;
      }
      const { error: updateErr } = await supabase
        .from('tickets')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(update as any)
        .eq('id', ticketId);
      if (updateErr) throw updateErr;
      setTicket({ ...ticket, ...update });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Persists status='resolved' + resolution_summary + resolved_at + resolved_by
  // in a single atomic update. Called by ResolveTicketDialog after the user
  // confirms.
  const handleResolveSubmit = async (resolutionSummary: string) => {
    if (!ticket) return;
    const client = await createSPASassClient();
    const supabase = client.getSupabaseClient();
    const update = {
      status: 'resolved' as TicketStatus,
      resolution_summary: resolutionSummary,
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id ?? null,
    };
    const { error: updateErr } = await supabase
      .from('tickets')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq('id', ticketId);
    if (updateErr) throw updateErr;
    setTicket({ ...ticket, ...update });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Загрузка тикета…
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/app/tickets"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> К списку тикетов
        </Link>
        <Card className="p-6 text-center">
          <AlertCircle className="w-8 h-8 text-accent-600 mx-auto mb-3" />
          <p className="text-secondary-900 font-medium">{error}</p>
        </Card>
      </div>
    );
  }

  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed_self';

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href="/app/tickets"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />К списку тикетов
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <TicketStatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <SLATimer createdAt={ticket.created_at} resolved={isResolved} />
            </div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-secondary-900">
              {ticket.title ?? <span className="text-secondary-400 italic">без темы</span>}
            </h1>
            <p className="text-sm text-secondary-600 mt-1">
              Создал: <span className="font-medium text-secondary-800">{ticket.operator?.full_name ?? '—'}</span>
              {ticket.machine && (
                <>
                  {' · '}машина:{' '}
                  <Link
                    href={`/app/machines/${ticket.machine.id}`}
                    className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
                  >
                    <Truck className="w-3 h-3" />
                    {ticket.machine.internal_name?.trim() || ticket.machine.model_code}
                    {ticket.machine.internal_name?.trim() && (
                      <span className="text-secondary-400 text-xs ml-1">· {ticket.machine.model_code}</span>
                    )}
                  </Link>
                </>
              )}
            </p>
          </div>

          {!isResolved && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                disabled={updatingStatus}
                className="max-w-[200px]"
                aria-label="Изменить статус тикета"
              >
                {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {TICKET_STATUS_LABELS[s].ru}
                  </option>
                ))}
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('resolved')}
                disabled={updatingStatus}
              >
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Закрыть как решённый
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Messages */}
      <Card className="p-4 md:p-6 min-h-[400px] flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh]">
          {messages.length === 0 ? (
            <p className="text-center text-secondary-400 italic py-8">Нет сообщений</p>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                text={m.text}
                imagePath={m.image_url}
                senderType={m.sender_type}
                senderName={m.sender?.full_name ?? '—'}
                createdAt={m.created_at}
                isOwn={m.sender_id === user?.id}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </Card>

      {/* Reply form */}
      {!isResolved && (
        <Card className="p-4">
          <form onSubmit={handleSendReply} className="space-y-3">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Ваш ответ…"
              rows={3}
              className="resize-none"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                {showPhotoUpload ? (
                  <PhotoUpload
                    companyId={ticket.company_id}
                    ticketId={ticket.id}
                    onUploaded={(p) => setReplyPhoto(p)}
                    onError={(e) => setError(e)}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPhotoUpload(true)}
                  >
                    <Camera className="w-4 h-4" />
                    Прикрепить фото
                  </Button>
                )}
              </div>
              <Button type="submit" disabled={sending || (!reply.trim() && !replyPhoto)}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Отправка…' : 'Отправить'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isResolved && ticket.resolution_summary && (
        <Card className="p-4 bg-emerald-50/50 border-emerald-200">
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700 mb-1">
            Решение
          </p>
          <p className="text-sm text-secondary-800 whitespace-pre-wrap">{ticket.resolution_summary}</p>
        </Card>
      )}

      <ResolveTicketDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        isAIEscalation={ticket.originated_from === 'ai_escalation'}
        onSubmit={handleResolveSubmit}
      />
    </div>
  );
}
