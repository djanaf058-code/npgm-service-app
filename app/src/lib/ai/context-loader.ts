// Loads machine context for the AI prompt — model, hours, last maintenance,
// open tickets. Trims to ~500 tokens worth so we don't burn context window.

import { createServerAdminClient } from '../supabase/serverAdminClient';

export interface MachineContext {
  model_code: string;
  machine_type: string;
  serial_number: string | null;
  engine_hours: number;
  tons_pumped: number;
  last_maintenance_at: string | null;
  open_tickets: { title: string; status: string }[];
}

export async function loadMachineContext(machineId: string): Promise<MachineContext | null> {
  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: machine } = await sb
    .from('machines')
    .select('model_code, machine_type, serial_number, engine_hours, tons_pumped')
    .eq('id', machineId)
    .maybeSingle();
  if (!machine) return null;

  const { data: lastMaint } = await sb
    .from('maintenance_events')
    .select('performed_at')
    .eq('machine_id', machineId)
    .order('performed_at', { ascending: false })
    .limit(1);

  const { data: tickets } = await sb
    .from('tickets')
    .select('title, status')
    .eq('machine_id', machineId)
    .in('status', ['new', 'in_progress', 'awaiting_response'])
    .limit(5);

  return {
    model_code: machine.model_code,
    machine_type: machine.machine_type,
    serial_number: machine.serial_number,
    engine_hours: Number(machine.engine_hours ?? 0),
    tons_pumped: Number(machine.tons_pumped ?? 0),
    last_maintenance_at: lastMaint?.[0]?.performed_at ?? null,
    open_tickets: tickets ?? [],
  };
}
