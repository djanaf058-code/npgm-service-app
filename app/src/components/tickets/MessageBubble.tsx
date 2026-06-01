'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createSPASassClient } from '@/lib/supabase/client';
import { Loader2, Sparkles } from 'lucide-react';
import type { MessageSender } from '@/lib/types';

interface MessageBubbleProps {
  text: string | null;
  imagePath: string | null;
  senderType: MessageSender;
  senderName: string;
  createdAt: string;
  isOwn: boolean;
}

// Sender role labels come from i18n (namespace "sender"). AI-escalated
// tickets surface 'ai' and 'platform_admin' senders which were added in
// migration 0032a; both must have entries in the namespace.

// AI messages from escalations have sender_id = NULL → senderName comes in as '—'.
// Override so the column reads sensibly.
function displayName(senderType: MessageSender, raw: string): string {
  if (senderType === 'ai') return 'AI';
  return raw;
}

export function MessageBubble({
  text,
  imagePath,
  senderType,
  senderName,
  createdAt,
  isOwn,
}: MessageBubbleProps) {
  const tSender = useTranslations('sender');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (!imagePath) return;
    // AI-escalated tickets carry full Supabase Storage URLs from the
    // ai-chat-photos public bucket (image_url copied verbatim from
    // ai_messages). Detect and use directly — no need to sign.
    if (/^https?:\/\//.test(imagePath)) {
      setImageUrl(imagePath);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setImageLoading(true);
      try {
        const client = await createSPASassClient();
        const { data } = await client
          .getSupabaseClient()
          .storage.from('ticket-photos')
          .createSignedUrl(imagePath, 60 * 60); // 1 hour
        if (!cancelled && data) setImageUrl(data.signedUrl);
      } finally {
        if (!cancelled) setImageLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  const isAI = senderType === 'ai';
  const bubbleClass = isOwn
    ? 'bg-primary-600 text-white rounded-br-sm'
    : isAI
    ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-bl-sm'
    : 'bg-secondary-100 text-secondary-900 rounded-bl-sm';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`text-xs text-secondary-500 px-2 ${isOwn ? 'text-right' : 'text-left'}`}>
          {isAI && <Sparkles className="inline w-3 h-3 mr-1 text-indigo-500" />}
          <span className="font-medium text-secondary-700">{displayName(senderType, senderName)}</span>
          <span className="mx-1">·</span>
          <span>{tSender(senderType)}</span>
          <span className="mx-1">·</span>
          <span>
            {new Date(createdAt).toLocaleString(dateLocale, {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: 'short',
            })}
          </span>
        </div>
        <div className={`rounded-2xl px-4 py-2.5 ${bubbleClass}`}>
          {text && <p className="whitespace-pre-wrap break-words text-sm">{text}</p>}
          {imagePath && (
            <div className={`${text ? 'mt-2' : ''}`}>
              {imageLoading ? (
                <div className="w-48 h-48 flex items-center justify-center bg-secondary-200/40 rounded-md">
                  <Loader2 className="w-5 h-5 animate-spin opacity-70" />
                </div>
              ) : imageUrl ? (
                <a href={imageUrl} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Прикреплённое фото"
                    className="max-w-full max-h-80 rounded-md object-cover cursor-zoom-in"
                  />
                </a>
              ) : (
                <p className="text-xs opacity-70 italic">фото недоступно</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
