'use client';

import { useEffect, useState } from 'react';
import { Loader2, X, Save, BookOpen, Plus } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CATEGORY_LABELS } from '@/components/parts/PartCategoryBadge';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import type { PartCategory, PartUnit } from '@/lib/types';

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
  machine_type: string;
}

interface AddStockDialogProps {
  companyId: string;
  catalog: CatalogPart[];
  existingInventoryPartIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}

const MACHINE_TYPES: string[] = ['МЗВ', 'МСЗ', 'МСЗУ', 'МЗУ'];

const UNIT_OPTIONS: { value: PartUnit; label: string }[] = [
  { value: 'pcs', label: 'шт' },
  { value: 'm', label: 'м' },
  { value: 'kg', label: 'кг' },
  { value: 'l', label: 'л' },
  { value: 'set', label: 'компл.' },
];

type Mode = 'catalog' | 'custom';

export function AddStockDialog({
  companyId,
  catalog,
  existingInventoryPartIds,
  onClose,
  onSaved,
}: AddStockDialogProps) {
  const [mode, setMode] = useState<Mode>('catalog');
  const [machines, setMachines] = useState<MachineOption[]>([]);

  // Common fields
  const [machineId, setMachineId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [threshold, setThreshold] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptPhotoPath, setReceiptPhotoPath] = useState<string | null>(null);

  // Catalog mode
  const [partId, setPartId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | 'all'>('all');

  // Custom mode
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<PartCategory>('consumable');
  const [customApplication, setCustomApplication] = useState('');
  const [customManufacturer, setCustomManufacturer] = useState('');
  const [customPartNumber, setCustomPartNumber] = useState('');
  const [customUnit, setCustomUnit] = useState<PartUnit>('pcs');
  const [customMachineTypes, setCustomMachineTypes] = useState<string[]>([]);
  const [customPhotoPath, setCustomPhotoPath] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const client = await createSPASassClient();
      const { data } = await client
        .getSupabaseClient()
        .from('machines')
        .select('id, model_code, machine_type')
        .eq('status', 'active')
        .order('model_code');
      setMachines(((data ?? []) as MachineOption[]) ?? []);
    };
    load();
  }, []);

  const visibleCatalog = catalog.filter(
    (p) => categoryFilter === 'all' || p.category === categoryFilter
  );

  const toggleMachineType = (mt: string) => {
    setCustomMachineTypes((prev) =>
      prev.includes(mt) ? prev.filter((x) => x !== mt) : [...prev, mt]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

      let resolvedPartId: string;

      if (mode === 'catalog') {
        if (!partId) {
          throw new Error('Выберите запчасть из каталога');
        }
        resolvedPartId = partId;
      } else {
        // Validate custom part input
        if (customName.trim().length < 2) {
          throw new Error('Введите название запчасти (минимум 2 символа)');
        }
        if (customMachineTypes.length === 0) {
          throw new Error('Выберите типы машин, к которым относится запчасть');
        }
        // Mint a part_number if user didn't provide one
        const partNumber =
          customPartNumber.trim() ||
          `CUSTOM-${customCategory.toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const manufacturer = customManufacturer.trim() || 'Прочее';

        const { data: created, error: createErr } = await supabase
          .from('parts_catalog')
          .insert({
            display_name_ru: customName.trim(),
            category: customCategory,
            application_ru: customApplication.trim() || null,
            manufacturer,
            part_number: partNumber,
            unit: customUnit,
            compatible_machine_types: customMachineTypes,
            is_custom: true,
            created_by_company_id: companyId,
            image_url: customPhotoPath,
          })
          .select('id')
          .single();
        if (createErr || !created) throw createErr ?? new Error('Не удалось создать запчасть');
        resolvedPartId = (created as { id: string }).id;
      }

      // Upsert inventory: accumulate if existing row, otherwise insert
      const machineKey = machineId || null;
      let existingId: string | null = null;
      let existingQty = 0;

      if (machineKey === null) {
        const { data } = await supabase
          .from('parts_inventory')
          .select('id, quantity')
          .eq('company_id', companyId)
          .eq('part_id', resolvedPartId)
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
          .eq('part_id', resolvedPartId)
          .eq('machine_id', machineKey)
          .maybeSingle();
        if (data) {
          existingId = (data as { id: string }).id;
          existingQty = Number((data as { quantity: number }).quantity);
        }
      }

      if (existingId) {
        const { error: upErr } = await supabase
          .from('parts_inventory')
          .update({
            quantity: existingQty + qty,
            reorder_threshold: thr ?? undefined,
            last_replenished_at: new Date().toISOString(),
            notes: notes.trim() || null,
            image_url: receiptPhotoPath ?? undefined,
          })
          .eq('id', existingId);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase.from('parts_inventory').insert({
          company_id: companyId,
          part_id: resolvedPartId,
          machine_id: machineKey,
          quantity: qty,
          reorder_threshold: thr,
          last_replenished_at: new Date().toISOString(),
          notes: notes.trim() || null,
          image_url: receiptPhotoPath,
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
          <button onClick={onClose} className="text-secondary-500 hover:text-secondary-900" aria-label="Закрыть">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-secondary-200">
          <button
            type="button"
            onClick={() => setMode('catalog')}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              mode === 'catalog'
                ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50/30'
                : 'text-secondary-600 hover:text-secondary-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Из каталога
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              mode === 'custom'
                ? 'text-primary-700 border-b-2 border-primary-600 bg-primary-50/30'
                : 'text-secondary-600 hover:text-secondary-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            Своя запчасть
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
              {error}
            </div>
          )}

          {/* === CATALOG MODE === */}
          {mode === 'catalog' && (
            <>
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
                  required={mode === 'catalog'}
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
            </>
          )}

          {/* === CUSTOM MODE === */}
          {mode === 'custom' && (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                Запчасть появится в каталоге только вашей компании. Tier 2 / администратор
                платформы тоже её увидит — по запросу мы поможем найти точный артикул и
                поставщика.
              </div>

              <div>
                <Label htmlFor="customName">Название запчасти *</Label>
                <Input
                  id="customName"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Например: Подшипник 6205-2RS"
                  required={mode === 'custom'}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="customCategory">Категория</Label>
                  <Select
                    id="customCategory"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as PartCategory)}
                    className="mt-1"
                  >
                    {(Object.keys(CATEGORY_LABELS) as PartCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c].ru}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="customUnit">Ед. измерения</Label>
                  <Select
                    id="customUnit"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as PartUnit)}
                    className="mt-1"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="customApplication">Применение / где используется</Label>
                <Input
                  id="customApplication"
                  value={customApplication}
                  onChange={(e) => setCustomApplication(e.target.value)}
                  placeholder="Например: вал гидронасоса"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="customManufacturer">Производитель</Label>
                  <Input
                    id="customManufacturer"
                    value={customManufacturer}
                    onChange={(e) => setCustomManufacturer(e.target.value)}
                    placeholder="SKF / необязательно"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="customPartNumber">Артикул</Label>
                  <Input
                    id="customPartNumber"
                    value={customPartNumber}
                    onChange={(e) => setCustomPartNumber(e.target.value)}
                    placeholder="6205-2RS / необязательно"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <Label>Совместимые типы машин *</Label>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {MACHINE_TYPES.map((mt) => (
                    <button
                      key={mt}
                      type="button"
                      onClick={() => toggleMachineType(mt)}
                      className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                        customMachineTypes.includes(mt)
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-secondary-700 border-secondary-300 hover:border-primary-300'
                      }`}
                    >
                      {mt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Фото запчасти</Label>
                <p className="text-xs text-secondary-500 mb-2">
                  Помогает уточнить какая именно деталь нужна. Можно с камеры мобильного.
                </p>
                <PhotoUploader
                  bucket="parts-photos"
                  companyId={companyId}
                  context="custom-part"
                  initialPath={customPhotoPath}
                  onUploaded={(p) => setCustomPhotoPath(p)}
                  onRemoved={() => setCustomPhotoPath(null)}
                  onError={(e) => setError(e)}
                />
              </div>
            </>
          )}

          {/* === COMMON: location, qty, threshold, notes, receipt photo === */}

          <div className="border-t border-secondary-200 pt-5">
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
            </div>
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
                Если запчасть уже на складе — добавится к остатку.
              </p>
            </div>
            <div>
              <Label htmlFor="threshold">Порог 🟡-алерта</Label>
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
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Заметки</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Откуда поступила, особенности…"
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Фото при получении</Label>
            <p className="text-xs text-secondary-500 mb-2">
              Сфотографируйте коробку / артикул-тег. Поможет если потом возникнет вопрос
              «то ли пришло».
            </p>
            <PhotoUploader
              bucket="parts-photos"
              companyId={companyId}
              context="inventory-receipt"
              initialPath={receiptPhotoPath}
              onUploaded={(p) => setReceiptPhotoPath(p)}
              onRemoved={() => setReceiptPhotoPath(null)}
              onError={(e) => setError(e)}
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
