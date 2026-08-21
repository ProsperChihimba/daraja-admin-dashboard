"use client";
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DiscountCode } from "@/types/admin";

/** "" (from a cleared number input) becomes undefined before numeric coercion. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const discountSchema = z
  .object({
    code: z.string().min(1, "Code is required"),
    description: z.string().optional(),
    discount_type: z.enum(["percent", "amount"]),
    percent_off: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    amount_off: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
    is_active: z.boolean(),
    valid_until: z.preprocess(emptyToUndefined, z.string().optional()),
    max_uses: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int("Must be a whole number").min(1, "Must be at least 1").optional(),
    ),
  })
  .superRefine((val, ctx) => {
    if (val.discount_type === "percent") {
      if (val.percent_off === undefined || Number.isNaN(val.percent_off)) {
        ctx.addIssue({ code: "custom", path: ["percent_off"], message: "Percent is required" });
      } else if (val.percent_off <= 0 || val.percent_off > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["percent_off"],
          message: "Must be greater than 0 and at most 100",
        });
      }
    } else {
      if (val.amount_off === undefined || Number.isNaN(val.amount_off) || val.amount_off < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["amount_off"],
          message: "Amount must be 0 or more",
        });
      }
    }
  });

type DiscountFormInput = z.input<typeof discountSchema>;
type DiscountValues = z.output<typeof discountSchema>;

const DEFAULTS: DiscountFormInput = {
  code: "",
  description: "",
  discount_type: "percent",
  percent_off: undefined,
  amount_off: undefined,
  is_active: true,
  valid_until: undefined,
  max_uses: undefined,
};

function extractErrorMessage(data: unknown): string {
  if (!data) return "Save failed";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(" ");
  if (typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(" ") : String(val)}`)
      .join("; ");
  }
  return "Save failed";
}

export interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discount?: DiscountCode | null;
  onDone: () => void;
}

export function DiscountDialog({ open, onOpenChange, discount, onDone }: DiscountDialogProps) {
  const isEdit = !!discount;
  const [submitting, setSubmitting] = React.useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<DiscountFormInput, unknown, DiscountValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: DEFAULTS,
  });

  const discountType = watch("discount_type");

  React.useEffect(() => {
    if (!open) return;
    reset(
      discount
        ? {
            code: discount.code,
            description: discount.description ?? "",
            discount_type: discount.percent_off != null ? "percent" : "amount",
            percent_off: discount.percent_off != null ? Number(discount.percent_off) : undefined,
            amount_off: discount.amount_off != null ? Number(discount.amount_off) : undefined,
            is_active: discount.is_active,
            valid_until: discount.valid_until ? discount.valid_until.slice(0, 10) : undefined,
            max_uses: discount.max_uses ?? undefined,
          }
        : DEFAULTS,
    );
  }, [open, discount, reset]);

  const onSubmit = async (values: DiscountValues) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        code: values.code,
        description: values.description ?? "",
        is_active: values.is_active,
        valid_until: values.valid_until || null,
        max_uses: values.max_uses ?? null,
        percent_off: values.discount_type === "percent" ? values.percent_off : null,
        amount_off: values.discount_type === "amount" ? values.amount_off : null,
      };
      if (isEdit && discount) {
        await api.patch(`/admin/discounts/${discount.id}/`, payload);
        toast.success(`${values.code.toUpperCase()} updated`);
      } else {
        await api.post("/admin/discounts/", payload);
        toast.success(`${values.code.toUpperCase()} created`);
      }
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
          <DialogTitle>{isEdit ? "Edit discount code" : "New discount code"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="disc-code">Code</Label>
            <Input
              id="disc-code"
              placeholder="e.g. WELCOME10"
              aria-invalid={!!errors.code}
              {...register("code")}
            />
            {errors.code && <p className="text-xs text-danger-fg">{errors.code.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="disc-description">Description</Label>
            <Textarea id="disc-description" {...register("description")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="disc-type">Discount type</Label>
            <Controller
              control={control}
              name="discount_type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="disc-type" className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent off</SelectItem>
                    <SelectItem value="amount">Amount off</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {discountType === "percent" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disc-percent-off">Percent off (%)</Label>
              <Input
                id="disc-percent-off"
                type="number"
                min="0"
                max="100"
                step="0.01"
                aria-invalid={!!errors.percent_off}
                {...register("percent_off")}
              />
              {errors.percent_off && (
                <p className="text-xs text-danger-fg">{errors.percent_off.message}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disc-amount-off">Amount off (TZS)</Label>
              <Input
                id="disc-amount-off"
                type="number"
                min="0"
                step="0.01"
                aria-invalid={!!errors.amount_off}
                {...register("amount_off")}
              />
              {errors.amount_off && (
                <p className="text-xs text-danger-fg">{errors.amount_off.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disc-valid-until">Valid until</Label>
              <Input id="disc-valid-until" type="date" {...register("valid_until")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="disc-max-uses">Max uses</Label>
              <Input
                id="disc-max-uses"
                type="number"
                min="1"
                step="1"
                placeholder="Unlimited"
                aria-invalid={!!errors.max_uses}
                {...register("max_uses")}
              />
              {errors.max_uses && (
                <p className="text-xs text-danger-fg">{errors.max_uses.message}</p>
              )}
            </div>
          </div>

          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Label htmlFor="disc-is-active" className="cursor-pointer">
                <Checkbox
                  id="disc-is-active"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                Active
              </Label>
            )}
          />

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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
