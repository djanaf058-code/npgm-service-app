'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, X, Loader2 } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';

interface PhotoUploaderProps {
  /** Storage bucket id, e.g. 'parts-photos' or 'ticket-photos'. */
  bucket: string;
  /** Top-level folder = company_id (RLS uses path prefix). */
  companyId: string;
  /** Sub-folder name, e.g. 'inventory', 'request-draft', 'maintenance-freeform'. */
  context: string;
  /** Existing storage path (re-render after page reload). */
  initialPath?: string | null;
  /** Called with the new storage path after successful upload. */
  onUploaded: (storagePath: string) => void;
  /** Called when user removes the attached photo. */
  onRemoved?: () => void;
  /** Called on upload errors. */
  onError: (error: string) => void;
  /** Optional className for the trigger button. */
  className?: string;
  /** Compact rendering — for inline use in lists. */
  compact?: boolean;
}

/**
 * Reusable photo upload widget. Compresses to <=1920px JPEG client-side
 * and uploads to {bucket}/{companyId}/{context}/{ts}-{filename}.
 *
 * Storage RLS narrows visibility to the same company by path prefix.
 */
export function PhotoUploader({
  bucket,
  companyId,
  context,
  initialPath = null,
  onUploaded,
  onRemoved,
  onError,
  className,
  compact = false,
}: PhotoUploaderProps) {
  const t = useTranslations('photo_upload');
  const [uploading, setUploading] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(initialPath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // If we have an initial path but no preview yet, fetch a signed URL once
  if (storagePath && !previewUrl && !signedUrl) {
    (async () => {
      try {
        const client = await createSPASassClient();
        const { data } = await client
          .getSupabaseClient()
          .storage.from(bucket)
          .createSignedUrl(storagePath, 60 * 60);
        if (data) setSignedUrl(data.signedUrl);
      } catch {
        /* ignore */
      }
    })();
  }

  const compress = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 1920;
        let { width, height } = img;
        if (width > max || height > max) {
          if (width > height) {
            height = Math.round((height * max) / width);
            width = max;
          } else {
            width = Math.round((width * max) / height);
            height = max;
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
      const objectUrl = URL.createObjectURL(compressed);
      setPreviewUrl(objectUrl);

      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `${companyId}/${context}/${ts}-${safeName}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;

      setStoragePath(path);
      setSignedUrl(null); // force re-fetch on next render if needed
      onUploaded(path);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('upload_failed'));
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (storagePath) {
      try {
        const client = await createSPASassClient();
        await client.getSupabaseClient().storage.from(bucket).remove([storagePath]);
      } catch {
        /* ignore */
      }
    }
    setStoragePath(null);
    setPreviewUrl(null);
    setSignedUrl(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemoved?.();
  };

  const visibleUrl = previewUrl ?? signedUrl;

  if (visibleUrl) {
    return (
      <div className="relative inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visibleUrl}
          alt={t('alt_attached')}
          className={`${compact ? 'w-20 h-20' : 'w-32 h-32'} object-cover rounded-lg border border-secondary-200`}
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
    <label
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-secondary-300 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors ${className ?? ''}`}
    >
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
