'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Send,
  Loader2,
  Truck,
  AlertCircle,
  CheckCircle2,
  Camera,
  Package,
  Siren,
  X as XIcon,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { TicketStatusBadge, TICKET_STATUSES } from '@/components/tickets/TicketStatusBadge';
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
  const locale = useLocale();
  // dateLocale unused here — MessageBubble already handles its own date locale.
  void locale;
  const t = useTranslations('ticket_detail');
  const tStatus = useTranslations('ticket_status');

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reply, setReply] = useState('');
  const [replyPhoto, setReplyPhoto] = useState<string | null>(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [sending, setSending] = useState(false);
  // True while we expect an AI reply to land — shown as a "typing" bubble at
  // the end of the messages list. Cleared when (a) an AI message actually
  // arrives, or (b) a safety timeout fires (in case the AI request failed
  // silently).
  const [aiPending, setAiPending] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<{ role: string; full_name: string } | null>(null);

  // "Need a part" — engineer flags a part needed for the fix → routes to admin.
  const [needPartOpen, setNeedPartOpen] = useState(false);
  const [partDesc, setPartDesc] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partSubmitting, setPartSubmitting] = useState(false);
  const [partDone, setPartDone] = useState(false);

  // SOS — direct escalation to NPGM team. Confirm → POST → toast.
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosBanner, setSosBanner] = useState<string | null>(null);

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
          if (!cancelled) setError(t('not_found'));
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
        if (!cancelled) setError(err instanceof Error ? err.message : t('load_error'));
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

  // Watch the messages list and decide whether "AI is typing" should be shown:
  //  - last message is AI → clear (reply landed)
  //  - last message is operator, recent (<60s), ticket has a machine → show
  //    (also catches the case where we mount on a freshly-created ticket
  //    whose AI reply is still in flight from /app/tickets/new)
  //  - anything else → leave aiPending unchanged (an engineer cut in, etc.)
  useEffect(() => {
    if (!ticket?.machine || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender_type === 'ai') {
      setAiPending(false);
      return;
    }
    if (last.sender_type === 'operator') {
      const ageMs = Date.now() - new Date(last.created_at).getTime();
      if (ageMs < 60_000) setAiPending(true);
    }
  }, [messages, ticket?.machine]);

  // Safety net: if the AI request silently fails or takes too long, drop the
  // typing bubble after 60s so the user isn't stuck staring at it forever.
  useEffect(() => {
    if (!aiPending) return;
    const t = setTimeout(() => setAiPending(false), 60_000);
    return () => clearTimeout(t);
  }, [aiPending]);

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

      // Engineer/tier2 replies to a new ticket → "tier2 responding".
      // Operator replies to an "awaiting operator" ticket → it goes BACK into
      // the engineer's queue as needs-response ('new'), NOT "tier2 responding"
      // (the engineer hasn't replied yet — the operator just answered).
      if (ticket && senderTypeForMe !== 'operator' && ticket.status === 'new') {
        await supabase.from('tickets').update({ status: 'tier2_responding' }).eq('id', ticketId);
        setTicket({ ...ticket, status: 'tier2_responding' });
      } else if (ticket && senderTypeForMe === 'operator' && ticket.status === 'awaiting_operator') {
        await supabase.from('tickets').update({ status: 'new' }).eq('id', ticketId);
        setTicket({ ...ticket, status: 'new' });
      }

      setReply('');
      setReplyPhoto(null);
      setShowPhotoUpload(false);

      // Operator messages trigger AI assistant: it reads the latest history
      // and posts a reply. Fire-and-forget so the operator isn't blocked by
      // Claude latency. AI itself bails out if the last message isn't from
      // the operator (e.g. an engineer cut in).
      if (senderTypeForMe === 'operator' && ticket?.machine) {
        setAiPending(true);
        void fetch('/api/tickets/ai-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_id: ticketId }),
        }).catch(() => {
          // intentional — see comment above
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('send_error'));
    } finally {
      setSending(false);
    }
  };

  const handleNeedPart = async () => {
    if (!ticket || !user) return;
    if (partDesc.trim().length < 2) return;
    setPartSubmitting(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const qty = parseFloat(partQty.replace(',', '.'));
      // status 'forwarded' → lands directly in the NPGM admin queue (the admin
      // issues the quote). Linked to the ticket via notes for traceability.
      const { error: insErr } = await supabase.from('parts_requests').insert({
        company_id: ticket.company_id,
        machine_id: ticket.machine?.id ?? null,
        status: 'forwarded',
        urgency: 'urgent',
        parts_freeform: [
          {
            description: partDesc.trim(),
            quantity_estimate: Number.isFinite(qty) && qty > 0 ? qty : 1,
          },
        ],
        notes: t('by_ticket_note', { title: ticket.title ?? ticket.id }),
        requested_by: user.id,
      });
      if (insErr) throw insErr;
      setPartDone(true);
      setPartDesc('');
      setPartQty('1');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('part_request_error'));
    } finally {
      setPartSubmitting(false);
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
      setError(err instanceof Error ? err.message : t('status_change_error'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  // SOS escalation: confirm dialog → POST /api/tickets/sos → toast.
  // Server-side flips status to 'tier2_responding' + priority 1, and inserts
  // notifications for every tier2_engineer + platform_admin.
  const handleSos = async () => {
    if (!ticket) return;
    setSosSubmitting(true);
    setError(null);
    try {
      const resp = await fetch('/api/tickets/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? t('sos_error'));
      setTicket({ ...ticket, status: 'tier2_responding' as TicketStatus, priority: 1 });
      setSosBanner(t('sos_sent'));
      setTimeout(() => setSosBanner(null), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sos_error'));
    } finally {
      setSosSubmitting(false);
      setSosConfirmOpen(false);
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
        {t('loading')}
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
          <ArrowLeft className="w-4 h-4" /> {t('back_to_list')}
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
        <ArrowLeft className="w-4 h-4" />{t('back_to_list')}
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
              {ticket.title ?? <span className="text-secondary-400 italic">{t('no_subject')}</span>}
            </h1>
            <p className="text-sm text-secondary-600 mt-1">
              {t('created_by')} <span className="font-medium text-secondary-800">{ticket.operator?.full_name ?? '—'}</span>
              {ticket.machine && (
                <>
                  {' · '}{t('machine_label')}{' '}
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
                aria-label={t('change_status_aria')}
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tStatus(s)}
                  </option>
                ))}
              </Select>
              {['service_engineer', 'tier2_engineer', 'platform_admin'].includes(myProfile?.role ?? '') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPartDone(false);
                    setNeedPartOpen(true);
                  }}
                >
                  <Package className="w-4 h-4" />
                  {t('need_part')}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setSosConfirmOpen(true)}
                disabled={sosSubmitting}
                className="bg-accent-600 hover:bg-accent-700 text-white border-0 focus-visible:ring-accent-400"
              >
                {sosSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Siren className="w-4 h-4" />}
                {t('sos_button')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange('resolved')}
                disabled={updatingStatus}
              >
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t('close_resolved')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Messages */}
      <Card className="p-4 md:p-6 min-h-[400px] flex flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh]">
          {messages.length === 0 ? (
            <p className="text-center text-secondary-400 italic py-8">{t('no_messages')}</p>
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
          {aiPending && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 border border-primary-100 max-w-[60%] text-xs text-primary-700">
              <span className="inline-flex gap-0.5" aria-hidden="true">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-bounce" />
              </span>
              <span>{t('ai_typing')}</span>
            </div>
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
              placeholder={t('reply_placeholder')}
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
                    {t('attach_photo')}
                  </Button>
                )}
              </div>
              <Button type="submit" disabled={sending || (!reply.trim() && !replyPhoto)}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? t('sending') : t('send')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isResolved && ticket.resolution_summary && (
        <Card className="p-4 bg-emerald-50/50 border-emerald-200">
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700 mb-1">
            {t('resolution_title')}
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

      {/* "Need a part" modal — routes a parts request to the NPGM admin */}
      {needPartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4"
          onClick={() => setNeedPartOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-200">
              <h2 className="font-heading text-lg font-semibold text-secondary-900">
                {t('need_part')}
              </h2>
              <button onClick={() => setNeedPartOpen(false)} className="text-secondary-500 hover:text-secondary-900">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {partDone ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                <p className="text-sm text-secondary-700 mb-5">{t('need_part_sent_title')}</p>
                <Button onClick={() => setNeedPartOpen(false)}>{t('need_part_sent_done')}</Button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-xs text-secondary-500">{t('need_part_desc')}</p>
                <div>
                  <Label htmlFor="partDesc">{t('part_label')}</Label>
                  <Textarea
                    id="partDesc"
                    value={partDesc}
                    onChange={(e) => setPartDesc(e.target.value)}
                    placeholder={t('part_placeholder')}
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="partQty">{t('qty_label')}</Label>
                  <Input
                    id="partQty"
                    type="number"
                    step="1"
                    min="1"
                    inputMode="decimal"
                    value={partQty}
                    onChange={(e) => setPartQty(e.target.value)}
                    className="mt-1 max-w-[120px]"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-secondary-100">
                  <Button variant="outline" onClick={() => setNeedPartOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button onClick={handleNeedPart} disabled={partSubmitting || partDesc.trim().length < 2}>
                    {partSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                    {t('submit_part_request')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOS confirm dialog */}
      {sosConfirmOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !sosSubmitting && setSosConfirmOpen(false)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-secondary-100 flex items-center gap-3">
              <Siren className="w-6 h-6 text-accent-600 flex-shrink-0" />
              <h3 className="font-semibold text-secondary-900">{t('sos_button')}</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-secondary-700">{t('sos_confirm')}</p>
            </div>
            <div className="p-4 border-t border-secondary-100 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setSosConfirmOpen(false)} disabled={sosSubmitting}>
                {t('sos_cancel')}
              </Button>
              <Button
                onClick={handleSos}
                disabled={sosSubmitting}
                className="bg-accent-600 hover:bg-accent-700 text-white border-0"
              >
                {sosSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Siren className="w-4 h-4" />}
                {t('sos_confirm_button')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SOS success banner (auto-clears after 6s) */}
      {sosBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-accent-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium">
          <Siren className="w-4 h-4" />
          {sosBanner}
        </div>
      )}
    </div>
  );
}
