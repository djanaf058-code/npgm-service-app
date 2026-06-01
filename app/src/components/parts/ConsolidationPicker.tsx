'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { createSPASassClient } from '@/lib/supabase/client';
import type { PartsRequestUrgency } from '@/lib/types';

export interface OperatorRow {
  id: string;
  urgency: PartsRequestUrgency;
  machine: { model_code: string } | null;
  parts_requested: { display_name_ru: string; quantity: number }[];
  parts_freeform: { description: string }[];
  created_at: string;
  requester: { full_name: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  operatorRows: OperatorRow[];
  onConsolidated: (consolidatedId: string) => void;
  onError: (msg: string) => void;
}

// Variant per urgency level — labels come from i18n (parts_urgency.*).
const URGENCY_VARIANT: Record<PartsRequestUrgency, 'outline' | 'warning' | 'destructive'> = {
  normal: 'outline',
  urgent: 'warning',
  critical: 'destructive',
};

// Wraps two RPCs into one user action: create the consolidated, then link
// the selected operator rows. If the second call fails, the empty
// consolidated stays in 'drafting' status — service can retry from the list.
async function createAndLink(
  notes: string,
  operatorIds: string[]
): Promise<string> {
  const client = await createSPASassClient();
  const supabase = client.getSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: e1 } = await (supabase as any).rpc(
    'create_consolidated_request',
    { p_notes: notes || null }
  );
  if (e1) throw new Error(e1.message);
  const consolidatedId = (created as { id: string }).id;

  if (operatorIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: e2 } = await (supabase as any).rpc('consolidate_operator_requests', {
      p_consolidated_id: consolidatedId,
      p_operator_ids: operatorIds,
    });
    if (e2) throw new Error(e2.message);
  }
  return consolidatedId;
}

export function ConsolidationPicker({
  open,
  onOpenChange,
  operatorRows,
  onConsolidated,
  onError,
}: Props) {
  const t = useTranslations('parts_consolidation');
  const tUrgency = useTranslations('parts_urgency');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const itemsLabel = (n: number) => {
    if (n === 1) return t('items_count_one', { n });
    if (n >= 2 && n <= 4) return t('items_count_few', { n });
    return t('items_count_many', { n });
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    try {
      const consolidatedId = await createAndLink(
        notes.trim(),
        Array.from(selected)
      );
      onConsolidated(consolidatedId);
      // Reset for next time.
      setSelected(new Set());
      setNotes('');
      onOpenChange(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        {operatorRows.length === 0 ? (
          <p className="text-sm text-secondary-500 text-center py-6">{t('empty')}</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1.5 -mx-6 px-6">
            {operatorRows.map((r) => {
              const isSelected = selected.has(r.id);
              const itemsCount = r.parts_requested.length + r.parts_freeform.length;
              const urgencyVariant = URGENCY_VARIANT[r.urgency];
              return (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary-300 bg-primary-50/40'
                      : 'border-secondary-200 hover:bg-secondary-50/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(r.id)}
                    className="w-4 h-4 rounded border-secondary-300 text-primary-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {r.urgency !== 'normal' && (
                        <Badge variant={urgencyVariant}>
                          {r.urgency === 'critical' && (
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                          )}
                          {r.urgency === 'urgent' && (
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                          )}
                          {tUrgency(r.urgency)}
                        </Badge>
                      )}
                      <span className="text-sm font-medium text-secondary-900">
                        {r.machine?.model_code ?? t('no_machine')}
                      </span>
                      <span className="text-xs text-secondary-500">
                        {itemsLabel(itemsCount)}
                      </span>
                    </div>
                    {r.requester?.full_name && (
                      <p className="text-xs text-secondary-500 truncate">
                        {r.requester.full_name} ·{' '}
                        {new Date(r.created_at).toLocaleDateString(dateLocale, {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div className="mt-3">
          <Label htmlFor="cons_notes">{t('notes_label')}</Label>
          <Textarea
            id="cons_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t('notes_placeholder')}
            className="mt-1"
          />
        </div>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('create')}{' '}
            {selected.size > 0 && (
              <span className="ml-1 text-xs opacity-80">({selected.size})</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
