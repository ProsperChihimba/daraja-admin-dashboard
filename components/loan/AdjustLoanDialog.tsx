"use client";
import * as React from "react";
import { toast } from "sonner";

import api from "@/lib/axiosInstance";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoanStatus } from "@/types/admin";

export interface AdjustLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: {
    id: string;
    loan_id: string;
    status: LoanStatus;
    outstanding: string;
    amount_paid: string;
    total_payable: string;
  };
  onDone: () => void;
}

const STATUS_OPTIONS: { value: LoanStatus; label: string }[] = [
  { value: "owed", label: "Owed" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

function fieldErrorsFromDetail(detail: unknown): Record<string, string> {
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return Object.fromEntries(
      Object.entries(detail as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    );
  }
  return {};
}

export function AdjustLoanDialog({ open, onOpenChange, loan, onDone }: AdjustLoanDialogProps) {
  const [status, setStatus] = React.useState<LoanStatus>(loan.status);
  const [outstanding, setOutstanding] = React.useState(loan.outstanding);
  const [amountPaid, setAmountPaid] = React.useState(loan.amount_paid);
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setStatus(loan.status);
    setOutstanding(loan.outstanding);
    setAmountPaid(loan.amount_paid);
    setReason("");
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan.id]);

  const totalPayable = Number(loan.total_payable);

  const statusChanged = status !== loan.status;
  const outstandingChanged = outstanding !== loan.outstanding;
  const amountPaidChanged = amountPaid !== loan.amount_paid;
  const hasChanges = statusChanged || outstandingChanged || amountPaidChanged;

  const outstandingNum = Number(outstanding);
  const amountPaidNum = Number(amountPaid);

  const clientErrors: Record<string, string> = {};
  if (outstandingChanged) {
    if (outstanding.trim() === "" || Number.isNaN(outstandingNum)) {
      clientErrors.outstanding = "Enter a valid number";
    } else if (outstandingNum < 0) {
      clientErrors.outstanding = "Must be 0 or more";
    }
  }
  if (amountPaidChanged) {
    if (amountPaid.trim() === "" || Number.isNaN(amountPaidNum)) {
      clientErrors.amount_paid = "Enter a valid number";
    } else if (amountPaidNum < 0) {
      clientErrors.amount_paid = "Must be 0 or more";
    } else if (!Number.isNaN(totalPayable) && amountPaidNum > totalPayable) {
      clientErrors.amount_paid = "Cannot exceed total payable";
    }
  }
  const reasonTrimmed = reason.trim();
  if (reasonTrimmed === "") clientErrors.reason = "Reason is required";

  const submitDisabled = submitting || !hasChanges || Object.keys(clientErrors).length > 0;

  const handleSubmit = async () => {
    if (submitDisabled) {
      if (!hasChanges) toast.error("Nothing to adjust");
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      const payload: Record<string, unknown> = { reason: reasonTrimmed };
      if (statusChanged) payload.status = status;
      if (outstandingChanged) payload.outstanding = outstandingNum;
      if (amountPaidChanged) payload.amount_paid = amountPaidNum;

      await api.post(`/admin/loans/${loan.id}/adjust/`, payload);
      toast.success("Loan adjusted");
      onDone();
      onOpenChange(false);
    } catch (err: unknown) {
      const response =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { code?: string; detail?: unknown } } }).response
          : undefined;
      const data = response?.data;
      if (data?.code === "invalid_adjustment") {
        const errs = fieldErrorsFromDetail(data.detail);
        setFieldErrors(errs);
        toast.error(
          Object.values(errs).join("; ") || "Invalid adjustment",
        );
      } else if (data?.code === "nothing_to_adjust") {
        toast.error("Nothing to adjust");
      } else {
        const detail = typeof data?.detail === "string" ? data.detail : undefined;
        toast.error(detail ?? "Adjustment failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust loan {loan.loan_id}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-warning-bg bg-warning-bg/40 px-3 py-2 text-xs text-warning-fg">
          Direct loan-record correction. Use only to fix data errors; this does not create ledger
          movements. Recorded in the audit log.
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LoanStatus)}>
              <SelectTrigger id="adj-status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-outstanding">Outstanding</Label>
            <Input
              id="adj-outstanding"
              type="number"
              min="0"
              step="0.01"
              value={outstanding}
              onChange={(e) => setOutstanding(e.target.value)}
              aria-invalid={!!(clientErrors.outstanding || fieldErrors.outstanding)}
              disabled={submitting}
            />
            {(clientErrors.outstanding || fieldErrors.outstanding) && (
              <p className="text-xs text-danger-fg">
                {clientErrors.outstanding || fieldErrors.outstanding}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-amount-paid">Amount paid</Label>
            <Input
              id="adj-amount-paid"
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              aria-invalid={!!(clientErrors.amount_paid || fieldErrors.amount_paid)}
              disabled={submitting}
            />
            {(clientErrors.amount_paid || fieldErrors.amount_paid) && (
              <p className="text-xs text-danger-fg">
                {clientErrors.amount_paid || fieldErrors.amount_paid}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're correcting this record…"
              disabled={submitting}
              aria-invalid={reasonTrimmed === "" && reason.length > 0}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitDisabled}>
            {submitting ? "Saving…" : "Save adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
