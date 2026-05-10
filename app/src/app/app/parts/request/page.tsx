'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Send,
  Plus,
  X,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import type {
  MaintenanceBomItem,
  MaintenanceFreeformItem,
  PartCategory,
  PartsRequestUrgency,
} from '@/lib/types';

interface CatalogPart {
  id: string;
  display_name_ru: string;
  application_ru: string | null;
  category: PartCategory;
  compatible_machine_types: string[];
}

interface MachineOption {
  id: string;
  model_code: string;
  machine_type: string;
}

const URGENCY_LABELS: Record<PartsRequestUrgency, { ru: string; description: string; color: string }> = {
  normal: {
    ru: 'Обычная',
    description: 'Можно подождать несколько недель',
    color: 'border-secondary-200',
  },
  urgent: {
    ru: 'Срочная',
    description: 'Нужно в течение недели',
    color: 'border-amber-300 bg-amber-50/30',
  },
  critical: {
    ru: 'Критическая',
    description: 'Машина стоит — нужно как можно скорее',
    color: 'border-accent-300 bg-accent-50/30',
  },
};

export default function PartsRequestPage() {
  const router = useRouter();
  const { user } = useGlobal();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogPart[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [urgency, setUrgency] = useState<PartsRequestUrgency>('normal');
  const [machineId, setMachineId] = useState<string>('');
  const [parts, setParts] = useState<MaintenanceBomItem[]>([]);
  const [freeform, setFreeform] = useState<MaintenanceFreeformItem[]>([]);
  const [notes, setNotes] = useState('');

  // Catalog picker state
  const [pickerPartId, setPickerPartId] = useState('');
  const [pickerQty, setPickerQty] = useState('1');

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();

        const [profileResp, catalogResp, machinesResp] = await Promise.all([
          supabase.from('profiles').select('company_id').eq('id', user.id).single(),
          supabase
            .from('parts_catalog')
            .select('id, display_name_ru, application_ru, category, compatible_machine_types')
            .order('display_name_ru'),
          supabase
            .from('machines')
            .select('id, model_code, machine_type')
            .eq('status', 'active')
            .order('model_code'),
        ]);

        const cid = (profileResp.data as { company_id: string } | null)?.company_id;
        if (!cid) throw new Error('Профиль не привязан к компании');
        setCompanyId(cid);

        if (catalogResp.error) throw catalogResp.error;
        setCatalog((catalogResp.data ?? []) as CatalogPart[]);

        if (machinesResp.error) throw machinesResp.error;
        setMachines((machinesResp.data ?? []) as MachineOption[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const addCatalogPart = () => {
    if (!pickerPartId) return;
    const part = catalog.find((p) => p.id === pickerPartId);
    if (!part) return;
    const qty = parseFloat(pickerQty);
    if (!Number.isFinite(qty) || qty <= 0) return;

    setParts((prev) => {
      // If same part already in list, accumulate
      const idx = prev.findIndex((p) => p.part_id === part.id);
      if (idx >= 0) {
        return prev.map((p, i) => (i === idx ? { ...p, quantity: p.quantity + qty } : p));
      }
      return [
        ...prev,
        {
          part_id: part.id,
          display_name_ru: part.display_name_ru,
          quantity: qty,
          source: 'schedule_default',
        },
      ];
    });
    setPickerPartId('');
    setPickerQty('1');
  };

  const updatePartQty = (idx: number, qty: number) => {
    setParts((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: qty } : p)));
  };

  const removePart = (idx: number) => {
    setParts((prev) => prev.filter((_, i) => i !== idx));
  };

  const addFreeformItem = () => {
    setFreeform((prev) => [...prev, { description: '', quantity_estimate: 1, photo_url: null }]);
  };

  const updateFreeform = (idx: number, patch: Partial<MaintenanceFreeformItem>) => {
    setFreeform((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeFreeform = (idx: number) => {
    setFreeform((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setError(null);

    if (parts.length === 0 && freeform.length === 0) {
      setError('Добавьте хотя бы одну запчасть в заявку');
      return;
    }
    if (parts.some((p) => !Number.isFinite(p.quantity) || p.quantity <= 0)) {
      setError('Количество каждой позиции должно быть положительным');
      return;
    }
    if (freeform.some((f) => f.description.trim().length < 3)) {
      setError('Опишите дополнительные запчасти (минимум 3 символа)');
      return;
    }

    setSubmitting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      const { data: req, error: insertErr } = await supabase
        .from('parts_requests')
        .insert({
          company_id: companyId,
          machine_id: machineId || null,
          urgency,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          parts_requested: parts,
          parts_freeform: freeform,
          notes: notes.trim() || null,
          requested_by: user!.id,
        })
        .select('id')
        .single();
      if (insertErr || !req) throw insertErr ?? new Error('Не удалось создать заявку');

      router.push(`/app/parts/request/${(req as { id: string }).id}`);
    } catch (err) {
      let msg: string;
      if (err instanceof Error) msg = err.message;
      else if (err && typeof err === 'object' && 'message' in err) msg = String((err as { message: unknown }).message);
      else msg = JSON.stringify(err);
      setError(`Не удалось отправить заявку: ${msg}`);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Загрузка…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/app/parts"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />К гаражу
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          Заказ запчастей
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          Заявка не привязана к ТО — просто нужны запчасти. Можно срочно (машина стоит) или
          в обычном порядке.
        </p>
        <p className="text-xs text-secondary-500 mt-2">
          После отправки заявка попадёт сервисному инженеру. Он объединит её с заявками
          по другим машинам в сводную, согласует с проектным менеджером, и сводная уйдёт
          в НПГМ.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Urgency */}
        <Card className="p-5">
          <Label className="mb-3 block">Срочность *</Label>
          <div className="grid gap-2">
            {(Object.keys(URGENCY_LABELS) as PartsRequestUrgency[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                  urgency === u
                    ? `${URGENCY_LABELS[u].color} ring-2 ring-primary-500`
                    : `${URGENCY_LABELS[u].color} hover:border-primary-300`
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-secondary-900">
                  {u === 'critical' && <AlertTriangle className="w-4 h-4 text-accent-600" />}
                  {u === 'urgent' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                  {URGENCY_LABELS[u].ru}
                </div>
                <p className="text-xs text-secondary-600 mt-0.5">{URGENCY_LABELS[u].description}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Optional machine binding */}
        <Card className="p-5">
          <Label htmlFor="machineId">Привязка к машине (опционально)</Label>
          <Select
            id="machineId"
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="mt-1"
          >
            <option value="">Не привязано</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_code} ({m.machine_type})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-secondary-500">
            Указание конкретной машины помогает выбрать совместимые позиции и быстрее найти артикул.
          </p>
        </Card>

        {/* Catalog parts */}
        <Card className="p-5">
          <h2 className="font-heading font-semibold text-secondary-900 mb-3">
            Запчасти из каталога
          </h2>

          {parts.length > 0 && (
            <ul className="divide-y divide-secondary-100 mb-4">
              {parts.map((p, idx) => (
                <li key={`${p.part_id}-${idx}`} className="py-3 flex items-center gap-3">
                  <span className="flex-1 min-w-0 text-sm text-secondary-900">
                    {p.display_name_ru}
                  </span>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={p.quantity}
                    onChange={(e) => updatePartQty(idx, parseFloat(e.target.value) || 0)}
                    className="w-20 text-right tabular-nums"
                  />
                  <span className="text-xs text-secondary-500 w-8">шт</span>
                  <button
                    type="button"
                    onClick={() => removePart(idx)}
                    className="text-secondary-400 hover:text-accent-600 p-1"
                    aria-label="Убрать"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Picker */}
          <div className="flex items-end gap-2 pt-3 border-t border-secondary-100">
            <div className="flex-1 min-w-0">
              <Label htmlFor="pickerPart" className="text-xs">
                Выбрать из каталога
              </Label>
              <Select
                id="pickerPart"
                value={pickerPartId}
                onChange={(e) => setPickerPartId(e.target.value)}
                className="mt-1"
              >
                <option value="">…</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name_ru} ({p.compatible_machine_types.join(', ') || '—'})
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-20">
              <Label htmlFor="pickerQty" className="text-xs">
                Кол-во
              </Label>
              <Input
                id="pickerQty"
                type="number"
                step="1"
                min="1"
                value={pickerQty}
                onChange={(e) => setPickerQty(e.target.value)}
                className="mt-1 text-right"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCatalogPart} disabled={!pickerPartId}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Freeform parts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-secondary-900">
              Дополнительные / неизвестные запчасти
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addFreeformItem}>
              <Plus className="w-4 h-4" />
              Добавить
            </Button>
          </div>
          {freeform.length === 0 ? (
            <p className="text-sm text-secondary-500">
              Если не знаете точное название запчасти — опишите своими словами и приложите фото.
              Мы определим артикул и подтвердим перед заказом.
            </p>
          ) : (
            <ul className="space-y-3">
              {freeform.map((item, idx) => (
                <li key={idx} className="border border-secondary-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Textarea
                      placeholder="Например: подшипник на втором валу, чёрный, диаметр ~50мм"
                      value={item.description}
                      onChange={(e) => updateFreeform(idx, { description: e.target.value })}
                      rows={2}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeFreeform(idx)}
                      className="text-secondary-400 hover:text-accent-600 p-1 mt-1"
                      aria-label="Убрать"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-secondary-500">Кол-во:</Label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={item.quantity_estimate ?? 1}
                        onChange={(e) =>
                          updateFreeform(idx, { quantity_estimate: parseFloat(e.target.value) || 1 })
                        }
                        className="w-16 text-right tabular-nums h-8"
                      />
                    </div>
                    {companyId && (
                      <PhotoUploader
                        bucket="parts-photos"
                        companyId={companyId}
                        context="request-freeform"
                        initialPath={item.photo_url}
                        onUploaded={(p) => updateFreeform(idx, { photo_url: p })}
                        onRemoved={() => updateFreeform(idx, { photo_url: null })}
                        onError={(e) => setError(e)}
                        compact
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Notes */}
        <Card className="p-5">
          <Label htmlFor="notes">Примечания</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Контекст, желаемая дата, контакты для уточнений…"
            rows={3}
            className="mt-1"
          />
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button asChild type="button" variant="outline">
            <Link href="/app/parts">Отмена</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Отправка…' : 'Подать заявку'}
          </Button>
        </div>
      </form>
    </div>
  );
}
