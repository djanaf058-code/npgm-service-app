'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Truck, Loader2, Search } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MachineTypeBadge } from '@/components/machines/MachineTypeBadge';
import { MachineStatusBadge } from '@/components/machines/MachineStatusBadge';

interface MachineRow {
  id: string;
  machine_type: string;
  model_code: string;
  tonnage_t: number;
  serial_number: string | null;
  pit_location: string | null;
  engine_hours: number;
  tons_pumped: number;
  status: string;
  created_at: string;
}

export default function MachinesListPage() {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { data, error } = await supabase
          .from('machines')
          .select(
            'id, machine_type, model_code, tonnage_t, serial_number, pit_location, engine_hours, tons_pumped, status, created_at'
          )
          .order('created_at', { ascending: false });
        if (error) throw error;
        setMachines((data ?? []) as MachineRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить список машин');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = machines.filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      m.model_code.toLowerCase().includes(q) ||
      m.serial_number?.toLowerCase().includes(q) ||
      m.pit_location?.toLowerCase().includes(q) ||
      m.machine_type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
            Парк техники
          </h1>
          <p className="text-secondary-600 text-sm mt-1">
            Карточки СЗМ и буровых станков с двойной наработкой (моточасы + тонны прокачки)
          </p>
        </div>
        <Button asChild>
          <Link href="/app/machines/new">
            <Plus className="w-4 h-4" />
            Добавить машину
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
        <Input
          placeholder="Поиск по модели, серийнику, карьеру…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-secondary-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Загружаем парк…
        </div>
      ) : error ? (
        <Card className="p-6 text-center">
          <p className="text-accent-700">{error}</p>
        </Card>
      ) : machines.length === 0 ? (
        <EmptyState />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 border-b border-secondary-200">
                <tr className="text-left text-secondary-600 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Модель</th>
                  <th className="px-4 py-3 font-semibold">Тип</th>
                  <th className="px-4 py-3 font-semibold">Серийник</th>
                  <th className="px-4 py-3 font-semibold">Карьер</th>
                  <th className="px-4 py-3 font-semibold text-right">Моточасы</th>
                  <th className="px-4 py-3 font-semibold text-right">Тонн</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-secondary-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-secondary-900">
                      <Link
                        href={`/app/machines/${m.id}`}
                        className="hover:text-primary-700 hover:underline"
                      >
                        {m.model_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <MachineTypeBadge type={m.machine_type} />
                    </td>
                    <td className="px-4 py-3 text-secondary-600 font-mono text-xs">
                      {m.serial_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-secondary-700">{m.pit_location ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary-700">
                      {Number(m.engine_hours).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary-700">
                      {Number(m.tons_pumped).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      <MachineStatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && machines.length > 0 && (
              <div className="text-center py-8 text-secondary-500 text-sm">
                Ничего не найдено по запросу «{query}»
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 mb-4">
        <Truck className="w-6 h-6" />
      </div>
      <h3 className="font-heading font-semibold text-secondary-900 mb-2">Парк пока пуст</h3>
      <p className="text-secondary-600 text-sm max-w-md mx-auto mb-6">
        Добавьте первую машину — типы НИПИГОРМАШа (МЗВ, МСЗ, МСЗУ, МЗУ),
        тоннаж, серийник, карьер где она работает.
      </p>
      <Button asChild>
        <Link href="/app/machines/new">
          <Plus className="w-4 h-4" />
          Добавить машину
        </Link>
      </Button>
    </Card>
  );
}
