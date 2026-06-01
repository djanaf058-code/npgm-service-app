'use client';

import {
  FileText,
  Layers,
  Send,
  Quote as QuoteIcon,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRole } from '@/lib/context/GlobalContext';
import type { PartsRequestStatus, PartsRequestKind } from '@/lib/types';

interface RequestEventInputs {
  kind: PartsRequestKind;
  submitted_at: string | null;
  consolidated_at: string | null;
  submitted_to_pm_at: string | null;
  forwarded_at: string | null;
  quoted_at: string | null;
  quote_notes: string | null;
  quote_total_amount: number | null;
  quote_currency: string | null;
  approved_at: string | null;
  ordered_at: string | null;
  expected_delivery_date: string | null;
  received_at: string | null;
  received_quantity_text: string | null;
  received_notes: string | null;
  cancel_reason: string | null;
  status: PartsRequestStatus;
  // For "by" labels — null-safe.
  submitted_to_pm_by_name?: string | null;
  forwarded_by_name?: string | null;
  quoted_by_name?: string | null;
  approved_by_name?: string | null;
  ordered_by_name?: string | null;
  received_by_name?: string | null;
}

interface Event {
  key: string;
  icon: LucideIcon;
  title: string;
  at: string | null;
  byName?: string | null;
  detail?: string | null;
  done: boolean;
  highlight?: 'success' | 'cancel' | null;
}

function fmtFor(dateLocale: string) {
  return (at: string | null): string => {
    if (!at) return '';
    const d = new Date(at);
    return d.toLocaleString(dateLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
}

export function RequestTimeline(props: RequestEventInputs) {
  const t = useTranslations('parts_timeline');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const fmt = fmtFor(dateLocale);
  const cancelled = props.status === 'cancelled';
  const isOperatorKind = props.kind === 'operator';
  const { isOperator, isServiceEngineer } = useRole();
  // Cost is hidden from operator / service_engineer always. Project manager
  // sees it once status reaches 'quoted' (i.e. quote was actually sent).
  // Platform_admin sees it always.
  const canSeePrice = !(isOperator || isServiceEngineer);

  // Reach a step iff the timestamp exists OR the status is past it.
  // Operator-level chain is much shorter — only submitted → consolidated.
  const reached = (stepStatus: PartsRequestStatus): boolean => {
    if (cancelled) return false;
    const order: PartsRequestStatus[] = isOperatorKind
      ? ['submitted', 'consolidated']
      : [
          'drafting',
          'pending_pm',
          'forwarded',
          'quoted',
          'approved',
          'ordered',
          'received',
        ];
    return order.indexOf(props.status) >= order.indexOf(stepStatus);
  };

  // For operator-kind rows we show a 2-step trace: created → absorbed into sweep.
  if (isOperatorKind) {
    const events: Event[] = [
      {
        key: 'submitted',
        icon: FileText,
        title: t('operator_submitted'),
        at: props.submitted_at,
        done: !!props.submitted_at,
      },
      {
        key: 'consolidated',
        icon: Layers,
        title: t('operator_consolidated'),
        at: props.consolidated_at,
        done: reached('consolidated'),
      },
    ];
    return renderTimeline(events, cancelled, props.cancel_reason, t('cancelled'), fmt);
  }

  const events: Event[] = [
    {
      key: 'drafting',
      icon: FileText,
      title: t('drafting_started'),
      at: props.submitted_at,  // populated when the consolidated row was created
      done: !!props.submitted_at,
    },
    {
      key: 'pending_pm',
      icon: Send,
      title: t('submitted_to_pm'),
      at: props.submitted_to_pm_at,
      byName: props.submitted_to_pm_by_name,
      done: reached('pending_pm'),
    },
    {
      key: 'forwarded',
      icon: Send,
      title: t('pm_approved'),
      at: props.forwarded_at,
      byName: props.forwarded_by_name,
      done: reached('forwarded'),
    },
    {
      key: 'quoted',
      icon: QuoteIcon,
      title: t('quote_received'),
      at: props.quoted_at,
      byName: props.quoted_by_name,
      // Show notes always; show the amount only to roles allowed to see prices.
      detail: props.quote_notes
        ? `${props.quote_notes}${
            canSeePrice && props.quote_total_amount
              ? ` · ${props.quote_total_amount.toLocaleString(dateLocale)} ${props.quote_currency ?? ''}`
              : ''
          }`
        : canSeePrice && props.quote_total_amount
        ? `${props.quote_total_amount.toLocaleString(dateLocale)} ${props.quote_currency ?? ''}`
        : null,
      done: reached('quoted'),
    },
    {
      key: 'approved',
      icon: CheckCircle2,
      title: t('pm_accepted'),
      at: props.approved_at,
      byName: props.approved_by_name,
      done: reached('approved'),
    },
    {
      key: 'ordered',
      icon: Truck,
      title: t('ordered'),
      at: props.ordered_at,
      byName: props.ordered_by_name,
      detail: props.expected_delivery_date
        ? `ETA: ${new Date(props.expected_delivery_date).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })}`
        : null,
      done: reached('ordered'),
    },
    {
      key: 'received',
      icon: PackageCheck,
      title: t('received'),
      at: props.received_at,
      byName: props.received_by_name,
      detail: [props.received_quantity_text, props.received_notes].filter(Boolean).join(' · ') || null,
      done: props.status === 'received',
      highlight: props.status === 'received' ? 'success' : null,
    },
  ];

  return renderTimeline(events, cancelled, props.cancel_reason, t('cancelled'), fmt);
}

function renderTimeline(
  events: Event[],
  cancelled: boolean,
  cancelReason: string | null,
  cancelledLabel: string,
  fmt: (at: string | null) => string,
) {
  return (
    <ol className="relative border-l-2 border-secondary-200 ml-3 space-y-4">
      {events.map((ev) => (
        <li key={ev.key} className="ml-4">
          <span
            className={`absolute -left-3.5 flex items-center justify-center w-6 h-6 rounded-full border-2 ${
              ev.done
                ? ev.highlight === 'success'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-primary-500 border-primary-500 text-white'
                : 'bg-white border-secondary-200 text-secondary-300'
            }`}
          >
            <ev.icon className="w-3 h-3" />
          </span>
          <div className={ev.done ? '' : 'opacity-50'}>
            <p className="text-sm font-medium text-secondary-900">{ev.title}</p>
            {ev.at && (
              <p className="text-xs text-secondary-500">
                {fmt(ev.at)}
                {ev.byName ? ` · ${ev.byName}` : ''}
              </p>
            )}
            {ev.detail && (
              <p className="text-xs text-secondary-700 mt-1 whitespace-pre-wrap">{ev.detail}</p>
            )}
          </div>
        </li>
      ))}
      {cancelled && (
        <li className="ml-4">
          <span className="absolute -left-3.5 flex items-center justify-center w-6 h-6 rounded-full bg-accent-500 border-2 border-accent-500 text-white">
            <XCircle className="w-3 h-3" />
          </span>
          <div>
            <p className="text-sm font-medium text-accent-700">{cancelledLabel}</p>
            {cancelReason && (
              <p className="text-xs text-accent-700 italic mt-1">{cancelReason}</p>
            )}
          </div>
        </li>
      )}
    </ol>
  );
}
