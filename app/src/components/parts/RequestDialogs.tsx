'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('parts_dialogs');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!notes.trim()) {
      setErr(t('quote.empty_error'));
      return;
    }
    setBusy(true);
    try {
      const a = amount ? parseFloat(amount) : null;
      await onSubmit(notes.trim(), a, a !== null ? currency : null);
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
          <DialogTitle>{t('quote.title')}</DialogTitle>
          <DialogDescription>{t('quote.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="quote_notes">{t('quote.notes_label')}</Label>
            <Textarea
              id="quote_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder={t('quote.notes_placeholder')}
              maxLength={2000}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="quote_amount">{t('quote.amount_label')}</Label>
              <Input
                id="quote_amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('quote.amount_placeholder')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="quote_currency">{t('quote.currency_label')}</Label>
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
            {t('cancel_button')}
          </Button>
          <Button onClick={submit} disabled={busy || !notes.trim()}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('quote.submit')}
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
  const t = useTranslations('parts_dialogs');
  const [eta, setEta] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!eta) {
      setErr(t('order.empty_error'));
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
          <DialogTitle>{t('order.title')}</DialogTitle>
          <DialogDescription>{t('order.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="order_eta">{t('order.eta_label')}</Label>
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
            {t('cancel_button')}
          </Button>
          <Button onClick={submit} disabled={busy || !eta}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('order.submit')}
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
  const t = useTranslations('parts_dialogs');
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
          <DialogTitle>{t('cancel.title')}</DialogTitle>
          <DialogDescription>{t('cancel.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cancel_reason">{t('cancel.reason_label')}</Label>
            <Textarea
              id="cancel_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t('cancel.reason_placeholder')}
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
            {t('cancel.back')}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('cancel.submit')}
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
  const t = useTranslations('parts_dialogs');
  const [qty, setQty] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!qty.trim()) {
      setErr(t('received.qty_empty_error'));
      return;
    }
    if (!photoUrl) {
      setErr(t('received.photo_empty_error'));
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
          <DialogTitle>{t('received.title')}</DialogTitle>
          <DialogDescription>{t('received.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="recv_qty">{t('received.qty_label')}</Label>
            <Input
              id="recv_qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={t('received.qty_placeholder')}
              className="mt-1"
            />
          </div>
          <div>
            <Label>{t('received.photo_label')}</Label>
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
            <Label htmlFor="recv_notes">{t('received.notes_label')}</Label>
            <Textarea
              id="recv_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t('received.notes_placeholder')}
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
            {t('cancel_button')}
          </Button>
          <Button onClick={submit} disabled={busy || !qty.trim() || !photoUrl}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('received.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
