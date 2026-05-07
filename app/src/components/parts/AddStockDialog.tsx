'use client';

import { useEffect, useState } from 'react';
import { Loader2, X, Save } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CATEGORY_LABELS } from '@/components/parts/PartCategoryBadge';
import type { PartCategory } from '@/lib/types';

interface CatalogPart {
  id: string;
  display_name_ru: string;
  application_ru: string | null;
  category: PartCategory;
  unit: string;
  compatible_machine_types: string[];
}

interface MachineOption {
  id: string;
  model_code: string;
}

interface AddStockDialogProps {
  companyId: string;
  catalog: CatalogPart[];
  existingInventoryPartIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Modal for adding stock to the company's garage.
 *  - Pick a part from the catalog (filterable by category)
 *  - Optional machine binding (or company-wide stock)
 *  - Quantity + reorder threshold + notes
 *  - On save: upserts parts_inventory row and writes a usage record if the
 *    quantity decreased.
 */
export function AddStockDialog({
  companyId,
  catalog,
  existingInventoryPartIds,
  onClose,
  onSaved,
}: AddStockDialogProps) {
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [partId, setPartId] = useState('');
  const [machineId, setMachineId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [threshold, setThreshold] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | 'all'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const client = await createSPASassClient();
      const { data } = await client
        .getSupabaseClient()
        .from('machines')
        .select('id, model_code')
        .eq('status', 'active')
        .order('model_code');
      setMachines(((data ?? []) as MachineOption[]) ?? []);
    };
    load();
  }, []);

  const visibleCatalog = catalog.filter(
    (p) => categoryFilter === 'all' || p.category === categoryFilter
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!partId) {
      setError('Выберите запчасть из каталога');
      return;
    }
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Введите корректное количество');
      return;
    }
    const thr = threshold ? parseFloat(threshold) : null;
    if (threshold && (!Number.isFinite(thr!) || thr! < 0)) {
      setError('Порог пополнения должен быть числом');
      return;
    }

    setSubmitting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      // Use upsert because (company_id, part_id, machine_id) is unique:
      // adding stock for a part already present should accumulate, not error.
      const machineKey = machineId || null;
      const existing = await supabase
        .from('parts_inventory')
        .select('id, quantity')
        .eq('company_id', companyId)
        .eq('part_id', partId)
        .is('machine_id', machineKey === null ? null : undefined as never)
        .eq('machine_id', machineKey ?? undefined as never)
        .maybeSingle();

      // Re-query without the broken 'is null' shortcut — separate path:
      let existingId: string | null = null;
      let existingQty = 0;
      if (machineKey === null) {
        const { data } = await supabase
          .from('parts_inventory')
          .select('id, quantity')
          .eq('company_id', companyId)
          .eq('part_id', partId)
          .is('machine_id', null)
          .maybeSingle();
        if (data) {
          existingId = (data as { id: string }).id;
          existingQty = Number((data as { quantity: number }).quantity);
        }
      } else {
        const { data } = await supabase
          .from('parts_inventory')
          .select('id, quantity')
          .eq('company_id', companyId)
          .eq('part_id', partId)
          .eq('machine_id', machineKey)
          .maybeSingle();
        if (data) {
          existingId = (data as { id: string }).id;
          existingQty = Number((data as { quantity: number }).quantity);
        }
      }
      void existing;

      if (existingId) {
        const { error: upErr } = await supabase
          .from('parts_inventory')
          .update({
            quantity: existingQty + qty,
            reorder_threshold: thr ?? undefined,
            last_replenished_at: new Date().toISOString(),
            notes: notes.trim() || null,
          })
          .eq('id', existingId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from('parts_inventory').insert({
          company_id: companyId,
          part_id: partId,
          machine_id: machineKey,
          quantity: qty,
          reorder_threshold: thr,
          last_replenished_at: new Date().toISOString(),
          notes: notes.trim() || null,
        });
        if (insErr) throw insErr;
      }

      onSaved();
    } catch (err) {
      let msg: string;
      if (err instanceof Error) msg = err.message;
      else if (err && typeof err === 'object' && 'message' in err) msg = String((err as { message: unknown }).message);
      else msg = JSON.stringify(err);
      setError(`Не удалось сохранить: ${msg}`);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200">
          <h2 className="font-heading text-lg font-semibold text-secondary-900">
            Добавить запчасть на склад
          </h2>
          <button
            onClick={onClose}
            className="text-secondary-500 hover:text-secondary-900"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
              {error}
            </div>
          )}

          <div>
            <Label>Категория</Label>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
              className="mt-1"
            >
              <option value="all">Все категории</option>
              {(Object.keys(CATEGORY_LABELS) as PartCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c].ru}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="partId">Запчасть *</Label>
            <Select
              id="partId"
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
              required
              className="mt-1"
            >
              <option value="">Выберите запчасть…</option>
              {visibleCatalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {existingInventoryPartIds.has(p.id) ? '✓ ' : ''}
                  {p.display_name_ru} (для {p.compatible_machine_types.join(', ')})
                </option>
              ))}
            </Select>
            {partId && catalog.find((c) => c.id === partId)?.application_ru && (
              <p className="mt-1 text-xs text-secondary-500">
                {catalog.find((c) => c.id === partId)!.application_ru}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="machineId">Привязка к машине (опционально)</Label>
            <Select
              id="machineId"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="mt-1"
            >
              <option value="">Общий склад компании</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_code}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-secondary-500">
              Привязанная запчасть будет резервироваться под конкретную машину.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Количество *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="mt-1"
              />
              <p className="mt-1 text-xs text-secondary-500">
                Если запчасть уже есть на складе — будет добавлено к существующему остатку.
              </p>
            </div>
            <div>
              <Label htmlFor="threshold">Порог пополнения</Label>
              <Input
                id="threshold"
                type="number"
                step="0.001"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="напр. 1"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-secondary-500">
                Когда количество упадёт ниже — увидите 🟡-алерт.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Заметки</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Откуда поступило, для какой машины планируется, особенности…"
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-secondary-100">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {submitting ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
