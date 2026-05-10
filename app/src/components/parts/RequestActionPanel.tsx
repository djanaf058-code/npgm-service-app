'use client';

import { useState } from 'react';
import {
  Send,
  Quote as QuoteIcon,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSPASassClient } from '@/lib/supabase/client';
import { useRole } from '@/lib/context/GlobalContext';
import {
  QuoteDialog,
  OrderDialog,
  CancelDialog,
  MarkReceivedDialog,
} from './RequestDialogs';
import type { PartsRequestKind, PartsRequestStatus } from '@/lib/types';

interface Props {
  requestId: string;
  status: PartsRequestStatus;
  kind: PartsRequestKind;
  companyId: string;
  // Called after a successful RPC so the parent page reloads.
  onChanged: () => void;
  onError: (msg: string) => void;
}

// Wraps supabase RPC errors into Error so dialogs surface them.
async function rpc<T = unknown>(
  fn: string,
  args: Record<string, unknown>
): Promise<T> {
  const client = await createSPASassClient();
  const supabase = client.getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) {
    throw new Error(error.message || JSON.stringify(error));
  }
  return data as T;
}

export function RequestActionPanel({
  requestId,
  status,
  kind,
  companyId,
  onChanged,
  onError,
}: Props) {
  const {
    isOperator,
    isServiceEngineer,
    isProjectManager,
    isPlatformAdmin,
  } = useRole();

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receivedOpen, setReceivedOpen] = useState(false);

  const callRpc = async (fn: string, args: Record<string, unknown>) => {
    try {
      await rpc(fn, args);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  // Final statuses — no actions to surface.
  if (status === 'received' || status === 'cancelled' || status === 'consolidated') {
    return null;
  }

  // ===== Visibility matrix (kept dense and explicit so the rules are readable) =====
  // Operator-level row (kind='operator'):
  const showOperatorCancel =
    kind === 'operator' && isOperator && status === 'submitted';

  // Consolidated-level rows (kind='consolidated'):
  const showSubmitToPm =
    kind === 'consolidated' && isServiceEngineer && status === 'drafting';
  const showApproveScope =
    kind === 'consolidated' && isProjectManager && status === 'pending_pm';
  const showAcceptQuote =
    kind === 'consolidated' && isProjectManager && status === 'quoted';
  const showSendQuote =
    kind === 'consolidated' && isPlatformAdmin && status === 'forwarded';
  const showPlaceOrder =
    kind === 'consolidated' && isPlatformAdmin && status === 'approved';
  const showMarkReceived =
    kind === 'consolidated' &&
    (isOperator || isServiceEngineer || isProjectManager) &&
    status === 'ordered';

  // Cancel buttons: each role can cancel only at its step (matches the RPC).
  const canCancel =
    (isOperator && kind === 'operator' && status === 'submitted') ||
    (isServiceEngineer &&
      kind === 'consolidated' &&
      ['drafting', 'pending_pm'].includes(status)) ||
    (isProjectManager &&
      ['drafting', 'pending_pm', 'forwarded', 'quoted', 'approved'].includes(status)) ||
    (isPlatformAdmin &&
      ['drafting', 'pending_pm', 'forwarded', 'quoted', 'approved', 'ordered'].includes(status));

  const noActions =
    !showOperatorCancel &&
    !showSubmitToPm &&
    !showApproveScope &&
    !showAcceptQuote &&
    !showSendQuote &&
    !showPlaceOrder &&
    !showMarkReceived &&
    !canCancel;
  if (noActions) return null;

  return (
    <>
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {canCancel && (
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
            <XCircle className="w-4 h-4" />
            Отменить
          </Button>
        )}

        {(showOperatorCancel) && null /* cancel button above already covers this case */}

        {showSubmitToPm && (
          <Button onClick={() => callRpc('submit_consolidated_to_pm', { p_id: requestId })}>
            <Send className="w-4 h-4" />
            Отправить PM
          </Button>
        )}

        {showApproveScope && (
          <Button onClick={() => callRpc('pm_approve_scope', { p_id: requestId })}>
            <Send className="w-4 h-4" />
            Согласовать scope
          </Button>
        )}

        {showSendQuote && (
          <Button onClick={() => setQuoteOpen(true)}>
            <QuoteIcon className="w-4 h-4" />
            Прислать КП
          </Button>
        )}

        {showAcceptQuote && (
          <Button onClick={() => callRpc('pm_accept_quote', { p_id: requestId })}>
            <CheckCircle2 className="w-4 h-4" />
            Принять КП
          </Button>
        )}

        {showPlaceOrder && (
          <Button onClick={() => setOrderOpen(true)}>
            <Truck className="w-4 h-4" />
            Разместить заказ
          </Button>
        )}

        {showMarkReceived && (
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
