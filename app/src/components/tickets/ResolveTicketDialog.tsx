'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ResolveTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when ticket was created via AI-escalation — surfaces a richer hint
   *  that feeds the learning loop. */
  isAIEscalation: boolean;
  onSubmit: (resolutionSummary: string) => Promise<void>;
}

const MIN_LENGTH = 10;

export function ResolveTicketDialog({
  open,
  onOpenChange,
  isAIEscalation,
  onSubmit,
}: ResolveTicketDialogProps) {
  const t = useTranslations('tickets.resolve_dialog');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLen = summary.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < MIN_LENGTH;
  const canSubmit = trimmedLen >= MIN_LENGTH && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(summary.trim());
      setSummary('');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) {
          setSummary('');
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {isAIEscalation ? t('description_ai') : t('description_default')}
          </DialogDescription>
        </DialogHeader>

        {isAIEscalation && (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900 flex gap-2">
            <Sparkles className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />
            <span>{t('ai_hint')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t('placeholder')}
              rows={5}
              autoFocus
              disabled={submitting}
              className="resize-none"
            />
            <div className="flex items-center justify-between mt-1 text-xs">
              <span
                className={
                  tooShort ? 'text-amber-600' : 'text-secondary-500'
                }
              >
                {tooShort
                  ? t('too_short', { min: MIN_LENGTH })
                  : t('helper')}
              </span>
              <span className="text-secondary-400">{trimmedLen}</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {t('submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
