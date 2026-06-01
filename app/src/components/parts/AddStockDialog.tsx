'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, X, Save, BookOpen, Plus } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PART_CATEGORIES } from '@/components/parts/PartCategoryBadge';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import type { PartCategory, PartUnit } from '@/lib/types';

interface CatalogPart {
  id: string;
  display_name_ru: string;
  display_name_en?: string | null;
  application_ru: string | null;
  application_en?: string | null;
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

const UNIT_KEYS: PartUnit[] = ['pcs', 'm', 'kg', 'l', 'set'];

type Mode = 'catalog' | 'custom';

export function AddStockDialog({
  companyId,
  catalog,
  existingInventoryPartIds,
  onClose,
  onSaved,
}: AddStockDialogProps) {
  const t = useTranslations('parts_add_stock');
  const tCategory = useTranslations('parts_category');
  const tUnits = useTranslations('units');
  const locale = useLocale();
  const partName = (p: CatalogPart) =>
    locale === 'en' && p.display_name_en ? p.display_name_en : p.display_name_ru;
  const partApplication = (p: CatalogPart) =>
    locale === 'en' && p.application_en ? p.application_en : p.application_ru;

  const [mode, setMode] = useState<Mode>('catalog');
  const [machines, setMachines] = useState<MachineOption[]>([]);

  const [machineId, setMachineId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [threshold, setThreshold] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptPhotoPath, setReceiptPhotoPath] = useState<string | null>(null);

  const [partId, setPartId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | 'all'>('all');

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
      setError(t('err_qty_invalid'));
      return;
    }
    const thr = threshold ? parseFloat(threshold) : null;
    if (threshold && (!Number.isFinite(thr!) || thr! < 0)) {
      setError(t('err_threshold_invalid'));
      return;
    }

    setSubmitting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      let resolvedPartId: string;

      if (mode === 'catalog') {
        if (!partId) {
          throw new Error(t('err_no_catalog_part'));
        }
        resolvedPartId = partId;
      } else {
        if (customName.trim().length < 2) {
          throw new Error(t('err_custom_name_too_short'));
        }
        if (customMachineTypes.length === 0) {
          throw new Error(t('err_no_machine_types'));
        }
        const partNumber =
          customPartNumber.trim() ||
          `CUSTOM-${customCategory.toUpperCase()}-${Date.now().toString().slice(-6)}`;
        const manufacturer = customManufacturer.trim() || t('default_manufacturer');

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
        if (createErr || !created) throw createErr ?? new Error(t('err_create_failed'));
        resolvedPartId = (created as { id: string }).id;
      }

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
      setError(t('err_save_failed', { msg }));
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
            {t('title')}
          </h2>
          <button onClick={onClose} className="text-secondary-500 hover:text-secondary-900" aria-label={t('close_aria')}>
            <X className="w-5 h-5" />
          </button>
        </div>

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
            {t('tab_catalog')}
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
            {t('tab_custom')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
              {error}
            </div>
          )}

          {mode === 'catalog' && (
            <>
              <div>
                <Label>{t('category_label')}</Label>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                  className="mt-1"
                >
                  <option value="all">{t('all_categories')}</option>
                  {PART_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {tCategory(c)}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="partId">{t('part_label')}</Label>
                <Select
                  id="partId"
                  value={partId}
                  onChange={(e) => setPartId(e.target.value)}
                  required={mode === 'catalog'}
                  className="mt-1"
                >
                  <option value="">{t('choose_part')}</option>
                  {visibleCatalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {existingInventoryPartIds.has(p.id) ? '✓ ' : ''}
                      {partName(p)} {t('for_machines', { types: p.compatible_machine_types.join(', ') })}
                    </option>
                  ))}
                </Select>
                {partId && partApplication(catalog.find((c) => c.id === partId)!) && (
                  <p className="mt-1 text-xs text-secondary-500">
                    {partApplication(catalog.find((c) => c.id === partId)!)}
                  </p>
                )}
              </div>
            </>
          )}

          {mode === 'custom' && (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                {t('custom_hint')}
              </div>

              <div>
                <Label htmlFor="customName">{t('custom_name_label')}</Label>
                <Input
                  id="customName"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={t('custom_name_placeholder')}
                  required={mode === 'custom'}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="customCategory">{t('category_label')}</Label>
                  <Select
                    id="customCategory"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as PartCategory)}
                    className="mt-1"
                  >
                    {PART_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {tCategory(c)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="customUnit">{t('custom_unit_label')}</Label>
                  <Select
                    id="customUnit"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as PartUnit)}
                    className="mt-1"
                  >
                    {UNIT_KEYS.map((u) => (
                      <option key={u} value={u}>
                        {tUnits(u)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="customApplication">{t('custom_application_label')}</Label>
                <Input
                  id="customApplication"
                  value={customApplication}
                  onChange={(e) => setCustomApplication(e.target.value)}
                  placeholder={t('custom_application_placeholder')}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="customManufacturer">{t('custom_manufacturer_label')}</Label>
                  <Input
                    id="customManufacturer"
                    value={customManufacturer}
                    onChange={(e) => setCustomManufacturer(e.target.value)}
                    placeholder={t('custom_manufacturer_placeholder')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="customPartNumber">{t('custom_part_number_label')}</Label>
                  <Input
                    id="customPartNumber"
                    value={customPartNumber}
                    onChange={(e) => setCustomPartNumber(e.target.value)}
                    placeholder={t('custom_part_number_placeholder')}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <Label>{t('custom_machine_types_label')}</Label>
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
                <Label>{t('custom_photo_label')}</Label>
                <p className="text-xs text-secondary-500 mb-2">{t('custom_photo_hint')}</p>
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

          <div className="border-t border-secondary-200 pt-5">
            <div>
              <Label htmlFor="machineId">{t('machine_id_label')}</Label>
              <Select
                id="machineId"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="mt-1"
              >
                <option value="">{t('machine_id_default')}</option>
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
              <Label htmlFor="quantity">{t('qty_label')}</Label>
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
              <p className="mt-1 text-xs text-secondary-500">{t('qty_hint')}</p>
            </div>
            <div>
              <Label htmlFor="threshold">{t('threshold_label')}</Label>
              <Input
                id="threshold"
                type="number"
                step="0.001"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder={t('threshold_placeholder')}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">{t('notes_label')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notes_placeholder')}
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label>{t('receipt_photo_label')}</Label>
            <p className="text-xs text-secondary-500 mb-2">{t('receipt_photo_hint')}</p>
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
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {submitting ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
