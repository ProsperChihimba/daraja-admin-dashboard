"use client";
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import api from "@/lib/axiosInstance";
import { useAdminResource } from "@/lib/useAdminResource";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import type { Package } from "@/types/admin";

/** "" (from a cleared number input) becomes undefined before numeric coercion. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const paymentSchema = z.object({
  package_id: z.string().min(1, "Select a package"),
  amount: z.preprocess(emptyToUndefined, z.coerce.number().min(0, "Must be 0 or more").optional()),
  method: z.enum(["mobile", "cash", "bank", "other"]),
  reference: z.string().optional(),
  note: z.string().optional(),
});

type PaymentFormInput = z.input<typeof paymentSchema>;
type PaymentValues = z.output<typeof paymentSchema>;

const DEFAULTS: PaymentFormInput = {
  package_id: "",
  amount: undefined,
  method: "other",
  reference: "",
  note: "",
};

function extractErrorMessage(data: unknown): string {
  if (!data) return "Failed to record payment";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(" ");
  if (typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(" ") : String(val)}`)
      .join("; ");
  }
  return "Failed to record payment";
}

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onDone: () => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  organizationId,
  onDone,
}: RecordPaymentDialogProps) {
  const { data: packages, loading: packagesLoading } = useAdminResource<Package[]>(
    "/admin/packages/",
  );
  const [submitting, setSubmitting] = React.useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PaymentFormInput, unknown, PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: DEFAULTS,
  });

  React.useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const onSubmit = async (values: PaymentValues) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        organization_id: organizationId,
        package_id: values.package_id,
        amount: values.amount ?? undefined,
        method: values.method,
        reference: values.reference || undefined,
        note: values.note || undefined,
      };
      await api.post("/admin/payments/record/", payload);
      toast.success("Payment recorded");
      onDone();
    } catch (err: unknown) {
      const data =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : undefined;
      toast.error(extractErrorMessage(data));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-package">Package</Label>
            <Controller
              control={control}
              name="package_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={packagesLoading}>
                  <SelectTrigger id="payment-package" className="w-full">
                    <SelectValue placeholder={packagesLoading ? "Loading…" : "Select a package"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(packages ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatMoney(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.package_id && (
              <p className="text-xs text-danger-fg">{errors.package_id.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-amount">Amount (TZS)</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Defaults to package price"
              aria-invalid={!!errors.amount}
              {...register("amount")}
            />
            {errors.amount && <p className="text-xs text-danger-fg">{errors.amount.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-method">Method</Label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="payment-method" className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-reference">Reference</Label>
            <Input id="payment-reference" placeholder="Optional transaction reference" {...register("reference")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-note">Note</Label>
            <Input id="payment-note" placeholder="Optional note" {...register("note")} />
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
