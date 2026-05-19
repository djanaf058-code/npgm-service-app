'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AIMessageBubble, type AIMessage } from './AIMessageBubble';

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

  const send = async () => {
    if (!conversationId || !input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/ai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, content: input }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t('send_failed'));
      setMessages((m) => [...m, j.message as AIMessage]);
      setInput('');
      // AI response will be wired in Phase C
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

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

            <footer className="border-t border-secondary-200 p-3 flex items-end gap-2">
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
              <Button onClick={send} disabled={busy || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
