'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Plus,
  Wrench,
  Loader2,
  Search,
  Package,
  Box,
  ShoppingCart,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Inbox,
  ListChecks,
  Clock,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal, useRole } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PartCategoryBadge, CATEGORY_LABELS } from '@/components/parts/PartCategoryBadge';
import { StockBadge } from '@/components/parts/StockBadge';
import { AddStockDialog } from '@/components/parts/AddStockDialog';
import { RequestStatusBadge, isFinalStatus } from '@/components/parts/RequestStatusBadge';
import { ConsolidationPicker, type OperatorRow } from '@/components/parts/ConsolidationPicker';
import type {
  PartCategory,
  PartsRequestKind,
  PartsRequestStatus,
  PartsRequestUrgency,
} from '@/lib/types';

interface InventoryRow {
  id: string;
  quantity: number;
  reorder_threshold: number | null;
  last_replenished_at: string | null;
  machine: { id: string; model_code: string } | null;
  part: {
    id: string;
    display_name_ru: string;
    application_ru: string | null;
    category: PartCategory;
    unit: string;
    compatible_machine_types: string[];
  };
}

interface CatalogRow {
  id: string;
  display_name_ru: string;
  application_ru: string | null;
  category: PartCategory;
  unit: string;
  compatible_machine_types: string[];
}

interface PartsRequestRow {
  id: string;
  kind: PartsRequestKind;
  parent_id: string | null;
  status: PartsRequestStatus;
  urgency: PartsRequestUrgency;
  created_at: string;
  expected_delivery_date: string | null;
  parts_requested: { display_name_ru: string; quantity: number }[];
  parts_freeform: { description: string }[];
  machine: { model_code: string } | null;
  company: { name: string } | null;
  requester: { full_name: string | null } | null;
  requested_by: string | null;
}

const URGENCY_ICON: Record<
  PartsRequestUrgency,
  React.ComponentType<{ className?: string }> | null
> = {
  normal: null,
  urgent: AlertCircle,
  critical: AlertTriangle,
};

function sortByUrgencyAndDate(a: PartsRequestRow, b: PartsRequestRow): number {
  const order: PartsRequestUrgency[] = ['critical', 'urgent', 'normal'];
  const ua = order.indexOf(a.urgency);
  const ub = order.indexOf(b.urgency);
  if (ua !== ub) return ua - ub;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export default function PartsPage() {
  const t = useTranslations('parts');
  const router = useRouter();
  const { user } = useGlobal();
  const { isOperator, isServiceEngineer, isProjectManager } = useRole();

  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [requests, setRequests] = useState<PartsRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'zero'>('all');

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Inventory tab is for everyone except platform_admin (НПГМ doesn't manage
  // the customer's stock from this surface).
  const showInventory = true;

  const reload = async () => {
    setLoading(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single();
      const cid = (profile as { company_id: string | null } | null)?.company_id;
      setCompanyId(cid ?? null);

      const inventoryPromise = showInventory
        ? supabase
            .from('parts_inventory')
            .select(
              'id, quantity, reorder_threshold, last_replenished_at, machine:machines(id, model_code), part:parts_catalog(id, display_name_ru, application_ru, category, unit, compatible_machine_types)'
            )
            .order('updated_at', { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const catalogPromise = showInventory
        ? supabase
            .from('parts_catalog')
            .select('id, display_name_ru, application_ru, category, unit, compatible_machine_types')
            .order('display_name_ru')
        : Promise.resolve({ data: [], error: null });

      let reqQuery = supabase
        .from('parts_requests')
        .select(
          [
            'id, kind, parent_id, status, urgency, created_at, expected_delivery_date,',
            'parts_requested, parts_freeform, requested_by,',
            'machine:machines(model_code),',
            'company:companies(name),',
            'requester:profiles!parts_requests_requested_by_fkey(full_name)',
          ].join(' ')
        )
        .order('created_at', { ascending: false })
        .limit(150);

      // Operators see only their own operator-rows + the consolidated rows
      // their requests have been folded into.
      if (isOperator) {
        reqQuery = reqQuery.eq('requested_by', user!.id);
      }

      const [invResp, catResp, reqResp] = await Promise.all([
        inventoryPromise,
        catalogPromise,
        reqQuery,
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((invResp as any).error) throw (invResp as any).error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((catResp as any).error) throw (catResp as any).error;
      if (reqResp.error) throw reqResp.error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInventory(((invResp as any).data ?? []) as InventoryRow[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCatalog(((catResp as any).data ?? []) as CatalogRow[]);
      setRequests((reqResp.data ?? []) as unknown as PartsRequestRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOperator, isServiceEngineer, isProjectManager]);

  const filtered = useMemo(() => {
    return inventory.filter((row) => {
      if (categoryFilter !== 'all' && row.part.category !== categoryFilter) return false;
      if (stockFilter === 'zero' && row.quantity !== 0) return false;
      if (stockFilter === 'low') {
        const threshold = row.reorder_threshold;
        if (threshold === null || row.quantity >= threshold) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        const inName = row.part.display_name_ru.toLowerCase().includes(q);
        const inApp = row.part.application_ru?.toLowerCase().includes(q) ?? false;
        const inMachine = row.machine?.model_code.toLowerCase().includes(q) ?? false;
        if (!(inName || inApp || inMachine)) return false;
      }
      return true;
    });
  }, [inventory, query, categoryFilter, stockFilter]);

  const summary = useMemo(() => {
    const total = inventory.length;
    const zero = inventory.filter((r) => r.quantity === 0).length;
    const low = inventory.filter(
      (r) => r.reorder_threshold !== null && r.quantity > 0 && r.quantity < r.reorder_threshold
    ).length;
    return { total, zero, low, ok: total - zero - low };
  }, [inventory]);

  // Bucket logic depends on the role. We compute every bucket once and the
  // render path shows just the ones relevant for the current role.
  const buckets = useMemo(() => {
    const operatorIncoming = requests
      .filter((r) => r.kind === 'operator' && r.status === 'submitted')
      .sort(sortByUrgencyAndDate);

    // service_engineer: consolidated rows they're driving (drafting → ordered)
    // We don't restrict to "mine" because consolidated belongs to whoever
    // service_engineer creates it as; show all in-company.
    const consolidatedActive = requests
      .filter(
        (r) =>
          r.kind === 'consolidated' &&
          ['drafting', 'pending_pm', 'forwarded', 'quoted', 'approved', 'ordered'].includes(r.status)
      )
      .sort(sortByUrgencyAndDate);

    const pendingPm = consolidatedActive.filter((r) => r.status === 'pending_pm');
    const quoted = consolidatedActive.filter((r) => r.status === 'quoted');
    const inFlight = consolidatedActive.filter(
      (r) => r.status === 'forwarded' || r.status === 'approved' || r.status === 'ordered'
    );
    const drafting = consolidatedActive.filter((r) => r.status === 'drafting');

    const myOperatorActive = requests
      .filter(
        (r) =>
          r.kind === 'operator' &&
          (r.status === 'submitted' || r.status === 'consolidated') &&
          r.requested_by === user?.id
      )
      .sort(sortByUrgencyAndDate);

    const history = requests
      .filter((r) => isFinalStatus(r.status) || r.status === 'consolidated')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      operatorIncoming,
      drafting,
      pendingPm,
      quoted,
      inFlight,
      consolidatedActive,
      myOperatorActive,
      history,
    };
  }, [requests, user?.id]);

  // Operator rows the picker can pick from — needs the richer shape.
  const pickerRows: OperatorRow[] = useMemo(() => {
    return buckets.operatorIncoming.map((r) => ({
      id: r.id,
      urgency: r.urgency,
      machine: r.machine,
      parts_requested: r.parts_requested,
      parts_freeform: r.parts_freeform,
      created_at: r.created_at,
      requester: r.requester,
    }));
  }, [buckets.operatorIncoming]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">{t('title')}</h1>
          <p className="text-secondary-600 text-sm mt-1">
            {isOperator
              ? t('subtitle_operator')
              : isServiceEngineer
              ? t('subtitle_service')
              : t('subtitle_pm')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isOperator && (
            <Button asChild>
              <Link href="/app/parts/request">
                <ShoppingCart className="w-4 h-4" />
                {t('create_request')}
              </Link>
            </Button>
          )}
          {isServiceEngineer && (
            <Button onClick={() => setPickerOpen(true)}>
              <Layers className="w-4 h-4" />
              {t('create_consolidated')}
            </Button>
          )}
          {isProjectManager && (
            <>
              <Button asChild variant="outline">
                <Link href="/app/parts/import">
                  <FileSpreadsheet className="w-4 h-4" />
                  {t('import_from_file')}
                </Link>
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                {t('add_stock')}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Card className="p-4 border-accent-300 bg-accent-50/30">
          <p className="text-sm text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {/* ============== Service engineer view ============== */}
      {isServiceEngineer && (
        <>
          <RequestSection
            title={t('incoming_from_operators', { n: buckets.operatorIncoming.length })}
            subtitle={t('incoming_desc')}
            icon={Inbox}
            items={buckets.operatorIncoming}
            accent="amber"
          />
          <RequestSection
            title={t('my_consolidated_active', { n: buckets.consolidatedActive.length })}
            subtitle={t('my_consolidated_desc')}
            icon={ListChecks}
            items={buckets.consolidatedActive}
          />
        </>
      )}

      {/* ============== Project manager view ============== */}
      {isProjectManager && (
        <>
          <RequestSection
            title={t('pending_scope', { n: buckets.pendingPm.length })}
            subtitle={t('pending_scope_desc')}
            icon={Inbox}
            items={buckets.pendingPm}
            accent="amber"
          />
          <RequestSection
            title={t('quoted_section', { n: buckets.quoted.length })}
            subtitle={t('quoted_desc')}
            icon={ListChecks}
            items={buckets.quoted}
            accent="amber"
          />
          <RequestSection
            title={t('in_flight', { n: buckets.inFlight.length })}
            subtitle={t('in_flight_desc')}
            icon={ListChecks}
            items={buckets.inFlight}
          />
          {buckets.drafting.length > 0 && (
            <RequestSection
              title={t('drafting_section', { n: buckets.drafting.length })}
              subtitle={t('drafting_desc')}
              icon={Clock}
              items={buckets.drafting}
              muted
            />
          )}
        </>
      )}

      {/* ============== Operator view ============== */}
      {isOperator && (
        <>
          {buckets.myOperatorActive.length > 0 && (
            <RequestSection
              title={t('my_active')}
              subtitle={t('my_active_desc')}
              icon={ListChecks}
              items={buckets.myOperatorActive}
            />
          )}
          {!loading && buckets.myOperatorActive.length === 0 && (
            <Card className="p-10 text-center">
              <ShoppingCart className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
              <p className="text-sm text-secondary-600">
                {t('no_requests')}
              </p>
            </Card>
          )}
        </>
      )}

      {/* ============== History (everyone) ============== */}
      {buckets.history.length > 0 && (
        <RequestSection
          title={t('history', { n: buckets.history.length })}
          subtitle={t('history_desc')}
          icon={Clock}
          items={buckets.history.slice(0, 30)}
          muted
        />
      )}

      {/* ============== Inventory (operator + service + PM) ============== */}
      {showInventory && (
        <>
          {!loading && inventory.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label={t('summary_total')} value={summary.total} icon={Package} accent="primary" />
              <SummaryCard label={t('summary_ok')} value={summary.ok} icon={Box} accent="success" />
              <SummaryCard label={t('summary_low')} value={summary.low} icon={Box} accent="warning" />
              <SummaryCard label={t('summary_zero')} value={summary.zero} icon={Box} accent="destructive" />
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <Input
                placeholder={t('search_placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
              className="max-w-[200px]"
            >
              <option value="all">{t('all_categories')}</option>
              {(Object.keys(CATEGORY_LABELS) as PartCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c].ru}
                </option>
              ))}
            </Select>
            <Select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
              className="max-w-[200px]"
            >
              <option value="all">{t('all_stock')}</option>
              <option value="low">{t('only_low')}</option>
              <option value="zero">{t('only_zero')}</option>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-secondary-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t('loading_garage')}
            </div>
          ) : inventory.length === 0 ? (
            <EmptyState canAdd={isProjectManager} onAdd={() => setAddDialogOpen(true)} />
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-secondary-600 text-sm">{t('no_filter_match')}</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary-50 border-b border-secondary-200">
                    <tr className="text-left text-secondary-600 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 font-semibold">{t('col_part')}</th>
                      <th className="px-4 py-3 font-semibold">{t('col_category')}</th>
                      <th className="px-4 py-3 font-semibold">{t('col_application')}</th>
                      <th className="px-4 py-3 font-semibold">{t('col_assignment')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('col_quantity')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100">
                    {filtered.map((row) => (
                      <tr key={row.id} className="hover:bg-secondary-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-secondary-900">{row.part.display_name_ru}</p>
                          <p className="text-xs text-secondary-500 mt-0.5">
                            {t('for_machines', { types: row.part.compatible_machine_types.join(', ') || '—' })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <PartCategoryBadge category={row.part.category} />
                        </td>
                        <td className="px-4 py-3 text-secondary-700 text-xs max-w-xs">
                          {row.part.application_ru ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-secondary-600 text-xs">
                          {row.machine ? (
                            <span title={t('reserve_for', { model: row.machine.model_code })}>
                              🔧 {row.machine.model_code}
                            </span>
                          ) : (
                            <span className="text-secondary-400 italic">{t('common_stock')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <StockBadge
                            quantity={row.quantity}
                            threshold={row.reorder_threshold}
                            unit={row.part.unit}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {addDialogOpen && companyId && (
        <AddStockDialog
          companyId={companyId}
          catalog={catalog}
          existingInventoryPartIds={new Set(inventory.map((i) => i.part.id))}
          onClose={() => setAddDialogOpen(false)}
          onSaved={() => {
            setAddDialogOpen(false);
            reload();
          }}
        />
      )}

      {/* Consolidation picker for service_engineer */}
      <ConsolidationPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        operatorRows={pickerRows}
        onConsolidated={(consolidatedId) => {
          setPickerOpen(false);
          router.push(`/app/parts/request/${consolidatedId}`);
        }}
        onError={(msg) => setError(msg)}
      />
    </div>
  );
}

// =================== Helpers ===================

function RequestSection({
  title,
  subtitle,
  icon: Icon,
  items,
  accent,
  muted = false,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  items: PartsRequestRow[];
  accent?: 'amber';
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  const headerTone =
    accent === 'amber'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-secondary-700 bg-secondary-50 border-secondary-200';
  return (
    <section className={muted ? 'opacity-90' : ''}>
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border ${headerTone} mb-2`}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <h2 className="text-[11px] uppercase tracking-wider font-bold">{title}</h2>
        </div>
      </div>
      {subtitle && <p className="text-xs text-secondary-500 px-3 mb-2">{subtitle}</p>}
      <div className="space-y-2">
        {items.map((r) => (
          <RequestRowCard key={r.id} request={r} />
        ))}
      </div>
    </section>
  );
}

function RequestRowCard({ request: r }: { request: PartsRequestRow }) {
  const t = useTranslations('parts');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'ru-RU';
  const UIcon = URGENCY_ICON[r.urgency];
  const itemsCount = r.parts_requested.length + r.parts_freeform.length;
  const isConsolidated = r.kind === 'consolidated';
  const urgencyLabel =
    r.urgency === 'critical'
      ? t('urgency_critical')
      : r.urgency === 'urgent'
      ? t('urgency_urgent')
      : t('urgency_normal');
  const itemsLabel =
    itemsCount === 1
      ? t('items_count_one', { n: itemsCount })
      : itemsCount < 5
      ? t('items_count_few', { n: itemsCount })
      : t('items_count_many', { n: itemsCount });
  return (
    <Link
      href={`/app/parts/request/${r.id}`}
      className="block p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <RequestStatusBadge status={r.status} />
          {isConsolidated && (
            <Badge variant="default">
              <Layers className="w-3 h-3 inline mr-1" />
              {t('consolidated_badge')}
            </Badge>
          )}
          {r.urgency !== 'normal' && (
            <Badge variant={r.urgency === 'critical' ? 'destructive' : 'warning'}>
              {UIcon && <UIcon className="w-3 h-3 inline mr-1" />}
              {urgencyLabel}
            </Badge>
          )}
          <span className="text-sm text-secondary-900 truncate">
            {itemsLabel}
            {r.machine && (
              <>
                {' · '}
                <span className="font-medium">{r.machine.model_code}</span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {r.expected_delivery_date && (
            <span className="text-xs text-secondary-500" title={t('eta_label')}>
              {t('list.eta_prefix')}{' '}
              {new Date(r.expected_delivery_date).toLocaleDateString(dateLocale, {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          )}
          <span className="text-xs text-secondary-500">
            {new Date(r.created_at).toLocaleDateString(dateLocale, {
              day: '2-digit',
              month: 'short',
            })}
          </span>
          <ChevronRight className="w-4 h-4 text-secondary-300" />
        </div>
      </div>
    </Link>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    destructive: 'bg-accent-50 text-accent-700',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-secondary-500 font-medium">{label}</p>
          <p className="font-heading text-2xl font-bold text-secondary-900 tabular-nums">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ canAdd, onAdd }: { canAdd: boolean; onAdd: () => void }) {
  const t = useTranslations('parts');
  return (
    <Card className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 mb-4">
        <Wrench className="w-6 h-6" />
      </div>
      <h3 className="font-heading font-semibold text-secondary-900 mb-2">{t('empty_title')}</h3>
      <p className="text-secondary-600 text-sm max-w-md mx-auto mb-6">
        {canAdd ? t('empty_can_add_desc') : t('empty_no_access_desc')}
      </p>
      {canAdd && (
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4" />
          {t('add_part')}
        </Button>
      )}
    </Card>
  );
}
