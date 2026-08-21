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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const issueSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  category: z.enum(["loan", "payment", "account", "data", "technical", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  reporter_name: z.string().optional(),
  reporter_phone: z.string().optional(),
});

type IssueFormValues = z.infer<typeof issueSchema>;

const DEFAULTS: IssueFormValues = {
  title: "",
  description: "",
  category: "other",
  priority: "medium",
  reporter_name: "",
  reporter_phone: "",
};

function extractErrorMessage(data: unknown): string {
  if (!data) return "Failed to create issue";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(" ");
  if (typeof data === "object") {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(" ") : String(val)}`)
      .join("; ");
  }
  return "Failed to create issue";
}

export interface CreateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  defaultOrganization?: string;
}

export function CreateIssueDialog({
  open,
  onOpenChange,
  onDone,
  defaultOrganization,
}: CreateIssueDialogProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: DEFAULTS,
  });

  React.useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const onSubmit = async (values: IssueFormValues) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: values.title,
        description: values.description || undefined,
        category: values.category,
        priority: values.priority,
        reporter_name: values.reporter_name || undefined,
        reporter_phone: values.reporter_phone || undefined,
      };
      if (defaultOrganization) payload.organization = defaultOrganization;
      await api.post("/admin/issues/", payload);
      toast.success("Issue created");
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
          <DialogTitle>New issue</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue-title">Title</Label>
            <Input
              id="issue-title"
              placeholder="Short summary of the issue"
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            {errors.title && <p className="text-xs text-danger-fg">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue-description">Description</Label>
            <Textarea
              id="issue-description"
              placeholder="Details about what happened"
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-category">Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="issue-category" className="w-full">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loan">Loan</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-priority">Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="issue-priority" className="w-full">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-reporter-name">Reporter name</Label>
              <Input id="issue-reporter-name" {...register("reporter_name")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue-reporter-phone">Reporter phone</Label>
              <Input id="issue-reporter-phone" {...register("reporter_phone")} />
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
