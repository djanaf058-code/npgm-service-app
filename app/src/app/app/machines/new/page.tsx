'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface MachineType {
  id: string;
  name_ru: string;
  recipe_modes: string[];
}

export default function NewMachinePage() {
  const router = useRouter();
  const { user } = useGlobal();

  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [machineType, setMachineType] = useState<string>('');
  const [modelCode, setModelCode] = useState('');
  const [tonnage, setTonnage] = useState('');
  const [augerPosition, setAugerPosition] = useState<'upper' | 'lower' | 'none'>('none');
  const [hasDrum, setHasDrum] = useState(false);
  const [componentCount, setComponentCount] = useState('2');
  const [ggdType, setGgdType] = useState<'' | 'SN' | 'acetic_acid'>('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!machineType) return setError('Выберите тип машины');
    if (!modelCode.trim()) return setError('Введите модель (например, МСЗУ-14-НПБ)');
    const tonnageNum = parseFloat(tonnage);
    if (!Number.isFinite(tonnageNum) || tonnageNum <= 0) {
      return setError('Введите корректный тоннаж');
    }
    const componentCountNum = parseInt(componentCount, 10);
    if (![2, 3, 4].includes(componentCountNum)) {
      return setError('Количество компонентов: 2, 3 или 4');
    }

    setLoading(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      // We need company_id; fetch it from the user's profile.
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single();
      if (profileErr || !profile) throw profileErr ?? new Error('Профиль не найден');
      const companyId = (profile as { company_id: string }).company_id;
      if (!companyId) throw new Error('Не удалось определить компанию');

      const insertPayload = {
        company_id: companyId,
        machine_type: machineType,
        model_code: modelCode.trim(),
        tonnage_t: tonnageNum,
        auger_position: augerPosition,
        has_drum: hasDrum,
        component_count: componentCountNum,
        ggd_type: ggdType || null,
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
      setError(err instanceof Error ? err.message : 'Не удалось создать машину');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/app/machines"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        К списку машин
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          Новая машина
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          Заполните паспорт машины. Дополнительные поля можно отредактировать позже.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md">
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type + model */}
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
                Полная маркировка: тип, тоннаж, исполнение (НПБ, ВП и т.д.)
              </p>
            </div>
          </div>

          {/* Tonnage + auger position + drum */}
          <div className="grid md:grid-cols-3 gap-5">
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
              <Label htmlFor="augerPosition">Положение шнека</Label>
              <Select
                id="augerPosition"
                value={augerPosition}
                onChange={(e) =>
                  setAugerPosition(e.target.value as 'upper' | 'lower' | 'none')
                }
                className="mt-1"
              >
                <option value="none">Нет шнека</option>
                <option value="upper">Верхний (ВП)</option>
                <option value="lower">Нижний (НП)</option>
              </Select>
            </div>

            <div className="flex flex-col">
              <Label>Барабан</Label>
              <label className="mt-3 inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDrum}
                  onChange={(e) => setHasDrum(e.target.checked)}
                  className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">Есть барабан (Б)</span>
              </label>
            </div>
          </div>

          {/* Component count + GGD type */}
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="componentCount">Кол-во компонентов</Label>
              <Select
                id="componentCount"
                value={componentCount}
                onChange={(e) => setComponentCount(e.target.value)}
                className="mt-1"
              >
                <option value="2">2 (стандарт)</option>
                <option value="3">3</option>
                <option value="4">4 (исполнение 4К)</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="ggdType">ГГД (газо-генерирующая добавка)</Label>
              <Select
                id="ggdType"
                value={ggdType}
                onChange={(e) => setGgdType(e.target.value as '' | 'SN' | 'acetic_acid')}
                className="mt-1"
              >
                <option value="">Не используется</option>
                <option value="SN">SN (нитрит натрия)</option>
                <option value="acetic_acid">Acetic Acid (уксусная кислота)</option>
              </Select>
            </div>
          </div>

          {/* Serial + service date + pit location */}
          <div className="grid md:grid-cols-3 gap-5">
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

            <div>
              <Label htmlFor="inServiceSince">В эксплуатации с</Label>
              <Input
                id="inServiceSince"
                type="date"
                value={inServiceSince}
                onChange={(e) => setInServiceSince(e.target.value)}
                className="mt-1"
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

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Заметки</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Особенности эксплуатации, известные дефекты, привязка к контракту…"
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Actions */}
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
    </div>
  );
}
