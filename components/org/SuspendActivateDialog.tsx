"use client";
import { toast } from "sonner";
import api from "@/lib/axiosInstance";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import type { OrgStatus } from "@/types/admin";

export interface SuspendActivateDialogProps {
  org: { id: string; status: OrgStatus; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

export function SuspendActivateDialog({ org, open, onOpenChange, onDone }: SuspendActivateDialogProps) {
  const isActive = org.status === "active";

  const handleConfirm = async (reason: string) => {
    try {
      if (isActive) {
        await api.post(`/admin/organizations/${org.id}/suspend/`, { reason });
        toast.success(`${org.name} has been suspended`);
      } else {
        await api.post(`/admin/organizations/${org.id}/activate/`, { reason: reason || undefined });
        toast.success(`${org.name} has been activated`);
      }
      onDone();
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast.error(detail ?? "Action failed");
      throw err;
    }
  };

  return (
    <DangerousActionModal
      open={open}
      onOpenChange={onOpenChange}
      title={isActive ? `Suspend ${org.name}` : `Activate ${org.name}`}
      impact={
        isActive
          ? "Members of this MFI will be blocked from signing in and using Ankara until reactivated."
          : "This MFI regains full access to Ankara."
      }
      confirmLabel={isActive ? "Suspend" : "Activate"}
      requireReason={isActive}
      onConfirm={handleConfirm}
    />
  );
}
