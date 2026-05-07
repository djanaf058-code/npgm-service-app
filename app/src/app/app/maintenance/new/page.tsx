'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send, Plus, X } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import type {
  MaintenanceKind,
  MaintenanceBomItem,
  MaintenanceFreeformItem,
  MaintenanceWorkItem,
} from '@/lib/types';

interface MachineRow {
  id: string;
  machine_type: string;
  model_code: string;
  tons_pumped: number;
}

interface ScheduleRow {
  id: string;
  machine_type: string;
  kind: MaintenanceKind;
  interval_tons: number;
  work_items: MaintenanceWorkItem[];
  parts_required: MaintenanceBomItem[];
  total_hours_norm: number | null;
}

const KIND_LABELS: Record<MaintenanceKind, string> = {
  TO: 'ТО',
  'TO-1': 'ТО-1',
  'TO-2': 'ТО-2',
  annual: 'Годовое ТО',
  unscheduled: 'Внеплановое',
};

function NewMaintenanceRequestInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useGlobal();

  const machineIdParam = searchParams.get('machine');
  const scheduleIdParam = searchParams.get('schedule');
  // kind comes from the schedule we load — query param is informational only

  const [machine, setMachine] = useState<MachineRow | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  void companyId; // used by PhotoUploader below
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Editable copy of the schedule's BOM. Operator can change qty or remove. */
  const [parts, setParts] = useState<MaintenanceBomItem[]>([]);
  /** Free-form additions: parts the operator describes in their own words. */
  const [freeform, setFreeform] = useState<MaintenanceFreeformItem[]>([]);
  const [plannedDate, setPlannedDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        if (!machineIdParam || !scheduleIdParam) {
          throw new Error('В URL не указаны машина и/или регламент.');
        }
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();

        const [profileResp, machineResp, scheduleResp] = await Promise.all([
          supabase.from('profiles').select('company_id').eq('id', user!.id).single(),
          supabase
            .from('machines')
            .select('id, machine_type, model_code, tons_pumped')
            .eq('id', machineIdParam)
            .maybeSingle(),
          supabase
            .from('maintenance_schedules')
            .select('id, machine_type, kind, interval_tons, work_items, parts_required, total_hours_norm')
            .eq('id', scheduleIdParam)
            .maybeSingle(),
        ]);

        const cid = (profileResp.data as { company_id: string } | null)?.company_id;
        if (!cid) throw new Error('Профиль не привязан к компании');
        setCompanyId(cid);

        if (!machineResp.data) throw new Error('Машина не найдена');
        if (!scheduleResp.data) throw new Error('Регламент не найден');

        setMachine(machineResp.data as MachineRow);
        setSchedule(scheduleResp.data as ScheduleRow);
        setParts(((scheduleResp.data as ScheduleRow).parts_required ?? []).slice());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user, machineIdParam, scheduleIdParam]);

  const updatePartQty = (index: number, qty: number) => {
    setParts((prev) => prev.map((p, i) => (i === index ? { ...p, quantity: qty } : p)));
  };

  const removePart = (index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  const addFreeformItem = () => {
    setFreeform((prev) => [...prev, { description: '', quantity_estimate: 1, photo_url: null }]);
  };

  const updateFreeformItem = (index: number, patch: Partial<MaintenanceFreeformItem>) => {
    setFreeform((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeFreeformItem = (index: number) => {
    setFreeform((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine || !schedule || !companyId) return;
    setError(null);

    if (parts.some((p) => !Number.isFinite(p.quantity) || p.quantity <= 0)) {
      setError('Все количества должны быть положительными числами');
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

      const tonsAtCreation = Number(machine.tons_pumped);
      const cyclesCompleted = Math.floor(tonsAtCreation / schedule.interval_tons);
      const forecastTons = (cyclesCompleted + 1) * schedule.interval_tons;

      const { data: event, error: insertErr } = await supabase
        .from('maintenance_events')
        .insert({
          company_id: companyId,
          machine_id: machine.id,
          schedule_id: schedule.id,
          kind: schedule.kind,
          status: 'requested',
          tons_at_creation: tonsAtCreation,
          forecast_tons: forecastTons,
          planned_date: plannedDate || null,
          parts_requested: parts,
          parts_freeform: freeform,
          requested_by: user!.id,
          notes: notes.trim() || null,
        })
        .select('id')
        .single();
      if (insertErr || !event) throw insertErr ?? new Error('Не удалось создать заявку');

      router.push(`/app/maintenance/${(event as { id: string }).id}`);
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

  if (error || !machine || !schedule) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/app/maintenance"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> К списку ТО
        </Link>
        <Card className="p-6 text-center">
          <p className="text-accent-700 whitespace-pre-wrap">{error ?? 'Не удалось загрузить'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/app/maintenance"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />К списку ТО
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          Заявка на {KIND_LABELS[schedule.kind]} — {machine.model_code}
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          Запчасти ниже взяты из регламента ТО автоматически. Уберите, что не нужно,
          поправьте количество, или добавьте «дополнительную запчасть» если нужно
          ещё что-то.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Predefined parts */}
        <Card className="p-5">
          <h2 className="font-heading font-semibold text-secondary-900 mb-3">
            Запчасти к {KIND_LABELS[schedule.kind]}
          </h2>
          {parts.length === 0 ? (
            <p className="text-sm text-secondary-500 italic">
              Список запчастей пуст. Добавьте «дополнительную запчасть» ниже или
              обратитесь к сервисному инженеру.
            </p>
          ) : (
            <ul className="divide-y divide-secondary-100">
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
                    title="Убрать из заявки"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Freeform additions */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-secondary-900">
              Дополнительные запчасти
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addFreeformItem}>
              <Plus className="w-4 h-4" />
              Добавить
            </Button>
          </div>
          {freeform.length === 0 ? (
            <p className="text-sm text-secondary-500">
              Если нужна запчасть, которой нет в стандартном комплекте —
              опишите её своими словами и приложите фото.
            </p>
          ) : (
            <ul className="space-y-3">
              {freeform.map((item, idx) => (
                <li key={idx} className="border border-secondary-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Textarea
                      placeholder="Например: статор насоса NETZSCH, который чёрный, на 3-м насосе слева"
                      value={item.description}
                      onChange={(e) => updateFreeformItem(idx, { description: e.target.value })}
                      rows={2}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeFreeformItem(idx)}
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
                          updateFreeformItem(idx, { quantity_estimate: parseFloat(e.target.value) || 1 })
                        }
                        className="w-16 text-right tabular-nums h-8"
                      />
                    </div>
                    {companyId && (
                      <PhotoUploader
                        bucket="parts-photos"
                        companyId={companyId}
                        context="maintenance-freeform"
                        initialPath={item.photo_url}
                        onUploaded={(p) => updateFreeformItem(idx, { photo_url: p })}
                        onRemoved={() => updateFreeformItem(idx, { photo_url: null })}
                        onError={(e) => setError(e)}
                        compact
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-secondary-500">
            Артикул и точное название мы определим со своей стороны и подтвердим перед заказом.
          </p>
        </Card>

        {/* Meta */}
        <Card className="p-5 space-y-4">
          <div>
            <Label htmlFor="plannedDate">Желаемая дата проведения ТО</Label>
            <DatePicker
              id="plannedDate"
              value={plannedDate}
              onChange={setPlannedDate}
              className="mt-1 max-w-xs"
            />
          </div>
          <div>
            <Label htmlFor="notes">Примечания</Label>
            <Textarea
              id="notes"
              placeholder="Особенности, дополнительные пожелания…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-secondary-600">
            Регламент: <strong>{schedule.work_items.length} операций</strong>
            {schedule.total_hours_norm && (
              <>
                , суммарная трудоёмкость{' '}
                <strong>{schedule.total_hours_norm} н/ч</strong>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" type="button">
              <Link href="/app/maintenance">Отмена</Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Отправка…' : 'Подать заявку'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewMaintenanceRequestPage() {
  return (
    <Suspense fallback={<div className="p-6 text-secondary-500">Загрузка…</div>}>
      <NewMaintenanceRequestInner />
    </Suspense>
  );
}
