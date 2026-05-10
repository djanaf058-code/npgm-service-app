'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ChevronRight,
  Truck,
  MessageSquareText,
  ShoppingCart,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { createSPASassClient } from '@/lib/supabase/client';

interface CompanyRow {
  id: string;
  name: string;
  country: string;
  updated_at: string;
}

interface Row extends CompanyRow {
  machines_count: number;
  open_tickets: number;
  active_parts_requests: number;
}

export default function AdminCompaniesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await createSPASassClient();
        const sb = c.getSupabaseClient();

        const { data: companies, error: cErr } = await sb
          .from('companies')
          .select('id, name, country, updated_at')
          .order('name');
        if (cErr) throw cErr;

        // Per-company counts in parallel.
        const enriched: Row[] = await Promise.all(
          ((companies ?? []) as CompanyRow[]).map(async (c) => {
            const [m, t, p] = await Promise.all([
              sb
                .from('machines')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', c.id),
              sb
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', c.id)
                .neq('status', 'resolved')
                .neq('status', 'closed_self'),
              sb
                .from('parts_requests')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', c.id)
                .eq('kind', 'consolidated')
                .in('status', ['forwarded', 'quoted', 'approved', 'ordered']),
            ]);
            return {
              ...c,
              machines_count: m.count ?? 0,
              open_tickets: t.count ?? 0,
              active_parts_requests: p.count ?? 0,
            };
          })
        );
        if (!cancelled) setRows(enriched);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          Все компании
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          Клиенты платформы. Кликните на карточку — увидите машины, тикеты, заявки.
        </p>
      </div>

      {error && (
        <Card className="p-4 border-accent-300 bg-accent-50/30 mb-4">
          <p className="text-sm text-accent-700 whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center text-secondary-500 py-10">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Загружаем компании…
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Building2 className="w-8 h-8 text-secondary-400 mx-auto mb-3" />
          <p className="text-sm text-secondary-600">
            Пока нет ни одной зарегистрированной компании.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/admin/companies/${r.id}`}
              className="block bg-white border border-secondary-200 rounded-xl p-4 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Building2 className="w-5 h-5 text-primary-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-secondary-900 truncate">{r.name}</p>
                    <p className="text-xs text-secondary-500">{r.country || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs text-secondary-600">
                  <span title="Машин в парке">
                    <Truck className="w-3 h-3 inline mr-1" />
                    {r.machines_count}
                  </span>
                  <span title="Открытых тикетов">
                    <MessageSquareText className="w-3 h-3 inline mr-1" />
                    {r.open_tickets}
                  </span>
                  <span title="Активных заявок (forwarded/quoted/approved/ordered)">
                    <ShoppingCart className="w-3 h-3 inline mr-1" />
                    {r.active_parts_requests}
                  </span>
                  <ChevronRight className="w-4 h-4 text-secondary-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
