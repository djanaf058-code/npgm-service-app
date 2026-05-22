'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  Truck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Wrench,
  Box,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { MaintenanceWorkItem, MaintenanceBomItem } from '@/lib/types';
import {
  urgencyFromDays,
  REQUEST_LEAD_DAYS,
  type MaintenanceUrgency,
} from '@/lib/calculations/maintenance';

export interface ForecastCardData {
  machineId: string;
  machineLabel: string;
  machineType: string;
  modelCode: string;
  kindLabel: string;
  tonsRemaining: number;
  days: number;
  rate: number;
  rateIsReal: boolean;
  workItems: MaintenanceWorkItem[];
  partsRequired: MaintenanceBomItem[];
  totalHours: number | null;
  requestHref: string;
  /** When a request for this service is already in flight, link to it instead
   *  of offering to file a new one. */
  blockingHref?: string | null;
}

const URGENCY_CARD: Record<MaintenanceUrgency, string> = {
  overdue: 'border-accent-300 bg-accent-50',
  due_soon: 'border-accent-300 bg-accent-50/50',
  upcoming: 'border-amber-200 bg-amber-50/40',
  ok: 'border-secondary-200 bg-white',
};

const URGENCY_ICON: Record<MaintenanceUrgency, string> = {
  overdue: 'bg-accent-100 text-accent-700',
  due_soon: 'bg-accent-50 text-accent-600',
  upcoming: 'bg-amber-50 text-amber-700',
  ok: 'bg-primary-50 text-primary-600',
};

const URGENCY_DAYS: Record<MaintenanceUrgency, string> = {
  overdue: 'text-accent-700',
  due_soon: 'text-accent-700',
  upcoming: 'text-amber-700',
  ok: 'text-secondary-700',
};

export function MaintenanceForecastCard(props: ForecastCardData) {
  const t = useTranslations('maintenance_card');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const numLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const [open, setOpen] = useState(false);

  const urgency = urgencyFromDays(props.days, props.tonsRemaining);
  const isAlert = urgency === 'overdue' || urgency === 'due_soon';

  const workName = (w: MaintenanceWorkItem) =>
    locale === 'en' && w.name_en ? w.name_en : w.name_ru;
  const partName = (p: MaintenanceBomItem) =>
    locale === 'en' && p.display_name_en ? p.display_name_en : p.display_name_ru;

  const fmt = (n: number) => Number(n).toLocaleString(numLocale);
  const hasWorks = props.workItems.length > 0 || props.partsRequired.length > 0;

  return (
    <div className={`rounded-xl border p-4 transition-colors ${URGENCY_CARD[urgency]}`}>
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${URGENCY_ICON[urgency]}`}
        >
          {urgency === 'overdue' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Truck className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/app/machines/${props.machineId}`}
              className="font-medium text-secondary-900 hover:text-primary-700 hover:underline"
            >
              {props.machineLabel}
            </Link>
            <span className="text-xs text-secondary-500">({props.machineType})</span>
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-secondary-100 text-secondary-700">
              {props.kindLabel}
            </span>
            {props.blockingHref && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                {t('already_filed')}
              </span>
            )}
          </div>

          {/* Forecast breakdown: remaining · rate · days */}
          <p className="text-xs text-secondary-500 mt-1 tabular-nums">
            {t('remaining', { tons: fmt(props.tonsRemaining) })}
            {' · '}
            {props.rateIsReal
              ? t('rate_real', { rate: fmt(Math.round(props.rate)) })
              : t('rate_default', { rate: fmt(Math.round(props.rate)) })}
          </p>
          <p className={`text-sm font-semibold mt-0.5 tabular-nums ${URGENCY_DAYS[urgency]}`}>
            {urgency === 'overdue'
              ? t('overdue', { days: Math.abs(props.days) })
              : t('days_until', { days: props.days })}
            {urgency === 'due_soon' && (
              <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-accent-100 text-accent-700">
                {t('due_now_badge')}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Works & parts toggle */}
      {hasWorks && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-800"
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {open ? t('works_hide') : t('works_toggle')}
        </button>
      )}

      {open && hasWorks && (
        <div className="mt-3 space-y-3 rounded-lg bg-white/70 border border-secondary-100 p-3">
          {props.totalHours != null && (
            <p className="text-xs text-secondary-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-secondary-400" />
              {t('hours_total', { hours: fmt(props.totalHours) })}
            </p>
          )}

          {props.workItems.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-secondary-400 mb-1.5 flex items-center gap-1">
                <Wrench className="w-3 h-3" /> {t('works_section')}
              </p>
              <ul className="space-y-1">
                {props.workItems.map((w, i) => (
                  <li key={i} className="text-sm text-secondary-800 flex items-start justify-between gap-2">
                    <span className="flex-1">{workName(w)}</span>
                    {w.hours_norm != null && (
                      <span className="text-xs text-secondary-500 tabular-nums flex-shrink-0">
                        {t('hours_short', { hours: fmt(w.hours_norm) })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {props.partsRequired.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-secondary-400 mb-1.5 flex items-center gap-1">
                <Box className="w-3 h-3" /> {t('parts_section')}
              </p>
              <ul className="space-y-1">
                {props.partsRequired.map((p, i) => (
                  <li key={i} className="text-sm text-secondary-800 flex items-start justify-between gap-2">
                    <span className="flex-1">{partName(p)}</span>
                    <span className="text-xs text-secondary-500 tabular-nums flex-shrink-0">
                      {t('qty_short', { qty: p.quantity })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Submit request (or open existing) + deadline note */}
      <div className="mt-3 pt-3 border-t border-secondary-100/80">
        {props.blockingHref ? (
          <Link
            href={props.blockingHref}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium bg-white text-secondary-900 border border-secondary-300 hover:bg-secondary-50 transition-colors"
          >
            {t('open_request')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <>
            <Link
              href={props.requestHref}
              className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors"
            >
              {tCommon('submit')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p
              className={`mt-2 text-xs ${
                isAlert ? 'text-accent-700 font-medium' : 'text-secondary-500'
              }`}
            >
              {urgency === 'overdue'
                ? t('deadline_overdue')
                : urgency === 'due_soon'
                  ? t('deadline_now')
                  : t('deadline_note', { lead: REQUEST_LEAD_DAYS })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
