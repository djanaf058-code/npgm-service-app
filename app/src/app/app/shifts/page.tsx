'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Truck, Calendar, ChevronRight, ClipboardCheck } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
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
  plan_recipe_b: ChargingRecipe | null;
  plan_recipe_b_holes: number | null;
  plan_tons: number | null;
  actual_tons: number | null;
  machine: { model_code: string; machine_type: string; internal_name: string | null } | null;
  operator: { full_name: string } | null;
}

export default function ShiftsListPage() {
  const t = useTranslations('shifts.list');
  const tRecipe = useTranslations('shifts.recipe');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
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
            'id, status, planned_for, started_at, completed_at, plan_recipe, plan_recipe_b, plan_recipe_b_holes, plan_tons, actual_tons, machine:machines(model_code, machine_type, internal_name), operator:profiles!shifts_operator_id_fkey(full_name)'
          )
          .order('planned_for', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setShifts((data ?? []) as unknown as ShiftRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('load_failed'));
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeShifts = shifts.filter((s) => s.status === 'in_progress' || s.status === 'planned');
  const closedShifts = shifts.filter((s) => s.status === 'completed' || s.status === 'cancelled' || s.status === 'blocked');

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
            {t('title')}
          </h1>
          <p className="text-secondary-600 text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/shifts/start">
            <Plus className="w-4 h-4" />
            {t('start_button')}
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-secondary-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          {t('loading')}
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <p className="text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      ) : shifts.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
          <h3 className="font-heading font-semibold text-secondary-900 mb-2">{t('empty_title')}</h3>
          <p className="text-secondary-600 text-sm max-w-md mx-auto mb-6">
            {t('empty_subtitle')}
          </p>
          <Button asChild>
            <Link href="/app/shifts/start">
              <Plus className="w-4 h-4" />
              {t('start_button')}
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          {activeShifts.length > 0 && (
            <section>
              <h2 className="font-heading text-base font-semibold text-secondary-700 uppercase tracking-wider mb-3">
                {t('section_active', { count: activeShifts.length })}
              </h2>
              <div className="space-y-2">
                {activeShifts.map((s) => (
                  <ShiftCard
                    key={s.id}
                    shift={s}
                    dateLocale={dateLocale}
                    tDetail={t}
                    tRecipe={tRecipe}
                    tCommon={tCommon}
                  />
                ))}
              </div>
            </section>
          )}

          {closedShifts.length > 0 && (
            <section>
              <h2 className="font-heading text-base font-semibold text-secondary-700 uppercase tracking-wider mb-3">
                {t('section_history', { count: closedShifts.length })}
              </h2>
              <div className="space-y-2">
                {closedShifts.map((s) => (
                  <ShiftCard
                    key={s.id}
                    shift={s}
                    dateLocale={dateLocale}
                    tDetail={t}
                    tRecipe={tRecipe}
                    tCommon={tCommon}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

type TFn = (key: string, values?: Record<string, string | number>) => string;

function ShiftCard({
  shift,
  dateLocale,
  tDetail,
  tRecipe,
  tCommon,
}: {
  shift: ShiftRow;
  dateLocale: string;
  tDetail: TFn;
  tRecipe: TFn;
  tCommon: TFn;
}) {
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
                {tRecipe(shift.plan_recipe)}
              </span>
            )}
          </div>
          <p className="font-medium text-secondary-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-secondary-400" />
            {shift.machine?.internal_name?.trim() || shift.machine?.model_code || '—'}{' '}
            <span className="text-xs text-secondary-500">({shift.machine?.machine_type ?? ''})</span>
          </p>
          {shift.machine?.internal_name?.trim() && (
            <p className="text-xs text-secondary-400 ml-6 mt-0.5">{shift.machine.model_code}</p>
          )}
          <p className="text-xs text-secondary-500 mt-0.5 flex items-center gap-2">
            {date && (
              <>
                <Calendar className="w-3 h-3" />
                {new Date(date).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' })}
              </>
            )}
            {shift.operator?.full_name && (
              <>
                {' · '}
                {tDetail('operator_label', { name: shift.operator.full_name })}
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          {shift.actual_tons !== null ? (
            <p className="text-sm tabular-nums">
              <strong>{Number(shift.actual_tons).toLocaleString(dateLocale)}</strong>
              <span className="text-secondary-500 text-xs"> / {shift.plan_tons ?? '?'} {tCommon('tons_short')}</span>
            </p>
          ) : shift.plan_tons !== null ? (
            <p className="text-sm tabular-nums text-secondary-700">
              {tDetail('plan_label')} <strong>{Number(shift.plan_tons).toLocaleString(dateLocale)} {tCommon('tons_short')}</strong>
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
