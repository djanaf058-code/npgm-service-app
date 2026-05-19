'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  ai_confidence: number | null;
  created_at: string;
}

export function AIMessageBubble({ message }: { message: AIMessage }) {
  const t = useTranslations('ai');
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-secondary-100 text-secondary-900'
        }`}
      >
        {message.image_url && (
          <div className="mb-2 rounded overflow-hidden">
            <Image
              src={message.image_url}
              alt="attachment"
              width={240}
              height={180}
              className="object-cover"
            />
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {message.ai_confidence !== null && (
          <p className="text-xs opacity-70 mt-1">
            {t('confidence', { value: message.ai_confidence })}
          </p>
        )}
      </div>
    </div>
  );
}
