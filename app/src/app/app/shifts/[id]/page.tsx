'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Truck,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  Check,
  X as XIcon,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShiftStatusBadge } from '@/components/shifts/ShiftStatusBadge';
import { ChargingPlanInput, type ChargingPlanValue } from '@/components/shifts/ChargingPlanInput';
import type {
  ShiftStatus,
  ChargingRecipe,
  ChecklistItem,
  ChecklistAnswer,
} from '@/lib/types';

interface ShiftDetail {
  id: string;
  status: ShiftStatus;
  planned_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  plan_recipe: ChargingRecipe | null;
  plan_tons: number | null;
  plan_emulsion_tons: number | null;
  plan_an_tons: number | null;
  plan_diesel_tons: number | null;
  plan_holes: number | null;
  plan_pit_location: string | null;
  plan_notes: string | null;
  actual_tons: number | null;
  actual_emulsion_tons: number | null;
  actual_an_tons: number | null;
  actual_diesel_tons: number | null;
  actual_engine_hours: number | null;
  actual_notes: string | null;
  machine: { id: string; model_code: string; machine_type: string; tons_pumped: number; engine_hours: number } | null;
  operator: { full_name: string } | null;
}

interface ChecklistRow {
  id: string;
  template_id: string;
  template: { kind: 'pre_shift' | 'monthly' | string } | null;
  items_snapshot: ChecklistItem[];
  items_status: ChecklistAnswer[];
  has_critical_fail: boolean;
  notes: string | null;
  completed_at: string;
}

const RECIPE_LABELS: Record<ChargingRecipe, string> = {
  ANFO: 'ANFO (100%)',
  EMULSION: '100% эмульсия',
  BLEND_70_30: 'Смесевой 70/30',
  BLEND_30_70: 'Смесевой 30/70',
  OTHER: 'Другой',
};

export default function ShiftDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const shiftId = params.id;

  const [shift, setShift] = useState<ShiftDetail | null>(null);
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [closeOpen, setCloseOpen] = useState(false);
  const [actualValue, setActualValue] = useState<ChargingPlanValue | null>(null);
  const [actualNotes, setActualNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  void router;

  const reload = async () => {
    setLoading(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const [shiftResp, checkResp] = await Promise.all([
        supabase
          .from('shifts')
          .select(
            'id, status, planned_for, started_at, completed_at, plan_recipe, plan_tons, plan_emulsion_tons, plan_an_tons, plan_diesel_tons, plan_holes, plan_pit_location, plan_notes, actual_tons, actual_emulsion_tons, actual_an_tons, actual_diesel_tons, actual_engine_hours, actual_notes, machine:machines(id, model_code, machine_type, tons_pumped, engine_hours), operator:profiles!shifts_operator_id_fkey(full_name)'
          )
          .eq('id', shiftId)
          .maybeSingle(),
        supabase
          .from('checklist_executions')
          .select(
            'id, template_id, items_snapshot, items_status, has_critical_fail, notes, completed_at, template:checklist_templates(kind)'
          )
          .eq('shift_id', shiftId)
          .order('completed_at', { ascending: true }),
      ]);
      if (shiftResp.error) throw shiftResp.error;
      if (!shiftResp.data) {
        setError('Смена не найдена');
        return;
      }
      setShift(shiftResp.data as unknown as ShiftDetail);
      if (checkResp.data) setChecklists(checkResp.data as unknown as ChecklistRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  const handleClose = async () => {
    if (!shift) return;
    if (!actualValue) {
      setError('Заполните фактический тоннаж и состав');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const { error: err } = await supabase
        .from('shifts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_tons: actualValue.totalTons,
          actual_emulsion_tons: actualValue.emulsionTons,
          actual_an_tons: actualValue.anTons,
          actual_diesel_tons: actualValue.dieselTons,
          actual_notes: actualNotes.trim() || null,
        })
        .eq('id', shift.id);
      if (err) throw err;
      // The DB trigger increments machines.tons_pumped automatically.
      await reload();
      setCloseOpen(false);
    } catch (err) {
      let msg: string;
      if (err instanceof Error) msg = err.message;
      else if (err && typeof err === 'object' && 'message' in err) msg = String((err as { message: unknown }).message);
      else msg = JSON.stringify(err);
      setError(`Не удалось закрыть смену: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!shift || !confirm('Отменить смену? Это действие нельзя откатить.')) return;
    setSubmitting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();
      const { error: err } = await supabase
        .from('shifts')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', shift.id);
      if (err) throw err;
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отменить');
    } finally {
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

  if (error || !shift) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/app/shifts"
          className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> К списку смен
        </Link>
        <Card className="p-6 text-center">
          <p className="text-accent-700 whitespace-pre-wrap">{error ?? 'Смена не найдена'}</p>
        </Card>
      </div>
    );
  }

  const isClosed =
    shift.status === 'completed' || shift.status === 'cancelled' || shift.status === 'blocked';
  const dateStr = shift.planned_for ?? shift.started_at?.split('T')[0] ?? null;

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href="/app/shifts"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />К списку смен
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <ShiftStatusBadge status={shift.status} />
                {shift.plan_recipe && (
                  <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-secondary-100 text-secondary-700">
                    {RECIPE_LABELS[shift.plan_recipe]}
                  </span>
                )}
              </div>
              <h1 className="font-heading text-xl md:text-2xl font-bold text-secondary-900">
                Смена{' — '}
                {shift.machine ? (
                  <Link
                    href={`/app/machines/${shift.machine.id}`}
                    className="text-primary-700 hover:underline"
                  >
                    {shift.machine.model_code}
                  </Link>
                ) : (
                  '—'
                )}
              </h1>
              <p className="text-sm text-secondary-600 mt-1">
                Оператор: <strong>{shift.operator?.full_name ?? '—'}</strong>
                {dateStr && (
                  <>
                    {' · '}
                    <Calendar className="inline w-3 h-3" />{' '}
                    {new Date(dateStr).toLocaleDateString('ru-RU')}
                  </>
                )}
              </p>
            </div>
          </div>

          {!isClosed && shift.status === 'in_progress' && (
            <Button onClick={() => setCloseOpen(true)}>
              <CheckCircle2 className="w-4 h-4" />
              Закрыть смену
            </Button>
          )}
        </div>

        {shift.status === 'blocked' && (
          <div className="mt-4 p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Смена заблокирована — в чек-листе была критичная ошибка. Устраните неисправность,
              затем создайте новую смену.
            </span>
          </div>
        )}
      </Card>

      {/* Plan vs Actual */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-heading font-semibold text-secondary-900 mb-3">План</h3>
          <dl className="space-y-2 text-sm">
            <Row
              label="Рецепт"
              value={shift.plan_recipe ? RECIPE_LABELS[shift.plan_recipe] : '—'}
            />
            {shift.plan_emulsion_tons !== null && (
              <Row
                label="Эмульсия"
                value={`${Number(shift.plan_emulsion_tons).toLocaleString('ru-RU')} т`}
              />
            )}
            {shift.plan_an_tons !== null && (
              <Row
                label="Аммиачная селитра (AN)"
                value={`${Number(shift.plan_an_tons).toLocaleString('ru-RU')} т`}
              />
            )}
            {shift.plan_diesel_tons !== null && (
              <Row
                label="Дизель"
                value={`${Number(shift.plan_diesel_tons).toLocaleString('ru-RU')} т`}
              />
            )}
            <Row
              label="Итого тонн"
              value={shift.plan_tons !== null ? `${Number(shift.plan_tons).toLocaleString('ru-RU')} т` : '—'}
              strong
            />
            <Row label="Скважин" value={shift.plan_holes !== null ? String(shift.plan_holes) : '—'} />
            <Row label="Карьер" value={shift.plan_pit_location ?? '—'} />
          </dl>
          {shift.plan_notes && (
            <p className="mt-3 text-xs text-secondary-600 italic">{shift.plan_notes}</p>
          )}
        </Card>

        <Card className={`p-5 ${shift.actual_tons !== null ? 'bg-emerald-50/30 border-emerald-200' : 'bg-secondary-50/40 border-dashed'}`}>
          <h3 className="font-heading font-semibold text-secondary-900 mb-3">Факт</h3>
          {shift.actual_tons !== null ? (
            <dl className="space-y-2 text-sm">
              {shift.actual_emulsion_tons !== null && (
                <Row
                  label="Эмульсия"
                  value={`${Number(shift.actual_emulsion_tons).toLocaleString('ru-RU')} т`}
                />
              )}
              {shift.actual_an_tons !== null && (
                <Row
                  label="Аммиачная селитра (AN)"
                  value={`${Number(shift.actual_an_tons).toLocaleString('ru-RU')} т`}
                />
              )}
              {shift.actual_diesel_tons !== null && (
                <Row
                  label="Дизель"
                  value={`${Number(shift.actual_diesel_tons).toLocaleString('ru-RU')} т`}
                />
              )}
              <Row
                label="Итого прокачано"
                value={`${Number(shift.actual_tons).toLocaleString('ru-RU')} т`}
                strong
              />
              {shift.completed_at && (
                <Row label="Закрыта" value={new Date(shift.completed_at).toLocaleString('ru-RU')} />
              )}
            </dl>
          ) : (
            <p className="text-sm text-secondary-500 italic">Смена ещё не закрыта</p>
          )}
          {shift.actual_notes && (
            <p className="mt-3 text-xs text-secondary-600 italic">{shift.actual_notes}</p>
          )}
        </Card>
      </div>

      {/* Checklists (one or two: pre_shift + monthly when due) */}
      {checklists.length > 0 && checklists.map((cl) => {
        const isMonthly = cl.template?.kind === 'monthly';
        return (
          <Card key={cl.id}>
            <CardHeader>
              <CardTitle className="font-heading text-base flex items-center gap-2 flex-wrap">
                {isMonthly ? 'Ежемесячный осмотр' : 'Ежесменный осмотр'}
                {cl.has_critical_fail && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded">
                    <AlertTriangle className="w-3 h-3" /> Критичный fail
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-secondary-100">
                {cl.items_snapshot.map((item) => {
                  const ans = cl.items_status.find((a) => a.item_id === item.id);
                  const status = ans?.status ?? 'skip';
                  const Icon = status === 'pass' ? Check : XIcon;
                  const color =
                    status === 'pass'
                      ? 'text-emerald-700 bg-emerald-50'
                      : status === 'fail'
                        ? 'text-accent-700 bg-accent-50'
                        : 'text-secondary-600 bg-secondary-100';
                  return (
                    <li key={item.id} className="py-2.5">
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded ${color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-secondary-900">
                            {item.name_ru}
                            {item.severity === 'critical' && (
                              <span className="ml-2 text-[10px] uppercase tracking-wider font-semibold text-accent-700">
                                critical
                              </span>
                            )}
                          </p>
                          {ans?.comment && (
                            <p className="text-xs text-secondary-600 italic mt-1">{ans.comment}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {cl.notes && (
                <p className="mt-3 text-xs text-secondary-600 pt-3 border-t border-secondary-100">
                  <strong>Примечание оператора:</strong> {cl.notes}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Close shift inline form */}
      {closeOpen && (
        <Card className="p-5 border-emerald-300 bg-emerald-50/30">
          <h3 className="font-heading font-semibold text-secondary-900 mb-3">Закрытие смены</h3>
          <ChargingPlanInput
            machineType={shift.machine?.machine_type ?? null}
            onChange={setActualValue}
            variant="actual"
          />
          <div className="mt-3">
            <Label htmlFor="actualNotes">Примечания</Label>
            <Textarea
              id="actualNotes"
              value={actualNotes}
              onChange={(e) => setActualNotes(e.target.value)}
              placeholder="Что произошло за смену…"
              rows={2}
              className="mt-1"
            />
          </div>
          {error && (
            <div className="mt-3 p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
              {error}
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleClose} disabled={submitting || !actualValue}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {submitting ? 'Закрытие…' : 'Закрыть смену'}
            </Button>
          </div>
        </Card>
      )}

      {/* Cancel link for active shifts */}
      {!isClosed && !closeOpen && shift.status !== 'blocked' && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={submitting}>
            <XCircle className="w-4 h-4" />
            Отменить смену
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-secondary-500">{label}</dt>
      <dd className={`text-secondary-900 ${strong ? 'font-bold tabular-nums' : ''}`}>{value}</dd>
    </div>
  );
}
