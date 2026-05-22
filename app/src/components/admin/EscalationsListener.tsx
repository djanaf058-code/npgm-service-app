'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';

// Subscribes to ticket INSERTs flagged as AI escalations. Surfaces a
// non-blocking toast with a "view ticket" action — replaces the earlier
// window.confirm() prompt which blocked the UI thread and looked dated.
// Lives at the layout level so it's active across all /admin pages.
export function EscalationsListener() {
  const router = useRouter();
  const t = useTranslations('ai');

  useEffect(() => {
    let mounted = true;
    const cleanupRef: { current: (() => void) | null } = { current: null };
    // Unique per mount avoids "add callbacks after subscribe()" when React
    // Strict Mode double-mounts and the prior async cleanup hasn't finished.
    const channelName = `escalations-${Math.random().toString(36).slice(2, 10)}`;
    (async () => {
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();
      const channel = sb
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tickets',
            filter: 'originated_from=eq.ai_escalation',
          },
          (payload) => {
            if (!mounted) return;
            const ticket = payload.new as { id: string; title: string };
            toast(t('escalated_message'), {
              description: ticket.title,
              icon: <Sparkles className="w-4 h-4 text-indigo-500" />,
              duration: 15000,
              action: {
                label: t('view_ticket'),
                onClick: () => router.push(`/app/tickets/${ticket.id}`),
              },
            });
          }
        )
        .subscribe();
      cleanupRef.current = () => {
        sb.removeChannel(channel);
      };
    })();
    return () => {
      mounted = false;
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [router, t]);

  return null;
}
