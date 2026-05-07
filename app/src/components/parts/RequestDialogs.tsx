'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { PhotoUploader } from '@/components/shared/PhotoUploader';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitting?: (busy: boolean) => void;
}

// ===== QuoteDialog (Tier 2) ===============================================
export function QuoteDialog({
  open,
  onOpenChange,
  onSubmit,
}: BaseProps & {
  onSubmit: (notes: string, amount: number | null, currency: string | null) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!notes.trim()) {
      setErr('Опишите КП');
      return;
    }
    setBusy(true);
    try {
      const a = amount ? parseFloat(amount) : null;
      await onSubmit(notes.trim(), a, a !== null ? currency : null);
      // Reset for next time
      setNotes('');
      setAmount('');
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Прислать КП</DialogTitle>
          <DialogDescription>
            Текст коммерческого предложения и общая сумма (если применимо).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="quote_notes">Текст КП *</Label>
            <Textarea
              id="quote_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Что входит, сроки изготовления / отгрузки, условия…"
              maxLength={2000}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quote_amount">Сумма</Label>
              <Input
                id="quote_amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1234.56"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="quote_currency">Валюта</Label>
              <Select
                id="quote_currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
                <option value="RUB">RUB</option>
                <option value="EUR">EUR</option>
                <option value="SAR">SAR</option>
              </Select>
            </div>
          </div>
          {err && (
            <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={busy || !notes.trim()}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Отправить КП
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== OrderDialog (Tier 2) ===============================================
export function OrderDialog({
  open,
  onOpenChange,
  onSubmit,
}: BaseProps & {
  onSubmit: (eta: string) => Promise<void>;
}) {
  const [eta, setEta] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!eta) {
      setErr('Укажите ожидаемую дату поставки');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(eta);
      setEta('');
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Разместить заказ</DialogTitle>
          <DialogDescription>
            Заказ размещён у поставщика. Укажите ожидаемую дату поставки.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="order_eta">Ожидаемая дата поставки *</Label>
            <DatePicker
              id="order_eta"
              value={eta}
              onChange={setEta}
              className="mt-1"
              fromYear={new Date().getFullYear()}
              toYear={new Date().getFullYear() + 2}
            />
          </div>
          {err && (
            <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={busy || !eta}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Разместить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== CancelDialog =======================================================
export function CancelDialog({
  open,
  onOpenChange,
  onSubmit,
}: BaseProps & {
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await onSubmit(reason.trim());
      setReason('');
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Отменить заявку</DialogTitle>
          <DialogDescription>Это действие нельзя откатить.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cancel_reason">Причина отмены</Label>
            <Textarea
              id="cancel_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Не нужны / нашли другой источник / ошиблись с моделью…"
              className="mt-1"
            />
          </div>
          {err && (
            <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Назад
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Отменить заявку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== MarkReceivedDialog =================================================
export function MarkReceivedDialog({
  open,
  onOpenChange,
  companyId,
  onSubmit,
}: BaseProps & {
  companyId: string;
  onSubmit: (qtyText: string, photoUrl: string, notes: string | null) => Promise<void>;
}) {
  const [qty, setQty] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!qty.trim()) {
      setErr('Опишите фактическое количество получения');
      return;
    }
    if (!photoUrl) {
      setErr('Загрузите фото получения');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(qty.trim(), photoUrl, notes.trim() || null);
      setQty('');
      setNotes('');
      setPhotoUrl(null);
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подтвердить получение</DialogTitle>
          <DialogDescription>
            Запчасть получена клиентом — введите фактическое количество и приложите фото.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="recv_qty">Получено по факту *</Label>
            <Input
              id="recv_qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="12 фильтров, 4 уплотнения"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Фото подтверждения *</Label>
            <div className="mt-1">
              <PhotoUploader
                bucket="parts-photos"
                companyId={companyId}
                context="received"
                initialPath={photoUrl}
                onUploaded={(p) => setPhotoUrl(p)}
                onRemoved={() => setPhotoUrl(null)}
                onError={(e) => setErr(e)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="recv_notes">Примечания</Label>
            <Textarea
              id="recv_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Состояние упаковки, недостача и т.п."
              className="mt-1"
            />
          </div>
          {err && (
            <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-md p-2">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={busy || !qty.trim() || !photoUrl}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Подтвердить получение
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
