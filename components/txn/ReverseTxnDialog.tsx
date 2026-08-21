"use client";
import { toast } from "sonner";
import api from "@/lib/axiosInstance";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { formatMoney } from "@/lib/format";

export interface ReverseTxnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  txn: { id: string; name?: string; amount?: string } | null;
  onDone: () => void;
}

export function ReverseTxnDialog({ open, onOpenChange, txn, onDone }: ReverseTxnDialogProps) {
  const handleConfirm = async (reason: string) => {
    if (!txn) return;
    try {
      await api.post(`/admin/transactions/${txn.id}/reverse/`, { reason });
      toast.success("Transaction reversed");
      onDone();
    } catch (err: unknown) {
      const response =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { status?: number; data?: { detail?: string } } }).response
          : undefined;
      if (response?.status === 409) {
        toast.error("This transaction has already been reversed.");
      } else {
        toast.error(response?.data?.detail ?? "Reversal failed");
      }
      throw err;
    }
  };

  return (
    <DangerousActionModal
      open={open}
      onOpenChange={onOpenChange}
      title="Reverse transaction"
      impact={
        <>
          This creates a compensating ledger entry for the opposite amount
          {txn?.amount ? <> (<span className="font-medium text-text">{formatMoney(txn.amount)}</span>)</> : null}
          {txn?.name ? <> — {txn.name}</> : null}. The original transaction is never edited or
          deleted. This cannot be undone from here.
        </>
      }
      confirmLabel="Reverse"
      requireReason
      onConfirm={handleConfirm}
    />
  );
}
