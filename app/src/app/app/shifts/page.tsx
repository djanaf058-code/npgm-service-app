'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Truck, Calendar, ChevronRight, ClipboardCheck, Activity } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { ShiftStatusBadge } from '@/components/shifts/ShiftStatusBadge';
import type { ShiftStatus, ChargingRecipe } from '@/lib/types';

interface ShiftRow {
  id: string;
  status: ShiftStatus;
  machine_id: string;
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

const shiftDate = (s: ShiftRow): string | null =>
  s.planned_for ?? s.started_at?.split('T')[0] ?? null;
const monthOf = (s: ShiftRow): string | null => {
  const d = shiftDate(s);
  return d ? d.slice(0, 7) : null;
};
const machineLabelOf = (s: ShiftRow): string =>
  s.machine?.internal_name?.trim() || s.machine?.model_code || '—';

export default function ShiftsListPage() {
  const t = useTranslations('shifts.list');
  const tRecipe = useTranslations('shifts.recipe');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [machineFilter, setMachineFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { data, error } = await supabase
          .from('shifts')
          .select(
            'id, status, machine_id, planned_for, started_at, completed_at, plan_recipe, plan_recipe_b, plan_recipe_b_holes, plan_tons, actual_tons, machine:machines(model_code, machine_type, internal_name), operator:profiles!shifts_operator_id_fkey(full_name)'
          )
          .order('planned_for', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(200);
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

  // Distinct filter options derived from loaded shifts.
  const machineOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shifts) if (s.machine_id) map.set(s.machine_id, machineLabelOf(s));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [shifts]);

  const operatorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) if (s.operator?.full_name) set.add(s.operator.full_name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [shifts]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) {
      const m = monthOf(s);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [shifts]);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  };

  const filtered = useMemo(
    () =>
      shifts.filter((s) => {
        if (machineFilter !== 'all' && s.machine_id !== machineFilter) return false;
        if (operatorFilter !== 'all' && s.operator?.full_name !== operatorFilter) return false;
        if (monthFilter !== 'all' && monthOf(s) !== monthFilter) return false;
        return true;
      }),
    [shifts, machineFilter, operatorFilter, monthFilter]
  );

  // Summary over the filtered set: tons (actual, falling back to plan), shift
  // count, distinct operators.
  const summary = useMemo(() => {
    let tons = 0;
    const ops = new Set<string>();
    for (const s of filtered) {
      tons += Number(s.actual_tons ?? s.plan_tons ?? 0);
      if (s.operator?.full_name) ops.add(s.operator.full_name);
    }
    return { tons, shifts: filtered.length, operators: ops.size };
  }, [filtered]);

  const filtersActive = machineFilter !== 'all' || operatorFilter !== 'all' || monthFilter !== 'all';

  const activeShifts = filtered.filter((s) => s.status === 'in_progress' || s.status === 'planned');
  const closedShifts = filtered.filter((s) => s.status === 'completed' || s.status === 'cancelled' || s.status === 'blocked');

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
          {/* Filters + summary */}
          <Card className="p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={machineFilter}
                onChange={(e) => setMachineFilter(e.target.value)}
                className="h-9 text-sm max-w-[200px]"
              >
                <option value="all">{t('filter_all_machines')}</option>
                {machineOptions.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </Select>
              <Select
                value={operatorFilter}
                onChange={(e) => setOperatorFilter(e.target.value)}
                className="h-9 text-sm max-w-[200px]"
              >
                <option value="all">{t('filter_all_operators')}</option>
                {operatorOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </Select>
              <Select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="h-9 text-sm max-w-[180px]"
              >
                <option value="all">{t('filter_all_months')}</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </Select>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setMachineFilter('all');
                    setOperatorFilter('all');
                    setMonthFilter('all');
                  }}
                  className="text-xs text-secondary-500 hover:text-secondary-900 underline"
                >
                  {t('filter_reset')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-secondary-700 border-t border-secondary-100 pt-3">
              <Activity className="w-4 h-4 text-primary-600 flex-shrink-0" />
              <span className="tabular-nums">
                <strong>{Number(summary.tons).toLocaleString(dateLocale)} {tCommon('tons_short')}</strong>
                {' · '}
                {t('summary_shifts', { count: summary.shifts })}
                {' · '}
                {t('summary_operators', { count: summary.operators })}
              </span>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-secondary-600 text-sm">{t('no_filter_match')}</p>
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
