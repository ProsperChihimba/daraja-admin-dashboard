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
import type { Package } from "@/types/admin";

const packageSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce
    .number({ error: "Enter a valid price" })
    .min(0, "Price must be 0 or more"),
  duration_days: z.coerce
    .number({ error: "Enter a valid number" })
    .int("Must be a whole number")
    .min(1, "Must be at least 1 day"),
  is_active: z.boolean(),
  sort_order: z.coerce
    .number({ error: "Enter a valid number" })
    .int("Must be a whole number")
    .min(0, "Must be 0 or more"),
});

type PackageFormInput = z.input<typeof packageSchema>;
type PackageValues = z.output<typeof packageSchema>;

const DEFAULTS: PackageFormInput = {
  name: "",
  description: "",
  price: 0,
  duration_days: 30,
  is_active: true,
  sort_order: 0,
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

export interface PackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  package?: Package | null;
  onDone: () => void;
}

export function PackageDialog({ open, onOpenChange, package: pkg, onDone }: PackageDialogProps) {
  const isEdit = !!pkg;
  const [submitting, setSubmitting] = React.useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PackageFormInput, unknown, PackageValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: DEFAULTS,
  });

  React.useEffect(() => {
    if (!open) return;
    reset(
      pkg
        ? {
            name: pkg.name,
            description: pkg.description ?? "",
            price: Number(pkg.price),
            duration_days: pkg.duration_days,
            is_active: pkg.is_active,
            sort_order: pkg.sort_order,
          }
        : DEFAULTS,
    );
  }, [open, pkg, reset]);

  const onSubmit = async (values: PackageValues) => {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        description: values.description ?? "",
        price: values.price,
        duration_days: values.duration_days,
        is_active: values.is_active,
        sort_order: values.sort_order,
      };
      if (isEdit && pkg) {
        await api.patch(`/admin/packages/${pkg.id}/`, payload);
        toast.success(`${values.name} updated`);
      } else {
        await api.post("/admin/packages/", payload);
        toast.success(`${values.name} created`);
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
          <DialogTitle>{isEdit ? "Edit package" : "New package"}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pkg-name">Name</Label>
            <Input id="pkg-name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-xs text-danger-fg">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pkg-description">Description</Label>
            <Textarea id="pkg-description" {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-price">Price (TZS)</Label>
              <Input
                id="pkg-price"
                type="number"
                step="0.01"
                min="0"
                aria-invalid={!!errors.price}
                {...register("price")}
              />
              {errors.price && <p className="text-xs text-danger-fg">{errors.price.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-duration">Duration (days)</Label>
              <Input
                id="pkg-duration"
                type="number"
                min="1"
                step="1"
                aria-invalid={!!errors.duration_days}
                {...register("duration_days")}
              />
              {errors.duration_days && (
                <p className="text-xs text-danger-fg">{errors.duration_days.message}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pkg-sort-order">Sort order</Label>
            <Input
              id="pkg-sort-order"
              type="number"
              min="0"
              step="1"
              className="max-w-32"
              aria-invalid={!!errors.sort_order}
              {...register("sort_order")}
            />
            {errors.sort_order && (
              <p className="text-xs text-danger-fg">{errors.sort_order.message}</p>
            )}
          </div>
          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Label htmlFor="pkg-is-active" className="cursor-pointer">
                <Checkbox
                  id="pkg-is-active"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                Active — visible to new subscriptions
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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
