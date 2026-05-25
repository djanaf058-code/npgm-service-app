'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getRecipeSpec, type ComponentMix } from '@/lib/calculations/recipes';

export interface ChargingPlanValue {
  totalTons: number;
  emulsionTons: number | null;
  anTons: number | null;
  dieselTons: number | null;
  // Derived from the per-component tonnage. Stored on the shift row so the
  // list can show a quick badge (70/30, ANFO, etc.).
  recipe: 'ANFO' | 'EMULSION' | 'BLEND_70_30' | 'BLEND_30_70' | 'OTHER';
  mix: ComponentMix;
}

interface Props {
  machineType: string | null | undefined;
  initialEmulsionTons?: string;
  initialAnTons?: string;
  initialDieselTons?: string;
  onChange: (value: ChargingPlanValue | null) => void;
  variant?: 'plan' | 'actual';
  disabled?: boolean;
}

function deriveRecipeEnum(mix: ComponentMix): ChargingPlanValue['recipe'] {
  const eq = (a: number, b: number) => Math.abs(a - b) < 5;
  if (eq(mix.emulsion_pct, 100)) return 'EMULSION';
  if (mix.emulsion_pct === 0 && mix.an_pct >= 80) return 'ANFO';
  if (eq(mix.emulsion_pct, 70) && eq(mix.an_pct, 30)) return 'BLEND_70_30';
  if (eq(mix.emulsion_pct, 30) && eq(mix.an_pct, 70)) return 'BLEND_30_70';
  return 'OTHER';
}

function parseTons(raw: string): number {
  const v = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function ChargingPlanInput({
  machineType,
  initialEmulsionTons = '',
  initialAnTons = '',
  initialDieselTons = '',
  onChange,
  variant = 'plan',
  disabled = false,
}: Props) {
  const t = useTranslations('charging_input');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const spec = useMemo(() => getRecipeSpec(machineType), [machineType]);

  // Which components this machine type uses.
  const shows = useMemo(() => {
    if (spec.kind === 'fixed') {
      return {
        emulsion: spec.mix.emulsion_pct > 0,
        an: spec.mix.an_pct > 0,
        diesel: spec.mix.diesel_pct > 0,
      };
    }
    if (spec.kind === 'em_an_range') {
      return { emulsion: true, an: true, diesel: false };
    }
    return { emulsion: true, an: true, diesel: true };
  }, [spec]);

  const [emulsion, setEmulsion] = useState(initialEmulsionTons);
  const [an, setAn] = useState(initialAnTons);
  const [diesel, setDiesel] = useState(initialDieselTons);

  // Reset hidden fields when machine type changes.
  useEffect(() => {
    if (!shows.emulsion) setEmulsion('');
    if (!shows.an) setAn('');
    if (!shows.diesel) setDiesel('');
  }, [shows.emulsion, shows.an, shows.diesel]);

  // Lift value upward on every change.
  useEffect(() => {
    const em = shows.emulsion ? parseTons(emulsion) : 0;
    const ann = shows.an ? parseTons(an) : 0;
    const dl = shows.diesel ? parseTons(diesel) : 0;
    const total = em + ann + dl;

    if (total <= 0) {
      onChange(null);
      return;
    }

    const mix: ComponentMix = {
      emulsion_pct: (em / total) * 100,
      an_pct: (ann / total) * 100,
      diesel_pct: (dl / total) * 100,
    };

    onChange({
      totalTons: Math.round(total * 1000) / 1000,
      emulsionTons: shows.emulsion && em > 0 ? em : null,
      anTons: shows.an && ann > 0 ? ann : null,
      dieselTons: shows.diesel && dl > 0 ? dl : null,
      recipe: deriveRecipeEnum(mix),
      mix,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emulsion, an, diesel, shows.emulsion, shows.an, shows.diesel]);

  const totalNum = useMemo(() => {
    const em = shows.emulsion ? parseTons(emulsion) : 0;
    const ann = shows.an ? parseTons(an) : 0;
    const dl = shows.diesel ? parseTons(diesel) : 0;
    return em + ann + dl;
  }, [emulsion, an, diesel, shows.emulsion, shows.an, shows.diesel]);

  const totalLabel = variant === 'plan' ? t('total_plan') : t('total_actual');
  const reqMark = variant === 'plan' ? ' *' : '';

  return (
    <div className="space-y-4">
      <div className="text-xs text-secondary-600 px-1">
        <strong>{t('machine_prefix')}:</strong> {machineType ?? '—'}
      </div>

      {shows.emulsion && (
        <div>
          <Label htmlFor="cmpEm">{t('emulsion')} *</Label>
          <Input
            id="cmpEm"
            type="number"
            step="0.1"
            min="0"
            value={emulsion}
            onChange={(e) => setEmulsion(e.target.value)}
            disabled={disabled}
            placeholder="14.5"
            className="mt-1"
            inputMode="decimal"
          />
        </div>
      )}

      {shows.an && (
        <div>
          <Label htmlFor="cmpAn">{t('an')}{reqMark}</Label>
          <Input
            id="cmpAn"
            type="number"
            step="0.1"
            min="0"
            value={an}
            onChange={(e) => setAn(e.target.value)}
            disabled={disabled}
            placeholder="6.0"
            className="mt-1"
            inputMode="decimal"
          />
        </div>
      )}

      {shows.diesel && (
        <div>
          <Label htmlFor="cmpDiesel">{t('diesel')}{reqMark}</Label>
          <Input
            id="cmpDiesel"
            type="number"
            step="0.1"
            min="0"
            value={diesel}
            onChange={(e) => setDiesel(e.target.value)}
            disabled={disabled}
            placeholder="0.3"
            className="mt-1"
            inputMode="decimal"
          />
        </div>
      )}

      <div className="rounded-md border border-secondary-200 bg-secondary-50/40 px-3 py-2 flex items-center justify-between text-sm">
        <span className="text-secondary-600">{totalLabel}:</span>
        <strong className="tabular-nums text-secondary-900">
          {totalNum > 0 ? totalNum.toLocaleString(numLocale) : '—'}
        </strong>
      </div>
    </div>
  );
}
