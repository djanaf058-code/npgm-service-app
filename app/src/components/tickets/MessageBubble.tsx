'use client';

import { useEffect, useState } from 'react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import type { MessageSender } from '@/lib/types';

interface MessageBubbleProps {
  text: string | null;
  imagePath: string | null;
  senderType: MessageSender;
  senderName: string;
  createdAt: string;
  isOwn: boolean;
}

const SENDER_LABEL: Record<MessageSender, string> = {
  operator: 'Оператор',
  service_engineer: 'Сервисный инженер',
  tier2: 'Поддержка NPGM',
};

export function MessageBubble({
  text,
  imagePath,
  senderType,
  senderName,
  createdAt,
  isOwn,
}: MessageBubbleProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (!imagePath) return;
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

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`text-xs text-secondary-500 px-2 ${isOwn ? 'text-right' : 'text-left'}`}>
          <span className="font-medium text-secondary-700">{senderName}</span>
          <span className="mx-1">·</span>
          <span>{SENDER_LABEL[senderType]}</span>
          <span className="mx-1">·</span>
          <span>
            {new Date(createdAt).toLocaleString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: 'short',
            })}
          </span>
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn
              ? 'bg-primary-600 text-white rounded-br-sm'
              : 'bg-secondary-100 text-secondary-900 rounded-bl-sm'
          }`}
        >
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
