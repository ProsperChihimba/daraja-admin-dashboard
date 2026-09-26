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
      {/* THE BODY SCROLLS; THE TITLE AND THE BUTTONS DO NOT.
        *
        * DialogContent is a fixed, centred `grid` with no max-height, so a tall
        * body ran off the viewport in both directions with nothing scrollable --
        * reported on the universal-rate dialog, which is the tallest, but it was
        * every confirm dialog in this app, including the approve dialogs for
        * money actions. Someone who cannot reach Confirm cannot approve, and
        * someone who cannot scroll cannot read the warning they are approving
        * against.
        *
        * Capping the whole content and scrolling THAT would let Confirm scroll
        * out of sight. Three grid rows instead -- header, body, footer -- with
        * only the middle one scrolling, so the action stays reachable and the
        * title stays visible above whatever you are reading.
        *
        * minmax(0,1fr), not 1fr: a grid row will not shrink below its content
        * without it, and the overflow would never engage. Same trap as min-h-0
        * in flexbox. */}
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
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
        </div>
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
