'use client';

import { useState } from 'react';
import { Send, Quote as QuoteIcon, CheckCircle2, Truck, PackageCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSPASassClient } from '@/lib/supabase/client';
import { useRole } from '@/lib/context/GlobalContext';
import {
  QuoteDialog,
  OrderDialog,
  CancelDialog,
  MarkReceivedDialog,
} from './RequestDialogs';
import type { PartsRequestStatus } from '@/lib/types';

interface Props {
  requestId: string;
  status: PartsRequestStatus;
  companyId: string;
  // Called after a successful RPC so the parent page reloads.
  onChanged: () => void;
  onError: (msg: string) => void;
}

// Wrap supabase RPC errors into Error so dialogs surface them.
async function rpc<T = unknown>(
  fn: string,
  args: Record<string, unknown>
): Promise<T> {
  const client = await createSPASassClient();
  const supabase = client.getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) {
    const detail =
      // PostgREST shape: error.message often holds Postgres exception text.
      error.message || JSON.stringify(error);
    throw new Error(detail);
  }
  return data as T;
}

export function RequestActionPanel({
  requestId,
  status,
  companyId,
  onChanged,
  onError,
}: Props) {
  const { isOperator, isProjectManager, isTier2 } = useRole();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receivedOpen, setReceivedOpen] = useState(false);

  // Wraps "loading + reload + error" boilerplate around an RPC call.
  const callRpc = async (fn: string, args: Record<string, unknown>) => {
    try {
      await rpc(fn, args);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  const isFinal = status === 'received' || status === 'cancelled';
  if (isFinal) return null;

  // Per-role action availability map (keep in sync with the RPC functions).
  const showForward = isProjectManager && status === 'submitted';
  const showApprove = isProjectManager && status === 'quoted';
  const showQuote = isTier2 && status === 'forwarded';
  const showOrder = isTier2 && status === 'approved';
  const showReceived =
    (isOperator || isProjectManager) && status === 'ordered';
  // Cancel allowed at every "live" step the role can act on.
  const showCancel =
    (isOperator && status === 'submitted') ||
    (isProjectManager && ['submitted', 'forwarded', 'quoted', 'approved', 'ordered'].includes(status)) ||
    (isTier2 && ['forwarded', 'quoted', 'approved', 'ordered'].includes(status));

  const noActions = !showForward && !showApprove && !showQuote && !showOrder && !showReceived && !showCancel;
  if (noActions) return null;

  return (
    <>
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {showCancel && (
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
            <XCircle className="w-4 h-4" />
            Отменить
          </Button>
        )}

        {showForward && (
          <Button onClick={() => callRpc('forward_parts_request', { p_id: requestId })}>
            <Send className="w-4 h-4" />
            Переслать в НПГМ
          </Button>
        )}

        {showQuote && (
          <Button onClick={() => setQuoteOpen(true)}>
            <QuoteIcon className="w-4 h-4" />
            Прислать КП
          </Button>
        )}

        {showApprove && (
          <Button onClick={() => callRpc('approve_parts_request', { p_id: requestId })}>
            <CheckCircle2 className="w-4 h-4" />
            Принять КП
          </Button>
        )}

        {showOrder && (
          <Button onClick={() => setOrderOpen(true)}>
            <Truck className="w-4 h-4" />
            Разместить заказ
          </Button>
        )}

        {showReceived && (
          <Button onClick={() => setReceivedOpen(true)}>
            <PackageCheck className="w-4 h-4" />
            Получено
          </Button>
        )}
      </div>

      <QuoteDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        onSubmit={async (notes, amount, currency) => {
          await callRpc('quote_parts_request', {
            p_id: requestId,
            p_notes: notes,
            p_total_amount: amount,
            p_currency: currency,
          });
        }}
      />

      <OrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        onSubmit={async (eta) => {
          await callRpc('mark_parts_request_ordered', { p_id: requestId, p_eta: eta });
        }}
      />

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onSubmit={async (reason) => {
          await callRpc('cancel_parts_request', { p_id: requestId, p_reason: reason || null });
        }}
      />

      <MarkReceivedDialog
        open={receivedOpen}
        onOpenChange={setReceivedOpen}
        companyId={companyId}
        onSubmit={async (qty, photoUrl, notes) => {
          await callRpc('mark_parts_request_received', {
            p_id: requestId,
            p_quantity_text: qty,
            p_photo_url: photoUrl,
            p_notes: notes,
          });
        }}
      />
    </>
  );
}
