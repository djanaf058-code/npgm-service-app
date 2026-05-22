'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PhotoUpload } from '@/components/tickets/PhotoUpload';

interface MachineOption {
  id: string;
  model_code: string;
  machine_type: string;
  internal_name: string | null;
}

function machineLabel(m: MachineOption): string {
  const primary = m.internal_name?.trim() ? m.internal_name : m.model_code;
  return `${primary} (${m.machine_type})`;
}

export default function NewTicketPage() {
  const router = useRouter();
  const { user } = useGlobal();
  const t = useTranslations('tickets.new');

  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [machineId, setMachineId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('3');
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user!.id)
          .single();
        const cid = (profile as { company_id: string } | null)?.company_id;
        if (!cid) throw new Error(t('err_no_company'));
        setCompanyId(cid);

        const { data: machinesData, error: machinesErr } = await supabase
          .from('machines')
          .select('id, model_code, machine_type, internal_name')
          .eq('status', 'active')
          .order('internal_name', { ascending: true, nullsFirst: false })
          .order('model_code');
        if (machinesErr) throw machinesErr;
        setMachines((machinesData ?? []) as MachineOption[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('err_no_data'));
      }
    };
    if (user) load();
  }, [user, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim() && !photoPath) {
      setError(t('err_empty'));
      return;
    }
    if (!companyId) {
      setError(t('err_no_company'));
      return;
    }

    setSubmitting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      const { data: ticket, error: insertErr } = await supabase
        .from('tickets')
        .insert({
          company_id: companyId,
          machine_id: machineId || null,
          operator_id: user!.id,
          title: title.trim() || description.slice(0, 80),
          priority: parseInt(priority, 10),
          status: 'new',
        })
        .select('id')
        .single();
      if (insertErr || !ticket) throw insertErr ?? new Error(t('err_create'));
      const ticketId = (ticket as { id: string }).id;

      const { error: msgErr } = await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_type: 'operator',
        sender_id: user!.id,
        text: description.trim() || null,
        image_url: photoPath,
      });
      if (msgErr) throw msgErr;

      // Fire-and-forget AI auto-reply. If the API fails or takes long, the
      // ticket is already created — engineer will pick it up. We don't await
      // here so the operator isn't blocked by Claude latency.
      void fetch('/api/tickets/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      }).catch(() => {
        // intentional — see comment above
      });

      // replace (not push): drop the form from history so "back" lands on the
      // tickets list, not back inside the just-created ticket form.
      router.replace(`/app/tickets/${ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('err_send'));
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <Link
        href="/app/tickets"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />{t('back_to_list')}
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          {t('title')}
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          {t('subtitle')}
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md">
          {error}
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="machine">{t('machine_label')}</Label>
            <Select
              id="machine"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="mt-1"
            >
              <option value="">{t('machine_unbound')}</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {machineLabel(m)}
                </option>
              ))}
            </Select>
            {machines.length === 0 && (
              <p className="mt-1 text-xs text-secondary-500">
                {t('no_active_machines')}{' '}
                <Link href="/app/machines/new" className="text-primary-600 hover:underline">
                  {t('add_machine')}
                </Link>
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="title">{t('title_label')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('title_placeholder')}
              maxLength={120}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-secondary-500">
              {t('title_hint')}
            </p>
          </div>

          <div>
            <Label htmlFor="description">{t('description_label')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('description_placeholder')}
              rows={5}
              className="mt-1"
            />
          </div>

          <div>
            <Label>{t('priority_label')}</Label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1"
            >
              <option value="1">{t('priority_p1')}</option>
              <option value="2">{t('priority_p2')}</option>
              <option value="3">{t('priority_p3')}</option>
              <option value="4">{t('priority_p4')}</option>
              <option value="5">{t('priority_p5')}</option>
            </Select>
          </div>

          <div>
            <Label>{t('photo_label')}</Label>
            <div className="mt-1">
              {companyId ? (
                <PhotoUpload
                  companyId={companyId}
                  onUploaded={(path) => setPhotoPath(path)}
                  onError={(err) => setError(err)}
                />
              ) : (
                <p className="text-xs text-secondary-500">{t('photo_company_pending')}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-secondary-100">
            <Button asChild variant="outline" type="button">
              <Link href="/app/tickets">{t('cancel')}</Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? t('submitting') : t('submit_button')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
