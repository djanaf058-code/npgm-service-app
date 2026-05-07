'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Wrench, Loader2, Search, Package, Box, ShoppingCart, ChevronRight, AlertTriangle, AlertCircle } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PartCategoryBadge, CATEGORY_LABELS } from '@/components/parts/PartCategoryBadge';
import { StockBadge } from '@/components/parts/StockBadge';
import { AddStockDialog } from '@/components/parts/AddStockDialog';
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
  parts_requested: { display_name_ru: string }[];
  parts_freeform: { description: string }[];
  machine: { model_code: string } | null;
}

const REQUEST_STATUS_LABELS: Record<PartsRequestStatus, { ru: string; variant: React.ComponentProps<typeof Badge>['variant'] }> = {
  new: { ru: 'Новая', variant: 'destructive' },
  approved: { ru: 'Согласована', variant: 'warning' },
  ordered: { ru: 'Заказано', variant: 'default' },
  delivered: { ru: 'Получено', variant: 'success' },
  cancelled: { ru: 'Отменена', variant: 'secondary' },
};

const URGENCY_INFO: Record<PartsRequestUrgency, { ru: string; icon: React.ComponentType<{ className?: string }> | null }> = {
  normal: { ru: 'Обычная', icon: null },
  urgent: { ru: 'Срочная', icon: AlertCircle },
  critical: { ru: 'Критическая', icon: AlertTriangle },
};

export default function PartsPage() {
  const { user } = useGlobal();
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
      if (!cid) throw new Error('Профиль не привязан к компании');
      setCompanyId(cid);

      const [invResp, catResp, reqResp] = await Promise.all([
        supabase
          .from('parts_inventory')
          .select(
            'id, quantity, reorder_threshold, last_replenished_at, machine:machines(id, model_code), part:parts_catalog(id, display_name_ru, application_ru, category, unit, compatible_machine_types)'
          )
          .order('updated_at', { ascending: false }),
        supabase
          .from('parts_catalog')
          .select('id, display_name_ru, application_ru, category, unit, compatible_machine_types')
          .order('display_name_ru'),
        supabase
          .from('parts_requests')
          .select(
            'id, status, urgency, created_at, parts_requested, parts_freeform, machine:machines(model_code)'
          )
          .neq('status', 'delivered')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (invResp.error) throw invResp.error;
      if (catResp.error) throw catResp.error;
      if (reqResp.error) throw reqResp.error;

      setInventory((invResp.data ?? []) as unknown as InventoryRow[]);
      setCatalog((catResp.data ?? []) as unknown as CatalogRow[]);
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
  }, [user]);

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

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">Гараж</h1>
          <p className="text-secondary-600 text-sm mt-1">
            Склад запчастей компании. Цвет показывает остаток: 🔴 нет, 🟡 ниже порога, ✓ ок.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline">
            <Link href="/app/parts/request">
              <ShoppingCart className="w-4 h-4" />
              Заказать запчасти
            </Link>
          </Button>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Добавить на склад
          </Button>
        </div>
      </div>

      {/* Active parts requests */}
      {requests.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-secondary-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Активные заявки на закупку
              <Badge variant="outline">{requests.length}</Badge>
            </h2>
          </div>
          <div className="space-y-2">
            {requests.map((r) => {
              const UIcon = URGENCY_INFO[r.urgency].icon;
              const itemsCount = r.parts_requested.length + r.parts_freeform.length;
              return (
                <Link
                  key={r.id}
                  href={`/app/parts/request/${r.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={REQUEST_STATUS_LABELS[r.status].variant}>
                      {REQUEST_STATUS_LABELS[r.status].ru}
                    </Badge>
                    {r.urgency !== 'normal' && (
                      <Badge variant={r.urgency === 'critical' ? 'destructive' : 'warning'}>
                        {UIcon && <UIcon className="w-3 h-3 inline mr-1" />}
                        {URGENCY_INFO[r.urgency].ru}
                      </Badge>
                    )}
                    <span className="text-sm text-secondary-900 truncate">
                      {itemsCount} {itemsCount === 1 ? 'позиция' : itemsCount < 5 ? 'позиции' : 'позиций'}
                      {r.machine && (
                        <> · <span className="font-medium">{r.machine.model_code}</span></>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-secondary-500">
                      {new Date(r.created_at).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <ChevronRight className="w-4 h-4 text-secondary-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* Summary cards */}
      {!loading && inventory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Всего позиций" value={summary.total} icon={Package} accent="primary" />
          <SummaryCard label="В норме" value={summary.ok} icon={Box} accent="success" />
          <SummaryCard label="Мало" value={summary.low} icon={Box} accent="warning" />
          <SummaryCard label="Нет в наличии" value={summary.zero} icon={Box} accent="destructive" />
        </div>
      )}

      {/* Filters */}
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

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-secondary-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Загружаем гараж…
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <p className="text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      ) : inventory.length === 0 ? (
        <EmptyState onAdd={() => setAddDialogOpen(true)} />
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

      {/* Add stock dialog */}
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 mb-4">
        <Wrench className="w-6 h-6" />
      </div>
      <h3 className="font-heading font-semibold text-secondary-900 mb-2">Гараж пуст</h3>
      <p className="text-secondary-600 text-sm max-w-md mx-auto mb-6">
        Добавьте первую запчасть со склада. Можно указать привязку к конкретной машине
        или хранить общим резервом для всей компании.
      </p>
      <Button onClick={onAdd}>
        <Plus className="w-4 h-4" />
        Добавить запчасть
      </Button>
    </Card>
  );
}
