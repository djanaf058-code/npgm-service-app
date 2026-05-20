'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createSPASassClient } from '@/lib/supabase/client';

// Subscribes to ticket INSERTs flagged as AI escalations. Shows a browser
// confirm() asking whether to navigate to the ticket. Lives at the layout
// level so it's active across all /admin pages. v1 UX; later swap confirm
// for a proper toast.
export function EscalationsListener() {
  const router = useRouter();
  const t = useTranslations('ai');

  useEffect(() => {
    let mounted = true;
    const cleanupRef: { current: (() => void) | null } = { current: null };
    (async () => {
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();
      const channel = sb
        .channel('escalations')
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
            const ok = window.confirm(
              `${t('escalated_message')}\n\n${ticket.title}\n\n→ ${t('view_ticket')}?`
            );
            if (ok) router.push(`/app/tickets/${ticket.id}`);
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
