'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, X, Loader2 } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';

interface PhotoUploadProps {
  companyId: string;
  ticketId?: string; // when uploading after ticket creation
  onUploaded: (storagePath: string) => void;
  onError: (error: string) => void;
}

/**
 * Compresses the image client-side to <= 1920px on the longest edge,
 * then uploads to the `ticket-photos` bucket under
 * <companyId>/<ticketId|draft>/<timestamp>-<filename>. Storage RLS
 * narrows visibility to members of the same company.
 */
export function PhotoUpload({ companyId, ticketId, onUploaded, onError }: PhotoUploadProps) {
  const t = useTranslations('photo_upload');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const compress = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 1920;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas 2D context unavailable'));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress image'))),
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => reject(new Error('Failed to read image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError(t('images_only'));
      return;
    }

    setUploading(true);
    try {
      const compressed = await compress(file);
      setPreview(URL.createObjectURL(compressed));

      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${companyId}/${ticketId ?? 'draft'}/${ts}-${safeName}`;
      const { error } = await supabase.storage
        .from('ticket-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;

      setStoragePath(path);
      onUploaded(path);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('upload_failed'));
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (storagePath) {
      try {
        const client = await createSPASassClient();
        await client.getSupabaseClient().storage.from('ticket-photos').remove([storagePath]);
      } catch {
        /* ignore — orphan files cleaned up by Supabase lifecycle if configured */
      }
    }
    setPreview(null);
    setStoragePath(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (preview) {
    return (
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt={t('alt_attached')}
          className="w-32 h-32 object-cover rounded-lg border border-secondary-200"
        />
        <button
          type="button"
          onClick={handleRemove}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent-600 text-white flex items-center justify-center shadow"
          aria-label={t('aria_remove')}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-secondary-300 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
      {uploading ? (
        <Loader2 className="w-4 h-4 animate-spin text-secondary-500" />
      ) : (
        <Camera className="w-4 h-4 text-secondary-500" />
      )}
      <span className="text-sm text-secondary-700">
        {uploading ? t('loading') : t('attach')}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        disabled={uploading}
        className="hidden"
      />
    </label>
  );
}
