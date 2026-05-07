'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Truck,
  ClipboardCheck,
  Wrench,
  Check,
  X as XIcon,
  Minus,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PhotoUploader } from '@/components/shared/PhotoUploader';
import { ChargingPlanInput, type ChargingPlanValue } from '@/components/shifts/ChargingPlanInput';
import type {
  ChecklistItem,
  ChecklistAnswer,
  ChecklistAnswerStatus,
} from '@/lib/types';

interface MachineOption {
  id: string;
  machine_type: string;
  model_code: string;
}

interface TemplateRow {
  id: string;
  machine_type: string;
  items: ChecklistItem[];
}

type Step = 'machine' | 'checklist' | 'plan';

export default function StartShiftPage() {
  const router = useRouter();
  const { user } = useGlobal();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('machine');
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [machineId, setMachineId] = useState('');
  const [plannedFor, setPlannedFor] = useState(() => new Date().toISOString().split('T')[0]);

  // Step 2
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer>>({});
  const [checklistNotes, setChecklistNotes] = useState('');

  // Step 3
  const [planValue, setPlanValue] = useState<ChargingPlanValue | null>(null);
  const [planHoles, setPlanHoles] = useState('');
  const [planPit, setPlanPit] = useState('');
  const [planNotes, setPlanNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;
        const client = await createSPASassClient();
        const supabase = client.getSupabaseClient();

        const [profileResp, machinesResp, templatesResp] = await Promise.all([
          supabase.from('profiles').select('company_id').eq('id', user.id).single(),
          supabase
            .from('machines')
            .select('id, machine_type, model_code')
            .eq('status', 'active')
            .order('model_code'),
          supabase
            .from('checklist_templates')
            .select('id, machine_type, items')
            .eq('kind', 'pre_shift'),
        ]);

        const cid = (profileResp.data as { company_id: string } | null)?.company_id;
        if (!cid) throw new Error('Профиль не привязан к компании');
        setCompanyId(cid);

        if (machinesResp.error) throw machinesResp.error;
        setMachines((machinesResp.data ?? []) as MachineOption[]);

        if (templatesResp.error) throw templatesResp.error;
        setTemplates((templatesResp.data ?? []) as TemplateRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const selectedMachine = machines.find((m) => m.id === machineId) ?? null;
  const template = selectedMachine
    ? templates.find((t) => t.machine_type === selectedMachine.machine_type) ?? null
    : null;

  const setAnswer = (item: ChecklistItem, status: ChecklistAnswerStatus) => {
    setAnswers((prev) => ({
      ...prev,
      [item.id]: {
        item_id: item.id,
        status,
        photo_url: prev[item.id]?.photo_url ?? null,
        comment: prev[item.id]?.comment ?? null,
      },
    }));
  };

  const setAnswerPhoto = (itemId: string, path: string | null) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        item_id: itemId,
        status: prev[itemId]?.status ?? 'skip',
        photo_url: path,
        comment: prev[itemId]?.comment ?? null,
      },
    }));
  };

  const setAnswerComment = (itemId: string, comment: string) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        item_id: itemId,
        status: prev[itemId]?.status ?? 'skip',
        photo_url: prev[itemId]?.photo_url ?? null,
        comment: comment || null,
      },
    }));
  };

  const checklistComplete = template
    ? template.items.every((it) => answers[it.id]?.status)
    : false;

  const hasCriticalFail = template
    ? template.items.some((it) => it.severity === 'critical' && answers[it.id]?.status === 'fail')
    : false;

  const handleSubmit = async () => {
    if (!companyId || !user || !selectedMachine || !template) return;
    setError(null);

    if (!planValue) {
      setError('Заполните план зарядки: тоннаж и состав');
      return;
    }

    setSubmitting(true);
    try {
      const client = await createSPASassClient();
      const supabase = client.getSupabaseClient();

      // 1) Create the shift
      const { data: shift, error: shiftErr } = await supabase
        .from('shifts')
        .insert({
          company_id: companyId,
          machine_id: selectedMachine.id,
          operator_id: user.id,
          status: hasCriticalFail ? 'blocked' : 'in_progress',
          planned_for: plannedFor,
          started_at: hasCriticalFail ? null : new Date().toISOString(),
          plan_recipe: planValue.recipe,
          plan_tons: planValue.totalTons,
          plan_emulsion_tons: planValue.emulsionTons,
          plan_an_tons: planValue.anTons,
          plan_diesel_tons: planValue.dieselTons,
          plan_holes: planHoles ? parseInt(planHoles, 10) : null,
          plan_pit_location: planPit.trim() || null,
          plan_notes: planNotes.trim() || null,
        })
        .select('id')
        .single();
      if (shiftErr || !shift) throw shiftErr ?? new Error('Не удалось создать смену');
      const shiftId = (shift as { id: string }).id;

      // 2) Save the checklist execution
      const itemsStatus: ChecklistAnswer[] = template.items.map((it) =>
        answers[it.id] ?? { item_id: it.id, status: 'skip', photo_url: null, comment: null }
      );
      const { error: execErr } = await supabase.from('checklist_executions').insert({
        shift_id: shiftId,
        template_id: template.id,
        items_snapshot: template.items,
        items_status: itemsStatus,
        has_critical_fail: hasCriticalFail,
        notes: checklistNotes.trim() || null,
        performed_by: user.id,
      });
      if (execErr) throw execErr;

      router.push(`/app/shifts/${shiftId}`);
    } catch (err) {
      let msg: string;
      if (err instanceof Error) msg = err.message;
      else if (err && typeof err === 'object' && 'message' in err) msg = String((err as { message: unknown }).message);
      else msg = JSON.stringify(err);
      setError(`Не удалось начать смену: ${msg}`);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Загрузка…
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-3xl mx-auto">
      <Link
        href="/app/shifts"
        className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900"
      >
        <ArrowLeft className="w-4 h-4" />К списку смен
      </Link>

      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-secondary-900">
          Начать смену
        </h1>
        <p className="text-secondary-600 text-sm mt-1">
          Три шага: выбор машины → чек-лист → план зарядки.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 flex-wrap">
        <StepBadge active={step === 'machine'} done={step !== 'machine'} icon={Truck} label="1. Машина" />
        <ArrowRight className="w-4 h-4 text-secondary-300" />
        <StepBadge
          active={step === 'checklist'}
          done={step === 'plan'}
          icon={ClipboardCheck}
          label="2. Чек-лист"
        />
        <ArrowRight className="w-4 h-4 text-secondary-300" />
        <StepBadge active={step === 'plan'} done={false} icon={Wrench} label="3. План" />
      </div>

      {error && (
        <div className="p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* === STEP 1: Machine === */}
      {step === 'machine' && (
        <Card className="p-5 space-y-5">
          <div>
            <Label htmlFor="machine">Машина *</Label>
            <Select
              id="machine"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              required
              className="mt-1"
            >
              <option value="">Выберите машину…</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_code} ({m.machine_type})
                </option>
              ))}
            </Select>
            {machines.length === 0 && (
              <p className="mt-1 text-xs text-secondary-500">
                Нет активных машин.{' '}
                <Link href="/app/machines/new" className="text-primary-600 hover:underline">
                  Добавить машину →
                </Link>
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="plannedFor">Дата смены</Label>
            <Input
              id="plannedFor"
              type="date"
              value={plannedFor}
              onChange={(e) => setPlannedFor(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setStep('checklist')}
              disabled={!machineId || !template}
            >
              Дальше
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          {machineId && !template && (
            <div className="p-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
              Чек-лист для типа «{selectedMachine?.machine_type}» ещё не настроен. Свяжитесь с
              администратором платформы.
            </div>
          )}
        </Card>
      )}

      {/* === STEP 2: Checklist === */}
      {step === 'checklist' && template && (
        <Card className="p-5">
          <div className="mb-4">
            <h3 className="font-heading font-semibold text-secondary-900">
              Чек-лист перед сменой
            </h3>
            <p className="text-xs text-secondary-500 mt-1">
              Отметьте каждый пункт. Если критичный пункт «Ошибка» — смена будет
              заблокирована и автоматически создастся тикет в Tier 2.
            </p>
          </div>

          <ul className="divide-y divide-secondary-100">
            {template.items.map((item) => {
              const ans = answers[item.id];
              const isCritical = item.severity === 'critical';
              return (
                <li key={item.id} className="py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-900">
                        {item.name_ru}{' '}
                        {isCritical && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded ml-1">
                            <AlertTriangle className="w-3 h-3" /> Критично
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <AnswerButton
                        active={ans?.status === 'pass'}
                        onClick={() => setAnswer(item, 'pass')}
                        icon={Check}
                        label="OK"
                        variant="pass"
                      />
                      <AnswerButton
                        active={ans?.status === 'fail'}
                        onClick={() => setAnswer(item, 'fail')}
                        icon={XIcon}
                        label="Ошибка"
                        variant="fail"
                      />
                      <AnswerButton
                        active={ans?.status === 'skip'}
                        onClick={() => setAnswer(item, 'skip')}
                        icon={Minus}
                        label="N/A"
                        variant="skip"
                      />
                    </div>
                  </div>
                  {ans?.status === 'fail' && (
                    <div className="mt-2 ml-1 space-y-2 pl-3 border-l-2 border-accent-300">
                      <Textarea
                        placeholder="Опишите проблему…"
                        value={ans.comment ?? ''}
                        onChange={(e) => setAnswerComment(item.id, e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      {companyId && (
                        <PhotoUploader
                          bucket="shift-photos"
                          companyId={companyId}
                          context="checklist-fail"
                          initialPath={ans.photo_url}
                          onUploaded={(p) => setAnswerPhoto(item.id, p)}
                          onRemoved={() => setAnswerPhoto(item.id, null)}
                          onError={(e) => setError(e)}
                          compact
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 pt-4 border-t border-secondary-100">
            <Label htmlFor="checklistNotes">Дополнительно</Label>
            <Textarea
              id="checklistNotes"
              value={checklistNotes}
              onChange={(e) => setChecklistNotes(e.target.value)}
              placeholder="Любые наблюдения по машине…"
              rows={2}
              className="mt-1"
            />
          </div>

          {hasCriticalFail && (
            <div className="mt-4 p-3 text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Критичная ошибка в чек-листе.</strong> При продолжении смена
                будет создана со статусом «Заблокирована» — оператор не сможет начать
                работу до устранения. Это правильно, не пытайтесь обойти.
              </span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <Button type="button" variant="outline" onClick={() => setStep('machine')}>
              <ArrowLeft className="w-4 h-4" />
              Назад
            </Button>
            <Button
              type="button"
              onClick={() => setStep('plan')}
              disabled={!checklistComplete}
            >
              Дальше
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* === STEP 3: Charging plan === */}
      {step === 'plan' && (
        <Card className="p-5 space-y-5">
          <div>
            <h3 className="font-heading font-semibold text-secondary-900">
              План зарядки
            </h3>
            <p className="text-xs text-secondary-500 mt-1">
              Это план — фактические значения внесёте при закрытии смены.
            </p>
          </div>

          <ChargingPlanInput
            machineType={selectedMachine?.machine_type}
            onChange={setPlanValue}
            variant="plan"
          />

          <div>
            <Label htmlFor="planHoles">Кол-во скважин</Label>
            <Input
              id="planHoles"
              type="number"
              step="1"
              min="0"
              value={planHoles}
              onChange={(e) => setPlanHoles(e.target.value)}
              placeholder="32"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="planPit">Блок / карьер</Label>
            <Input
              id="planPit"
              value={planPit}
              onChange={(e) => setPlanPit(e.target.value)}
              placeholder="Block A, Pit 2"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="planNotes">Примечания</Label>
            <Textarea
              id="planNotes"
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              placeholder="Особенности задания, требования заказчика…"
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-secondary-100">
            <Button type="button" variant="outline" onClick={() => setStep('checklist')}>
              <ArrowLeft className="w-4 h-4" />
              Назад
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !planValue}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Создание…' : 'Начать смену'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StepBadge({
  active,
  done,
  icon: Icon,
  label,
}: {
  active: boolean;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const cls = active
    ? 'bg-primary-600 text-white border-primary-600'
    : done
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-white text-secondary-500 border-secondary-200';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${cls}`}>
      {done && !active ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}

function AnswerButton({
  active,
  onClick,
  icon: Icon,
  label,
  variant,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant: 'pass' | 'fail' | 'skip';
}) {
  const colors = {
    pass: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50',
    fail: active ? 'bg-accent-600 text-white border-accent-600' : 'bg-white text-accent-700 border-accent-300 hover:bg-accent-50',
    skip: active ? 'bg-secondary-600 text-white border-secondary-600' : 'bg-white text-secondary-700 border-secondary-300 hover:bg-secondary-50',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${colors}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
