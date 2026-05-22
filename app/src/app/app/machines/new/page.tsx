'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import type { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface MachineType {
  id: string;
  name_ru: string;
  recipe_modes: string[];
}

/**
 * Technical defaults inferred per machine type — not asked from the user.
 * Saved alongside the user-entered fields when the row is inserted.
 *
 *   МЗВ  — drum, no auger, 2 components.
 *   МСЗ  — no drum, auger (VP/NP), 2 components. Auger position is the
 *          single derived field the user actually picks.
 *   МСЗУ — drum, no auger, 3 components.
 *   МЗУ  — drum, no auger, 2 components.
 */
const TYPE_DEFAULTS: Record<
  string,
  {
    has_drum: boolean;
    needs_auger: boolean;
    component_count: number;
  }
> = {
  МЗВ: { has_drum: true, needs_auger: false, component_count: 2 },
  МСЗ: { has_drum: false, needs_auger: true, component_count: 2 },
  МСЗУ: { has_drum: true, needs_auger: false, component_count: 3 },
  МЗУ: { has_drum: true, needs_auger: false, component_count: 2 },
};

export default function NewMachinePage() {
  const router = useRouter();
  const { user } = useGlobal();
  const t = useTranslations('machines.new');
  const tShared = useTranslations('machines');

  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [machineType, setMachineType] = useState<string>('');
  const [modelCode, setModelCode] = useState('');
  const [tonnage, setTonnage] = useState('');
  const [augerPosition, setAugerPosition] = useState<'upper' | 'lower'>('lower');
  const [serialNumber, setSerialNumber] = useState('');
  const [internalName, setInternalName] = useState('');
  const [inServiceSince, setInServiceSince] = useState('');
  const [pitLocation, setPitLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { data, error } = await supabase
          .from('machine_types')
          .select('id, name_ru, recipe_modes')
          .order('id');
        if (error) throw error;
        setMachineTypes((data ?? []) as MachineType[]);
        if (data && data.length > 0 && !machineType) {
          setMachineType((data[0] as MachineType).id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('error_load_types'));
      }
    };
    fetchTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaults = machineType ? TYPE_DEFAULTS[machineType] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!machineType) return setError(t('error_pick_type'));
    if (!modelCode.trim()) return setError(t('error_pick_model'));
    const tonnageNum = parseFloat(tonnage);
    if (!Number.isFinite(tonnageNum) || tonnageNum <= 0) {
      return setError(t('error_pick_tonnage'));
    }
    if (!defaults) return setError(t('error_unknown_type'));

    setLoading(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', user!.id)
        .single();
      if (profileErr || !profile) throw profileErr ?? new Error(t('error_no_company'));
      const callerProfile = profile as { company_id: string | null; role: string };

      // Platform admin can pass ?company_id=<uuid> to create the machine in
      // a specific tenant (they come here from /admin/companies/[id]). For
      // everyone else, the caller's own company is the only legal target.
      const queryCompanyId = new URLSearchParams(window.location.search).get('company_id');
      const companyId =
        callerProfile.role === 'platform_admin' && queryCompanyId
          ? queryCompanyId
          : callerProfile.company_id;
      if (!companyId) throw new Error(t('error_no_company'));

      const insertPayload: Database['public']['Tables']['machines']['Insert'] = {
        company_id: companyId,
        machine_type: machineType,
        model_code: modelCode.trim(),
        tonnage_t: tonnageNum,
        auger_position: defaults.needs_auger ? augerPosition : 'none',
        has_drum: defaults.has_drum,
        component_count: defaults.component_count,
        ggd_type: null,
        serial_number: serialNumber.trim() || null,
        internal_name: internalName.trim() || null,
        in_service_since: inServiceSince || null,
        pit_location: pitLocation.trim() || null,
        notes: notes.trim() || null,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('machines')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      router.push(`/app/machines/${(inserted as { id: string }).id}`);
    } catch (err) {
      // Surface the actual Postgres / Supabase error so the user can tell us
      // what's broken instead of getting a generic message.
      let msg: string;
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        msg = String((err as { message: unknown }).message);
      } else {
        msg = JSON.stringify(err);
      }
      setError(t('error_create_prefix', { msg }));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <Link
        href="/app/machines"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('back_to_list')}
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          {t('title')}
        </h1>
        <p className="text-secondary-600 text-sm mt-1">{t('subtitle')}</p>
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="machineType">{t('machine_type_required')}</Label>
              <Select
                id="machineType"
                value={machineType}
                onChange={(e) => setMachineType(e.target.value)}
                required
                className="mt-1"
              >
                {machineTypes.length === 0 && <option value="">{t('machine_type_loading')}</option>}
                {machineTypes.map((mt) => (
                  <option key={mt.id} value={mt.id}>
                    {mt.id} — {mt.name_ru}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="modelCode">{t('model_required')}</Label>
              <Input
                id="modelCode"
                value={modelCode}
                onChange={(e) => setModelCode(e.target.value)}
                placeholder={t('model_placeholder')}
                required
                className="mt-1"
              />
              <p className="mt-1 text-xs text-secondary-500">{t('model_hint')}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="internalName">{tShared('internal_name')}</Label>
            <Input
              id="internalName"
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              placeholder={tShared('internal_name_placeholder')}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-secondary-500">{tShared('internal_name_hint')}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="tonnage">{t('tonnage_required')}</Label>
              <Input
                id="tonnage"
                type="number"
                step="0.1"
                min="1"
                max="50"
                value={tonnage}
                onChange={(e) => setTonnage(e.target.value)}
                placeholder={t('tonnage_placeholder')}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="serialNumber">{t('serial')}</Label>
              <Input
                id="serialNumber"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder={t('serial_placeholder')}
                className="mt-1 font-mono"
              />
              <p className="mt-1 text-xs text-secondary-500">{t('serial_hint')}</p>
            </div>
          </div>

          {defaults?.needs_auger && (
            <div>
              <Label htmlFor="augerPosition">{t('auger_position')}</Label>
              <Select
                id="augerPosition"
                value={augerPosition}
                onChange={(e) => setAugerPosition(e.target.value as 'upper' | 'lower')}
                className="mt-1"
              >
                <option value="upper">{t('auger_upper')}</option>
                <option value="lower">{t('auger_lower')}</option>
              </Select>
              <p className="mt-1 text-xs text-secondary-500">{t('auger_hint')}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="inServiceSince">{t('in_service_since')}</Label>
              <DatePicker
                id="inServiceSince"
                value={inServiceSince}
                onChange={setInServiceSince}
                className="mt-1"
                fromYear={2000}
              />
            </div>

            <div>
              <Label htmlFor="pitLocation">{t('pit_location')}</Label>
              <Input
                id="pitLocation"
                value={pitLocation}
                onChange={(e) => setPitLocation(e.target.value)}
                placeholder={t('pit_location_placeholder')}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notes_placeholder')}
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-secondary-100">
            <Button asChild variant="outline" type="button">
              <Link href="/app/machines">{t('cancel')}</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
