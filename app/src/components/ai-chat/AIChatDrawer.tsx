'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Send, Loader2, X, MessageSquare, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createSPASassClient } from '@/lib/supabase/client';
import { AIMessageBubble, type AIMessage } from './AIMessageBubble';
import { EscalationBanner } from './EscalationBanner';

export function AIChatDrawer({
  machineId,
  machineLabel,
}: {
  machineId: string;
  machineLabel: string;
}) {
  const t = useTranslations('ai');
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [escalatedTicketId, setEscalatedTicketId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open ↦ ensure conversation exists, load history
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch('/api/ai/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machine_id: machineId }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? t('init_failed'));
        setConversationId(j.conversation.id);

        const r2 = await fetch(`/api/ai/conversations/${j.conversation.id}`);
        const j2 = await r2.json();
        if (r2.ok) setMessages(j2.messages ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [open, machineId, t]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const onPickFile = async (file: File) => {
    if (!conversationId) return;
    setUploading(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const sb = client.getSupabaseClient();
      const path = `${conversationId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await sb.storage.from('ai-chat-photos').upload(path, file);
      if (upErr) throw upErr;
      const { data } = sb.storage.from('ai-chat-photos').getPublicUrl(path);
      setPendingImage(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const escalate = async (convId: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/ai/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('send_failed'));
      setEscalatedTicketId(j.ticket_id as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const askAI = async (convId: string) => {
    const resp = await fetch('/api/ai/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: convId }),
    });
    if (!resp.ok || !resp.body) {
      setError(t('send_failed'));
      return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let assistantContent = '';
    // Optimistically append placeholder
    const placeholderId = `tmp-${Date.now()}`;
    setMessages((m) => [
      ...m,
      {
        id: placeholderId,
        role: 'assistant',
        content: '',
        image_url: null,
        ai_confidence: null,
        created_at: new Date().toISOString(),
      },
    ]);
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by blank lines
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.delta) {
            assistantContent += evt.delta;
            setMessages((m) =>
              m.map((x) => (x.id === placeholderId ? { ...x, content: assistantContent } : x))
            );
          } else if (evt.done) {
            setMessages((m) =>
              m.map((x) =>
                x.id === placeholderId ? { ...x, ai_confidence: evt.confidence } : x
              )
            );
            // Auto-escalate on low confidence
            if (
              typeof evt.confidence === 'number' &&
              evt.confidence < 60 &&
              !escalatedTicketId &&
              conversationId
            ) {
              void escalate(conversationId);
            }
          } else if (evt.error) {
            setError(evt.error);
          }
        } catch {
          /* ignore parse errors on partial chunks */
        }
      }
    }
  };

  const send = async () => {
    if (!conversationId || (!input.trim() && !pendingImage)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/ai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: input || '(image)',
          image_url: pendingImage,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('send_failed'));
      setMessages((m) => [...m, j.message as AIMessage]);
      setInput('');
      setPendingImage(null);
      // Now ask AI to respond
      await askAI(conversationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const lastAI = [...messages].reverse().find((m) => m.role === 'assistant');
  const showEscalateButton =
    lastAI &&
    lastAI.ai_confidence !== null &&
    lastAI.ai_confidence >= 60 &&
    lastAI.ai_confidence < 80 &&
    !escalatedTicketId;

  return (
    <>
      {/* Floating Ask button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2"
      >
        <MessageSquare className="w-4 h-4" />
        {t('ask_button')}
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-end">
          <div
            className="absolute inset-0 bg-secondary-900/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-white w-full sm:w-[480px] h-[70vh] sm:rounded-l-xl flex flex-col shadow-2xl">
            <header className="flex items-center justify-between p-4 border-b border-secondary-200">
              <h3 className="font-semibold text-secondary-900">
                {t('drawer_title', { model: machineLabel })}
              </h3>
              <button onClick={() => setOpen(false)} aria-label={t('close')}>
                <X className="w-5 h-5 text-secondary-500" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-secondary-500 text-center py-8">
                  {t('no_messages')}
                </p>
              )}
              {messages.map((m) => (
                <AIMessageBubble key={m.id} message={m} />
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-secondary-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('thinking')}
                </div>
              )}
              {error && (
                <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded p-2">
                  {error}
                </p>
              )}
            </div>

            {escalatedTicketId && (
              <div className="px-4 pb-2">
                <EscalationBanner ticketId={escalatedTicketId} />
              </div>
            )}
            {showEscalateButton && !escalatedTicketId && (
              <div className="px-4 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => conversationId && escalate(conversationId)}
                  disabled={busy}
                >
                  {t('escalate_button')}
                </Button>
              </div>
            )}

            <footer className="border-t border-secondary-200 p-3 space-y-2">
              {pendingImage && (
                <div className="relative inline-block">
                  <Image
                    src={pendingImage}
                    alt="attachment preview"
                    width={80}
                    height={80}
                    className="rounded object-cover"
                  />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-2 -right-2 bg-white rounded-full shadow p-0.5"
                    aria-label={t('close')}
                  >
                    <X className="w-3 h-3 text-secondary-600" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <label
                  className="cursor-pointer p-2 hover:bg-secondary-100 rounded-md"
                  title={t('attach_photo')}
                >
                  <Paperclip
                    className={`w-5 h-5 text-secondary-500 ${uploading ? 'animate-pulse' : ''}`}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onPickFile(f);
                      e.currentTarget.value = ''; // allow re-uploading same file
                    }}
                  />
                </label>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('placeholder')}
                  rows={2}
                  className="flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button onClick={send} disabled={busy || (!input.trim() && !pendingImage)}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
