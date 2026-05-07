'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
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
}

export default function NewTicketPage() {
  const router = useRouter();
  const { user } = useGlobal();

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
        if (!cid) throw new Error('Профиль не привязан к компании');
        setCompanyId(cid);

        const { data: machinesData, error: machinesErr } = await supabase
          .from('machines')
          .select('id, model_code, machine_type')
          .eq('status', 'active')
          .order('model_code');
        if (machinesErr) throw machinesErr;
        setMachines((machinesData ?? []) as MachineOption[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
      }
    };
    if (user) load();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim() && !photoPath) {
      setError('Опишите проблему текстом или прикрепите фото');
      return;
    }
    if (!companyId) {
      setError('Не удалось определить компанию');
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
      if (insertErr || !ticket) throw insertErr ?? new Error('Не удалось создать тикет');
      const ticketId = (ticket as { id: string }).id;

      // First message: the description + (optional) photo
      const { error: msgErr } = await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_type: 'operator',
        sender_id: user!.id,
        text: description.trim() || null,
        image_url: photoPath,
      });
      if (msgErr) throw msgErr;

      router.push(`/app/tickets/${ticketId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить тикет');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      <Link
        href="/app/tickets"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />К списку тикетов
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          Новый тикет
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          Опишите проблему. Фото с камеры — лучше, чем тысяча слов.
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
            <Label htmlFor="machine">Машина</Label>
            <Select
              id="machine"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="mt-1"
            >
              <option value="">Не привязано к машине</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_code} ({m.machine_type})
                </option>
              ))}
            </Select>
            {machines.length === 0 && (
              <p className="mt-1 text-xs text-secondary-500">
                У компании ещё нет активных машин.{' '}
                <Link href="/app/machines/new" className="text-primary-600 hover:underline">
                  Добавить машину →
                </Link>
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="title">Тема (необязательно)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Машина не запускается"
              maxLength={120}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-secondary-500">
              Если не указать, возьмём первые 80 символов описания.
            </p>
          </div>

          <div>
            <Label htmlFor="description">Описание проблемы *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что происходит? Когда началось? Что вы пробовали?"
              rows={5}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Приоритет</Label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1"
            >
              <option value="1">P1 — Авария (полная остановка)</option>
              <option value="2">P2 — Высокий (значительные потери)</option>
              <option value="3">P3 — Средний (стандартный запрос)</option>
              <option value="4">P4 — Низкий (можно подождать)</option>
              <option value="5">P5 — Несрочный (общий вопрос)</option>
            </Select>
          </div>

          <div>
            <Label>Фото</Label>
            <div className="mt-1">
              {companyId ? (
                <PhotoUpload
                  companyId={companyId}
                  onUploaded={(path) => setPhotoPath(path)}
                  onError={(err) => setError(err)}
                />
              ) : (
                <p className="text-xs text-secondary-500">Загрузка возможна после определения компании…</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-secondary-100">
            <Button asChild variant="outline" type="button">
              <Link href="/app/tickets">Отмена</Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? 'Отправка…' : 'Отправить тикет'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
