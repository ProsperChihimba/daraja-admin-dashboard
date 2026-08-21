"use client";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface DangerousActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  impact: React.ReactNode; // plain-language description of consequences
  confirmLabel: string;
  requireReason?: boolean; // default true
  onConfirm: (reason: string) => Promise<void> | void;
}

export function DangerousActionModal({
  open,
  onOpenChange,
  title,
  impact,
  confirmLabel,
  requireReason = true,
  onConfirm,
}: DangerousActionModalProps) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onOpenChange(false);
    } catch {
      // keep the dialog open; caller is expected to surface a toast
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDisabled = submitting || (requireReason && reason.trim() === "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-text-muted">{impact}</div>
        {requireReason ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dangerous-action-reason">Reason</Label>
            <Textarea
              id="dangerous-action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're doing this…"
              disabled={submitting}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
