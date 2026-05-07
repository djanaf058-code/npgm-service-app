'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Truck, Calendar, ChevronRight, ClipboardCheck } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShiftStatusBadge } from '@/components/shifts/ShiftStatusBadge';
import type { ShiftStatus, ChargingRecipe } from '@/lib/types';

interface ShiftRow {
  id: string;
  status: ShiftStatus;
  planned_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  plan_recipe: ChargingRecipe | null;
  plan_tons: number | null;
  actual_tons: number | null;
  machine: { model_code: string; machine_type: string } | null;
  operator: { full_name: string } | null;
}

const RECIPE_LABELS: Record<ChargingRecipe, string> = {
  ANFO: 'ANFO',
  EMULSION: '100% эмульсия',
  BLEND_70_30: '70/30',
  BLEND_30_70: '30/70',
  OTHER: 'Другой',
};

export default function ShiftsListPage() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { data, error } = await supabase
          .from('shifts')
          .select(
            'id, status, planned_for, started_at, completed_at, plan_recipe, plan_tons, actual_tons, machine:machines(model_code, machine_type), operator:profiles!shifts_operator_id_fkey(full_name)'
          )
          .order('planned_for', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setShifts((data ?? []) as unknown as ShiftRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить смены');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeShifts = shifts.filter((s) => s.status === 'in_progress' || s.status === 'planned');
  const closedShifts = shifts.filter((s) => s.status === 'completed' || s.status === 'cancelled' || s.status === 'blocked');

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
            Смены
          </h1>
          <p className="text-secondary-600 text-sm mt-1">
            Перед каждой сменой — чек-лист машины и план зарядки. После закрытия смены
            тонны прокачки автоматически приращиваются к счётчику машины.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/shifts/start">
            <Plus className="w-4 h-4" />
            Начать смену
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-secondary-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Загрузка…
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <p className="text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      ) : shifts.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
          <h3 className="font-heading font-semibold text-secondary-900 mb-2">Смен пока нет</h3>
          <p className="text-secondary-600 text-sm max-w-md mx-auto mb-6">
            Начните первую смену — пройдите чек-лист, заполните план зарядки. По окончании
            тонны учтутся в счётчике машины и пересчитают прогноз ТО.
          </p>
          <Button asChild>
            <Link href="/app/shifts/start">
              <Plus className="w-4 h-4" />
              Начать смену
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          {activeShifts.length > 0 && (
            <section>
              <h2 className="font-heading text-base font-semibold text-secondary-700 uppercase tracking-wider mb-3">
                Активные ({activeShifts.length})
              </h2>
              <div className="space-y-2">
                {activeShifts.map((s) => (
                  <ShiftCard key={s.id} shift={s} />
                ))}
              </div>
            </section>
          )}

          {closedShifts.length > 0 && (
            <section>
              <h2 className="font-heading text-base font-semibold text-secondary-700 uppercase tracking-wider mb-3">
                История ({closedShifts.length})
              </h2>
              <div className="space-y-2">
                {closedShifts.map((s) => (
                  <ShiftCard key={s.id} shift={s} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ShiftCard({ shift }: { shift: ShiftRow }) {
  const date = shift.planned_for ?? shift.started_at?.split('T')[0] ?? null;
  return (
    <Link
      href={`/app/shifts/${shift.id}`}
      className="block bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <ShiftStatusBadge status={shift.status} />
            {shift.plan_recipe && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-secondary-100 text-secondary-700">
                {RECIPE_LABELS[shift.plan_recipe]}
              </span>
            )}
          </div>
          <p className="font-medium text-secondary-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-secondary-400" />
            {shift.machine?.model_code ?? '—'}{' '}
            <span className="text-xs text-secondary-500">({shift.machine?.machine_type ?? ''})</span>
          </p>
          <p className="text-xs text-secondary-500 mt-0.5 flex items-center gap-2">
            {date && (
              <>
                <Calendar className="w-3 h-3" />
                {new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
              </>
            )}
            {shift.operator?.full_name && (
              <>
                {' · '}оператор: {shift.operator.full_name}
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          {shift.actual_tons !== null ? (
            <p className="text-sm tabular-nums">
              <strong>{Number(shift.actual_tons).toLocaleString('ru-RU')}</strong>
              <span className="text-secondary-500 text-xs"> / {shift.plan_tons ?? '?'} т</span>
            </p>
          ) : shift.plan_tons !== null ? (
            <p className="text-sm tabular-nums text-secondary-700">
              план: <strong>{Number(shift.plan_tons).toLocaleString('ru-RU')} т</strong>
            </p>
          ) : (
            <p className="text-xs text-secondary-400">—</p>
          )}
          <ChevronRight className="w-4 h-4 text-secondary-300 inline" />
        </div>
      </div>
    </Link>
  );
}
