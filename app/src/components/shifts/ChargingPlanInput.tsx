'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  getRecipeSpec,
  computeComponentTons,
  isValidMix,
  MSZU_PRESETS,
  type ComponentMix,
} from '@/lib/calculations/recipes';

export interface ChargingPlanValue {
  totalTons: number;
  emulsionTons: number | null;
  anTons: number | null;
  dieselTons: number | null;
  // Derived recipe label suitable for the plan_recipe enum.
  // (For МСЗУ free mix it will be 'OTHER'.)
  recipe: 'ANFO' | 'EMULSION' | 'BLEND_70_30' | 'BLEND_30_70' | 'OTHER';
  mix: ComponentMix; // percentages (sum=100)
}

interface Props {
  machineType: string | null | undefined;
  initialTotalTons?: string;
  initialMix?: ComponentMix;
  // Called whenever the form has a complete + valid value.
  onChange: (value: ChargingPlanValue | null) => void;
  // Visual variant: 'plan' (initial planning) or 'actual' (closing the shift).
  variant?: 'plan' | 'actual';
  disabled?: boolean;
}

function deriveRecipeEnum(mix: ComponentMix): ChargingPlanValue['recipe'] {
  const eq = (a: number, b: number) => Math.abs(a - b) < 1.5;
  if (eq(mix.emulsion_pct, 100)) return 'EMULSION';
  if (mix.emulsion_pct === 0 && mix.an_pct >= 90 && mix.diesel_pct >= 1) return 'ANFO';
  if (eq(mix.emulsion_pct, 70) && eq(mix.an_pct, 30) && mix.diesel_pct === 0) return 'BLEND_70_30';
  if (eq(mix.emulsion_pct, 30) && eq(mix.an_pct, 70) && mix.diesel_pct === 0) return 'BLEND_30_70';
  return 'OTHER';
}

export function ChargingPlanInput({
  machineType,
  initialTotalTons = '',
  initialMix,
  onChange,
  variant = 'plan',
  disabled = false,
}: Props) {
  const spec = useMemo(() => getRecipeSpec(machineType), [machineType]);
  const [totalTons, setTotalTons] = useState(initialTotalTons);

  // Default mix per spec.kind on first mount or when machine type changes.
  const defaultMix = useMemo<ComponentMix>(() => {
    if (initialMix) return initialMix;
    if (spec.kind === 'fixed') return spec.mix;
    if (spec.kind === 'em_an_range') {
      return { emulsion_pct: spec.emulsionMaxPct, an_pct: 100 - spec.emulsionMaxPct, diesel_pct: 0 };
    }
    return { emulsion_pct: 100, an_pct: 0, diesel_pct: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.kind, machineType]);

  const [mix, setMix] = useState<ComponentMix>(defaultMix);

  // Reset mix when machine type changes (defaultMix changes).
  useEffect(() => {
    setMix(defaultMix);
  }, [defaultMix]);

  // Lift value upward on every change.
  useEffect(() => {
    const tt = parseFloat(totalTons);
    if (!Number.isFinite(tt) || tt <= 0) {
      onChange(null);
      return;
    }
    if (!isValidMix(mix)) {
      onChange(null);
      return;
    }
    if (spec.kind === 'em_an_range') {
      if (mix.emulsion_pct < spec.emulsionMinPct || mix.emulsion_pct > spec.emulsionMaxPct) {
        onChange(null);
        return;
      }
    }
    const tons = computeComponentTons(spec, tt, spec.kind === 'fixed' ? undefined : mix);
    onChange({
      totalTons: tt,
      emulsionTons: tons.emulsion,
      anTons: tons.an,
      dieselTons: tons.diesel,
      recipe: deriveRecipeEnum(spec.kind === 'fixed' ? spec.mix : mix),
      mix: spec.kind === 'fixed' ? spec.mix : mix,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalTons, mix, spec.kind, machineType]);

  const sumPct = mix.emulsion_pct + mix.an_pct + mix.diesel_pct;
  const sumOk = isValidMix(mix);

  // Render a numeric % input + range slider on one row.
  const PctRow = ({
    label,
    value,
    onChangeValue,
    min = 0,
    max = 100,
    accent,
    locked = false,
  }: {
    label: string;
    value: number;
    onChangeValue: (v: number) => void;
    min?: number;
    max?: number;
    accent: 'primary' | 'amber' | 'secondary';
    locked?: boolean;
  }) => {
    const accentBar = {
      primary: 'accent-primary-600',
      amber: 'accent-amber-600',
      secondary: 'accent-secondary-600',
    }[accent];
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{label}</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              step="1"
              min={min}
              max={max}
              value={Number.isFinite(value) ? value : 0}
              onChange={(e) => onChangeValue(parseFloat(e.target.value) || 0)}
              disabled={disabled || locked}
              className="w-16 h-8 text-right tabular-nums"
            />
            <span className="text-xs text-secondary-500">%</span>
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step="1"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChangeValue(parseFloat(e.target.value))}
          disabled={disabled || locked}
          className={`w-full ${accentBar}`}
        />
      </div>
    );
  };

  const totalNum = parseFloat(totalTons) || 0;
  const componentTons = computeComponentTons(spec, totalNum, spec.kind === 'fixed' ? undefined : mix);

  return (
    <div className="space-y-4">
      <div className="text-xs text-secondary-600 px-1">
        <strong>{machineType ?? '—'}:</strong> {spec.label}
      </div>

      {/* Total tonnage */}
      <div>
        <Label htmlFor="totalTons">
          {variant === 'plan' ? 'Плановый общий тоннаж, т *' : 'Фактический общий тоннаж, т *'}
        </Label>
        <Input
          id="totalTons"
          type="number"
          step="0.1"
          min="0"
          value={totalTons}
          onChange={(e) => setTotalTons(e.target.value)}
          disabled={disabled}
          placeholder="14.5"
          className="mt-1"
          required
        />
      </div>

      {/* Spec-specific mix UI */}
      {spec.kind === 'fixed' && (
        <div className="rounded-md border border-secondary-200 bg-secondary-50/40 p-3 space-y-1.5 text-sm">
          <p className="text-xs text-secondary-500 mb-1">Соотношение зашито для этого типа машины:</p>
          {spec.mix.emulsion_pct > 0 && (
            <ComponentRow label="Эмульсия" pct={spec.mix.emulsion_pct} tons={componentTons.emulsion} />
          )}
          {spec.mix.an_pct > 0 && (
            <ComponentRow label="Аммиачная селитра (AN)" pct={spec.mix.an_pct} tons={componentTons.an} />
          )}
          {spec.mix.diesel_pct > 0 && (
            <ComponentRow label="Дизельное топливо" pct={spec.mix.diesel_pct} tons={componentTons.diesel} />
          )}
        </div>
      )}

      {spec.kind === 'em_an_range' && (
        <div className="rounded-md border border-primary-100 bg-primary-50/30 p-3 space-y-3">
          <p className="text-xs text-secondary-600">
            Эмульсия от {spec.emulsionMinPct}% до {spec.emulsionMaxPct}%; селитра — остаток.
          </p>
          <PctRow
            label="Эмульсия"
            value={mix.emulsion_pct}
            min={spec.emulsionMinPct}
            max={spec.emulsionMaxPct}
            accent="primary"
            onChangeValue={(v) => {
              const clamped = Math.max(spec.emulsionMinPct, Math.min(spec.emulsionMaxPct, v));
              setMix({ emulsion_pct: clamped, an_pct: 100 - clamped, diesel_pct: 0 });
            }}
          />
          <PctRow
            label="Аммиачная селитра (AN)"
            value={mix.an_pct}
            min={100 - spec.emulsionMaxPct}
            max={100 - spec.emulsionMinPct}
            accent="amber"
            locked
            onChangeValue={() => {}}
          />
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-primary-100">
            <ComponentTonsBox label="Эмульсия" tons={componentTons.emulsion} />
            <ComponentTonsBox label="AN" tons={componentTons.an} />
          </div>
        </div>
      )}

      {spec.kind === 'free_three' && (
        <div className="rounded-md border border-primary-100 bg-primary-50/30 p-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-secondary-500 self-center mr-1">Пресет:</span>
            {MSZU_PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setMix(p.mix)}
                className="h-7 text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>
          <PctRow
            label="Эмульсия"
            value={mix.emulsion_pct}
            accent="primary"
            onChangeValue={(v) => setMix((m) => ({ ...m, emulsion_pct: clamp(v) }))}
          />
          <PctRow
            label="Аммиачная селитра (AN)"
            value={mix.an_pct}
            accent="amber"
            onChangeValue={(v) => setMix((m) => ({ ...m, an_pct: clamp(v) }))}
          />
          <PctRow
            label="Дизельное топливо"
            value={mix.diesel_pct}
            accent="secondary"
            onChangeValue={(v) => setMix((m) => ({ ...m, diesel_pct: clamp(v) }))}
          />
          <div
            className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
              sumOk ? 'bg-emerald-50 text-emerald-700' : 'bg-accent-50 text-accent-700'
            }`}
          >
            <span>Сумма процентов</span>
            <strong className="tabular-nums">{sumPct.toFixed(1)}%</strong>
          </div>
          {!sumOk && (
            <p className="text-xs text-accent-700">
              Сумма должна быть 100%. Сейчас не хватает{' '}
              <strong>{(100 - sumPct).toFixed(1)}%</strong>.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-primary-100">
            <ComponentTonsBox label="Эмульсия" tons={componentTons.emulsion} />
            <ComponentTonsBox label="AN" tons={componentTons.an} />
            <ComponentTonsBox label="Дизель" tons={componentTons.diesel} />
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function ComponentRow({
  label,
  pct,
  tons,
}: {
  label: string;
  pct: number;
  tons: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-secondary-700">{label}</span>
      <span className="tabular-nums text-secondary-900">
        <strong>{tons !== null ? tons.toLocaleString('ru-RU') : '—'}</strong> т
        <span className="ml-2 text-xs text-secondary-500">({pct}%)</span>
      </span>
    </div>
  );
}

function ComponentTonsBox({ label, tons }: { label: string; tons: number | null }) {
  return (
    <div className="text-center bg-white rounded-md border border-secondary-200 py-2">
      <div className="text-[10px] uppercase tracking-wider text-secondary-500">{label}</div>
      <div className="font-heading font-bold text-secondary-900 tabular-nums">
        {tons !== null ? tons.toLocaleString('ru-RU') : '—'}
        <span className="text-xs font-normal text-secondary-500"> т</span>
      </div>
    </div>
  );
}
