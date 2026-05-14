'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, UserMinus, Users } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useRole } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface AssignedOperator {
  operator_id: string;
  assigned_at: string;
  profile: {
    id: string;
    full_name: string | null;
  } | null;
}

interface AvailableOperator {
  id: string;
  full_name: string | null;
}

// Renders the operator-assignment surface on the machine detail page. SE/PM
// can add or remove operators; everyone else gets a read-only roster. Drives
// data scoping for the operator role — once Phase 2 RLS is in place, an
// operator only sees a machine if their id is in this list.
export function MachineOperatorsSection({
  machineId,
  companyId,
}: {
  machineId: string;
  companyId: string;
}) {
  const { canAssignOperators } = useRole();
  const [assigned, setAssigned] = useState<AssignedOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();
      const { data, error: err } = await sb
        .from('machine_assignments')
        .select('operator_id, assigned_at, profile:profiles!machine_assignments_operator_id_fkey(id, full_name)')
        .eq('machine_id', machineId)
        .is('unassigned_at', null)
        .order('assigned_at', { ascending: true });
      if (err) throw err;
      setAssigned((data ?? []) as unknown as AssignedOperator[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId]);

  const unassign = async (operatorId: string) => {
    if (!confirm('Снять оператора с этой машины? Он перестанет её видеть.')) return;
    try {
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();
      const { error: err } = await sb
        .from('machine_assignments')
        .update({ unassigned_at: new Date().toISOString() })
        .eq('machine_id', machineId)
        .eq('operator_id', operatorId)
        .is('unassigned_at', null);
      if (err) throw err;
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary-600" />
          Операторы ({assigned.length})
        </CardTitle>
        {canAssignOperators && (
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <UserPlus className="w-3.5 h-3.5" />
            Назначить
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2 mb-3 whitespace-pre-wrap">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-sm text-secondary-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка…
          </p>
        ) : assigned.length === 0 ? (
          <p className="text-sm text-secondary-500">
            На машине пока нет назначенных операторов. Они её не видят, пока вы не добавите
            кого-то.
          </p>
        ) : (
          <ul className="divide-y divide-secondary-100">
            {assigned.map((a) => (
              <li
                key={a.operator_id}
                className="py-2 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline">Оператор</Badge>
                  <span className="text-sm font-medium text-secondary-900 truncate">
                    {a.profile?.full_name || '(имя не указано)'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-secondary-500 flex-shrink-0">
                  <span>
                    с{' '}
                    {new Date(a.assigned_at).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  {canAssignOperators && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unassign(a.operator_id)}
                    >
                      <UserMinus className="w-3 h-3" />
                      Снять
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {canAssignOperators && (
        <AssignOperatorDialog
          open={pickerOpen}
          onOpenChange={(open) => {
            setPickerOpen(open);
            if (!open) reload();
          }}
          machineId={machineId}
          companyId={companyId}
          alreadyAssigned={assigned.map((a) => a.operator_id)}
          onError={(e) => setError(e)}
        />
      )}
    </Card>
  );
}

// =========================================================================
// Picker dialog
// =========================================================================

function AssignOperatorDialog({
  open,
  onOpenChange,
  machineId,
  companyId,
  alreadyAssigned,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machineId: string;
  companyId: string;
  alreadyAssigned: string[];
  onError: (msg: string) => void;
}) {
  const [available, setAvailable] = useState<AvailableOperator[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalErr(null);
    setSelected('');
    (async () => {
      setLoading(true);
      try {
        const c = await createSPASassClient();
        const sb = c.getSupabaseClient();
        const { data, error } = await sb
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .eq('role', 'operator')
          .order('full_name', { ascending: true });
        if (error) throw error;
        const list = (data ?? []) as AvailableOperator[];
        // Don't offer operators that are already assigned to this machine.
        setAvailable(list.filter((o) => !alreadyAssigned.includes(o.id)));
      } catch (e) {
        setLocalErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, companyId, alreadyAssigned]);

  const submit = async () => {
    if (!selected) {
      setLocalErr('Выберите оператора');
      return;
    }
    setBusy(true);
    setLocalErr(null);
    try {
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();
      // If there's a soft-deleted (unassigned_at IS NOT NULL) row, the PK
      // collision blocks a plain insert. Use upsert to re-activate.
      const { error: err } = await sb
        .from('machine_assignments')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(
          {
            machine_id: machineId,
            operator_id: selected,
            assigned_at: new Date().toISOString(),
            unassigned_at: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          { onConflict: 'machine_id,operator_id' }
        );
      if (err) throw err;
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLocalErr(msg);
      onError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Назначить оператора на машину</DialogTitle>
          <DialogDescription>
            Доступны операторы вашей компании, ещё не назначенные на эту машину.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-secondary-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка…
          </p>
        ) : available.length === 0 ? (
          <p className="text-sm text-secondary-500">
            Все операторы компании уже назначены на эту машину. Сначала пригласите нового
            оператора в разделе «Команда».
          </p>
        ) : (
          <div className="space-y-3">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">— выберите оператора —</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name || '(имя не указано)'}
                </option>
              ))}
            </Select>
          </div>
        )}

        {localErr && (
          <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2 whitespace-pre-wrap">
            {localErr}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={busy || !selected || available.length === 0}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Назначить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
