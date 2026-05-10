'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import {
  RequestStatusBadge,
  ACTIVE_REQUEST_STATUSES,
  isFinalStatus,
} from '@/components/parts/RequestStatusBadge';
import type { PartCategory, PartsRequestStatus, PartsRequestUrgency } from '@/lib/types';

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
  status: PartsRequestStatus;
  urgency: PartsRequestUrgency;
  created_at: string;
  expected_delivery_date: string | null;
  parts_requested: { display_name_ru: string }[];
  parts_freeform: { description: string }[];
  machine: { model_code: string } | null;
  company: { name: string } | null;
  requester: { full_name: string | null } | null;
}

const URGENCY_INFO: Record<
  PartsRequestUrgency,
  { ru: string; icon: React.ComponentType<{ className?: string }> | null }
> = {
  normal: { ru: 'Обычная', icon: null },
  urgent: { ru: 'Срочная', icon: AlertCircle },
  critical: { ru: 'Критическая', icon: AlertTriangle },
};

// Sort: critical → urgent → normal, then newest first.
function sortByUrgencyAndDate(a: PartsRequestRow, b: PartsRequestRow): number {
  const order: PartsRequestUrgency[] = ['critical', 'urgent', 'normal'];
  const ua = order.indexOf(a.urgency);
  const ub = order.indexOf(b.urgency);
  if (ua !== ub) return ua - ub;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export default function PartsPage() {
  const { user } = useGlobal();
  const { isOperator, isProjectManager, isTier2 } = useRole();

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

  // Tier 2 doesn't have a "company garage" view — they only see the request queue.
  const showInventory = !isTier2;

  const reload = async () => {
    setLoading(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      // Profile -> company_id (used for AddStockDialog / RLS hint).
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single();
      const cid = (profile as { company_id: string | null } | null)?.company_id;
      setCompanyId(cid ?? null);

      // Inventory + catalog only for non-Tier2.
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

      // Requests query — RLS already restricts what each role can see; we just
      // ask for "everything visible" and split into sections client-side.
      // Operator: also restrict to "my requests" via requested_by filter.
      let reqQuery = supabase
        .from('parts_requests')
        .select(
          [
            'id, status, urgency, created_at, expected_delivery_date,',
            'parts_requested, parts_freeform,',
            'machine:machines(model_code),',
            'company:companies(name),',
            'requester:profiles!parts_requests_requested_by_fkey(full_name)',
          ].join(' ')
        )
        .order('created_at', { ascending: false })
        .limit(100);

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
      setError(err instanceof Error ? err.message : 'Не удалось загрузить гараж');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOperator, isTier2, isProjectManager]);

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

  // Bucket requests for the section views.
  const buckets = useMemo(() => {
    const pendingAdminReview = requests
      .filter((r) => r.status === 'submitted' || r.status === 'new')
      .sort(sortByUrgencyAndDate);
    const inProgress = requests
      .filter((r) =>
        ACTIVE_REQUEST_STATUSES.includes(r.status) && r.status !== 'submitted'
      )
      .sort(sortByUrgencyAndDate);
    const tier2Queue = requests
      .filter((r) => ['forwarded', 'quoted', 'approved', 'ordered'].includes(r.status))
      .sort(sortByUrgencyAndDate);
    const history = requests
      .filter((r) => isFinalStatus(r.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { pendingAdminReview, inProgress, tier2Queue, history };
  }, [requests]);

  // Tier 2 (НПГМ техподдержка) — не работает с заявками. Очередь ценообразования
  // и закупки живёт у platform_admin: /admin/queue/parts (фаза B4).
  if (isTier2) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <p className="text-secondary-700 mb-2">
            Заявки на запчасти не входят в зону Tier 2 — это очередь
            <strong> platform_admin</strong>.
          </p>
          <p className="text-sm text-secondary-500">
            Если у вас доступ <code>platform_admin</code> — перейдите в{' '}
            <code>/admin/queue/parts</code>.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
            Гараж
          </h1>
          <p className="text-secondary-600 text-sm mt-1">
            {isTier2
              ? 'Очередь заявок от компаний-клиентов. На каждой — нужная реакция: КП, заказ, подтверждение.'
              : isOperator
              ? 'Ваши заявки на запчасти и склад компании.'
              : 'Склад запчастей компании + очередь заявок (от операторов, в работе у НПГМ).'}
          </p>
        </div>
        {!isTier2 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline">
              <Link href="/app/parts/request">
                <ShoppingCart className="w-4 h-4" />
                {isOperator ? 'Создать заявку' : 'Заказать запчасти'}
              </Link>
            </Button>
            {isProjectManager && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                Добавить на склад
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <Card className="p-4 border-accent-300 bg-accent-50/30">
          <p className="text-sm text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {/* === Section 1 (admin only): На рассмотрении === */}
      {isProjectManager && buckets.pendingAdminReview.length > 0 && (
        <RequestSection
          title="На рассмотрении"
          subtitle="Заявки операторов ждут вашего решения."
          icon={Inbox}
          items={buckets.pendingAdminReview}
          showCompany={false}
          accent="amber"
        />
      )}

      {/* === Section 2 (admin): В работе === */}
      {isProjectManager && buckets.inProgress.length > 0 && (
        <RequestSection
          title="В работе"
          subtitle="Переслали в НПГМ — следим за статусом."
          icon={ListChecks}
          items={buckets.inProgress}
          showCompany={false}
        />
      )}

      {/* === Section (operator): Мои заявки === */}
      {isOperator && requests.filter((r) => !isFinalStatus(r.status)).length > 0 && (
        <RequestSection
          title="Мои активные заявки"
          subtitle="После создания заявка идёт руководителю сервисной службы вашей компании."
          icon={ListChecks}
          items={requests.filter((r) => !isFinalStatus(r.status)).sort(sortByUrgencyAndDate)}
          showCompany={false}
        />
      )}

      {/* === Section (tier2): Очередь Tier 2 === */}
      {isTier2 && buckets.tier2Queue.length > 0 && (
        <RequestSection
          title={`Очередь НПГМ — ${buckets.tier2Queue.length}`}
          subtitle="Заявки от всех компаний, которые ждут вашей реакции."
          icon={Inbox}
          items={buckets.tier2Queue}
          showCompany={true}
          accent="amber"
        />
      )}

      {/* === History (всем) === */}
      {buckets.history.length > 0 && (
        <RequestSection
          title="История"
          subtitle="Завершённые и отменённые заявки."
          icon={Clock}
          items={buckets.history.slice(0, 20)}
          showCompany={isTier2}
          muted
        />
      )}

      {/* === Empty state for queues === */}
      {!loading &&
        requests.length === 0 &&
        (isOperator || isTier2) && (
          <Card className="p-10 text-center">
            <ShoppingCart className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
            <p className="text-sm text-secondary-600">
              {isTier2
                ? 'Очередь пустая — ни одна компания пока не отправляла заявок.'
                : 'У вас ещё нет заявок. Создайте первую — она уйдёт руководителю сервисной службы.'}
            </p>
          </Card>
        )}

      {/* === Inventory (admin / operator) === */}
      {showInventory && (
        <>
          {!loading && inventory.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="Всего позиций" value={summary.total} icon={Package} accent="primary" />
              <SummaryCard label="В норме" value={summary.ok} icon={Box} accent="success" />
              <SummaryCard label="Мало" value={summary.low} icon={Box} accent="warning" />
              <SummaryCard label="Нет в наличии" value={summary.zero} icon={Box} accent="destructive" />
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <Input
                placeholder="Поиск по названию, применению, машине…"
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
              <option value="all">Все категории</option>
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
              <option value="all">Все остатки</option>
              <option value="low">Только мало</option>
              <option value="zero">Только нет в наличии</option>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-secondary-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Загружаем гараж…
            </div>
          ) : inventory.length === 0 ? (
            <EmptyState canAdd={isProjectManager} onAdd={() => setAddDialogOpen(true)} />
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-secondary-600 text-sm">Нет позиций под текущий фильтр</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary-50 border-b border-secondary-200">
                    <tr className="text-left text-secondary-600 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 font-semibold">Запчасть</th>
                      <th className="px-4 py-3 font-semibold">Категория</th>
                      <th className="px-4 py-3 font-semibold">Применение</th>
                      <th className="px-4 py-3 font-semibold">Привязка</th>
                      <th className="px-4 py-3 font-semibold text-right">Остаток</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100">
                    {filtered.map((row) => (
                      <tr key={row.id} className="hover:bg-secondary-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-secondary-900">{row.part.display_name_ru}</p>
                          <p className="text-xs text-secondary-500 mt-0.5">
                            для: {row.part.compatible_machine_types.join(', ') || '—'}
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
                            <span title={`Резерв на ${row.machine.model_code}`}>
                              🔧 {row.machine.model_code}
                            </span>
                          ) : (
                            <span className="text-secondary-400 italic">общий склад</span>
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
    </div>
  );
}

// =================== Helpers ===================

function RequestSection({
  title,
  subtitle,
  icon: Icon,
  items,
  showCompany,
  accent,
  muted = false,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  items: PartsRequestRow[];
  showCompany: boolean;
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
        <span className="text-xs text-secondary-500">{items.length}</span>
      </div>
      {subtitle && <p className="text-xs text-secondary-500 px-3 mb-2">{subtitle}</p>}
      <div className="space-y-2">
        {items.map((r) => (
          <RequestRowCard key={r.id} request={r} showCompany={showCompany} />
        ))}
      </div>
    </section>
  );
}

function RequestRowCard({
  request: r,
  showCompany,
}: {
  request: PartsRequestRow;
  showCompany: boolean;
}) {
  const UIcon = URGENCY_INFO[r.urgency].icon;
  const itemsCount = r.parts_requested.length + r.parts_freeform.length;
  return (
    <Link
      href={`/app/parts/request/${r.id}`}
      className="block p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <RequestStatusBadge status={r.status} />
          {r.urgency !== 'normal' && (
            <Badge variant={r.urgency === 'critical' ? 'destructive' : 'warning'}>
              {UIcon && <UIcon className="w-3 h-3 inline mr-1" />}
              {URGENCY_INFO[r.urgency].ru}
            </Badge>
          )}
          {showCompany && r.company?.name && (
            <Badge variant="outline">{r.company.name}</Badge>
          )}
          <span className="text-sm text-secondary-900 truncate">
            {itemsCount} {itemsCount === 1 ? 'позиция' : itemsCount < 5 ? 'позиции' : 'позиций'}
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
            <span className="text-xs text-secondary-500" title="Ожидаемая поставка">
              ETA{' '}
              {new Date(r.expected_delivery_date).toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          )}
          <span className="text-xs text-secondary-500">
            {new Date(r.created_at).toLocaleDateString('ru-RU', {
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
  return (
    <Card className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 mb-4">
        <Wrench className="w-6 h-6" />
      </div>
      <h3 className="font-heading font-semibold text-secondary-900 mb-2">Гараж пуст</h3>
      <p className="text-secondary-600 text-sm max-w-md mx-auto mb-6">
        {canAdd
          ? 'Добавьте первую запчасть со склада. Можно указать привязку к конкретной машине или хранить общим резервом.'
          : 'Здесь появятся запчасти после того, как руководитель сервисной службы пополнит склад.'}
      </p>
      {canAdd && (
        <Button onClick={onAdd}>
          <Plus className="w-4 h-4" />
          Добавить запчасть
        </Button>
      )}
    </Card>
  );
}
