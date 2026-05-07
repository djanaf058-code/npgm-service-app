'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import type { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface MachineType {
  id: string;
  name_ru: string;
  recipe_modes: string[];
}

/**
 * The machine record on the wire still has all 11 fields (auger_position,
 * has_drum, component_count, ggd_type, ...) — they're just sensible defaults
 * derived per machine type, not asked from the user. Mapping below.
 *
 *   МЗВ  — 100% эмульсия. Барабан. Шнек не используется (none).
 *   МСЗ  — 100% ANFO (сухогруз). Барабана нет. Шнек в одном из двух
 *          положений (ВП/НП) — обязательный выбор.
 *   МСЗУ — Универсал. Барабан. Шнек не нужен (рецепты ANFO/смесь/эмульсия
 *          подаются через насосную группу).
 *   МЗУ  — Смесевой 70/30. Барабан. Шнек не используется (none).
 *
 * Components (component_count) and GGD type are not asked here — they're
 * inferred from the modification (4К etc.) which the user encodes into
 * model_code (e.g. "МЗУ-16-4К") and parses out later if/when needed.
 */
const TYPE_DEFAULTS: Record<
  string,
  {
    has_drum: boolean;
    needs_auger: boolean;
    component_count: number;
  }
> = {
  МЗВ: { has_drum: true, needs_auger: false, component_count: 2 },
  МСЗ: { has_drum: false, needs_auger: true, component_count: 2 },
  МСЗУ: { has_drum: true, needs_auger: false, component_count: 3 },
  МЗУ: { has_drum: true, needs_auger: false, component_count: 2 },
};

export default function NewMachinePage() {
  const router = useRouter();
  const { user } = useGlobal();

  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [machineType, setMachineType] = useState<string>('');
  const [modelCode, setModelCode] = useState('');
  const [tonnage, setTonnage] = useState('');
  const [augerPosition, setAugerPosition] = useState<'upper' | 'lower'>('lower');
  const [serialNumber, setSerialNumber] = useState('');
  const [inServiceSince, setInServiceSince] = useState('');
  const [pitLocation, setPitLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { data, error } = await supabase
          .from('machine_types')
          .select('id, name_ru, recipe_modes')
          .order('id');
        if (error) throw error;
        setMachineTypes((data ?? []) as MachineType[]);
        if (data && data.length > 0 && !machineType) {
          setMachineType((data[0] as MachineType).id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить справочник типов');
      }
    };
    fetchTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaults = machineType ? TYPE_DEFAULTS[machineType] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!machineType) return setError('Выберите тип машины');
    if (!modelCode.trim()) return setError('Введите модель (например, МСЗУ-14-НПБ)');
    const tonnageNum = parseFloat(tonnage);
    if (!Number.isFinite(tonnageNum) || tonnageNum <= 0) {
      return setError('Введите корректный тоннаж');
    }
    if (!defaults) return setError('Неизвестный тип машины');

    setLoading(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single();
      if (profileErr || !profile) throw profileErr ?? new Error('Профиль не найден');
      const companyId = (profile as { company_id: string }).company_id;
      if (!companyId) throw new Error('Не удалось определить компанию');

      const insertPayload: Database['public']['Tables']['machines']['Insert'] = {
        company_id: companyId,
        machine_type: machineType,
        model_code: modelCode.trim(),
        tonnage_t: tonnageNum,
        auger_position: defaults.needs_auger ? augerPosition : 'none',
        has_drum: defaults.has_drum,
        component_count: defaults.component_count,
        ggd_type: null,
        serial_number: serialNumber.trim() || null,
        in_service_since: inServiceSince || null,
        pit_location: pitLocation.trim() || null,
        notes: notes.trim() || null,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('machines')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      router.push(`/app/machines/${(inserted as { id: string }).id}`);
    } catch (err) {
      // Surface the actual Postgres / Supabase error so the user can tell us
      // what's broken instead of getting a generic "не удалось создать машину".
      let msg: string;
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        msg = String((err as { message: unknown }).message);
      } else {
        msg = JSON.stringify(err);
      }
      setError(`Не удалось создать машину: ${msg}`);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <Link
        href="/app/machines"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />К списку машин
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          Новая машина
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          Введите паспорт машины. Технические особенности (барабан, число компонентов, ГГД)
          выводятся автоматически из типа и модификации.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="machineType">Тип машины *</Label>
              <Select
                id="machineType"
                value={machineType}
                onChange={(e) => setMachineType(e.target.value)}
                required
                className="mt-1"
              >
                {machineTypes.length === 0 && <option value="">Загружаем…</option>}
                {machineTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.name_ru}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="modelCode">Модель *</Label>
              <Input
                id="modelCode"
                value={modelCode}
                onChange={(e) => setModelCode(e.target.value)}
                placeholder="МСЗУ-14-НПБ"
                required
                className="mt-1"
              />
              <p className="mt-1 text-xs text-secondary-500">
                Полная маркировка с тоннажем и исполнением
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="tonnage">Грузоподъёмность, т *</Label>
              <Input
                id="tonnage"
                type="number"
                step="0.1"
                min="1"
                max="50"
                value={tonnage}
                onChange={(e) => setTonnage(e.target.value)}
                placeholder="14"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="serialNumber">Серийный номер</Label>
              <Input
                id="serialNumber"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="MZB-2024-0142"
                className="mt-1 font-mono"
              />
            </div>
          </div>

          {/* МСЗ — единственный тип, где положение шнека реально различается */}
          {defaults?.needs_auger && (
            <div>
              <Label htmlFor="augerPosition">Положение шнека (для МСЗ)</Label>
              <Select
                id="augerPosition"
                value={augerPosition}
                onChange={(e) => setAugerPosition(e.target.value as 'upper' | 'lower')}
                className="mt-1"
              >
                <option value="upper">Верхний (ВП)</option>
                <option value="lower">Нижний (НП)</option>
              </Select>
              <p className="mt-1 text-xs text-secondary-500">
                ВП / НП в маркировке зависит от исполнения корпуса
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="inServiceSince">В эксплуатации с</Label>
              <DatePicker
                id="inServiceSince"
                value={inServiceSince}
                onChange={setInServiceSince}
                className="mt-1"
                fromYear={2000}
              />
            </div>

            <div>
              <Label htmlFor="pitLocation">Текущий карьер</Label>
              <Input
                id="pitLocation"
                value={pitLocation}
                onChange={(e) => setPitLocation(e.target.value)}
                placeholder="Block A, Pit 2"
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
              placeholder="Особенности эксплуатации, привязка к контракту, известные дефекты…"
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-secondary-100">
            <Button asChild variant="outline" type="button">
              <Link href="/app/machines">Отмена</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? 'Сохранение…' : 'Создать машину'}
            </Button>
          </div>
        </form>
      </Card>

      {defaults && (
        <Card className="p-4 bg-secondary-50/60 border-dashed">
          <p className="text-xs uppercase tracking-wider font-semibold text-secondary-500 mb-2">
            Поля, которые подставятся автоматически для типа {machineType}
          </p>
          <ul className="text-xs text-secondary-600 space-y-1">
            <li>· Барабан: <strong>{defaults.has_drum ? 'есть' : 'нет'}</strong></li>
            <li>· Положение шнека: <strong>{defaults.needs_auger ? `выбираете выше (${augerPosition === 'upper' ? 'ВП' : 'НП'})` : 'не используется'}</strong></li>
            <li>· Кол-во компонентов: <strong>{defaults.component_count}</strong></li>
            <li>· ГГД: <strong>не используется</strong> (будет добавлено позже, если потребуется)</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
