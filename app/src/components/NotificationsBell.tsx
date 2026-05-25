'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Bell, Check } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';

interface NotificationRow {
  id: string;
  type: string;
  title: string | null;
  link: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationsBell() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const router = useRouter();
  const { user } = useGlobal();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  const load = useCallback(async () => {
    if (!user) return;
    const client = await createSPASassClient();
    // notifications isn't in the generated Database types yet — cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client.getSupabaseClient() as any;
    const { data } = await sb
      .from('notifications')
      .select('id, type, title, link, entity_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    setItems((data ?? []) as NotificationRow[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: a new notification row for me → prepend + bump the badge.
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sbRef: any = null;
    let cancelled = false;
    const channelName = `notifications-${Math.random().toString(36).slice(2, 10)}`;
    (async () => {
      const client = await createSPASassClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = client.getSupabaseClient() as any;
      sbRef = sb;
      if (cancelled) return;
      channel = sb
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
          (payload: { new: NotificationRow }) => {
            setItems((prev) => [payload.new, ...prev].slice(0, 20));
          }
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (sbRef && channel) sbRef.removeChannel(channel);
    };
  }, [user]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)));
    const client = await createSPASassClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client.getSupabaseClient() as any;
    await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  };

  const handleOpen = (n: NotificationRow) => {
    if (!n.read_at) markRead([n.id]);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const typeLabel = (type: string) => {
    const key = `type.${type}`;
    return t.has(key) ? t(key) : t('type.generic');
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-secondary-500 hover:text-secondary-800 rounded-md"
        aria-label={t('title')}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-secondary-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-secondary-100">
            <span className="text-sm font-semibold text-secondary-900">{t('title')}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead(items.filter((n) => !n.read_at).map((n) => n.id))}
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
              >
                <Check className="w-3.5 h-3.5" />
                {t('mark_all_read')}
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-secondary-500">{t('empty')}</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpen(n)}
                  className={`w-full text-left px-4 py-3 border-b border-secondary-50 hover:bg-secondary-50 transition-colors ${
                    n.read_at ? '' : 'bg-primary-50/40'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent-600 flex-shrink-0" />}
                    <div className={`min-w-0 ${n.read_at ? 'pl-4' : ''}`}>
                      <p className="text-sm font-medium text-secondary-900">{typeLabel(n.type)}</p>
                      {n.title && <p className="text-xs text-secondary-600 truncate">{n.title}</p>}
                      <p className="text-[11px] text-secondary-400 mt-0.5">
                        {new Date(n.created_at).toLocaleString(dateLocale, {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
