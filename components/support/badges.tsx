import { StatusBadge } from "@/components/ui/status_badge";
import type { IssuePriority, IssueStatus } from "@/types/admin";

/**
 * Tiny local badge helpers for support issues. Deliberately separate from
 * `StatusBadgeFor` (which covers loan/borrower statuses) since issue
 * status/priority have their own vocab and variant rules.
 */

const STATUS_LABELS: Record<IssueStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_LABELS: Record<IssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const variant =
    status === "resolved"
      ? "success"
      : status === "open" || status === "investigating"
        ? "warning"
        : "neutral";
  return <StatusBadge variant={variant}>{STATUS_LABELS[status] ?? status}</StatusBadge>;
}

export function IssuePriorityBadge({ priority }: { priority: IssuePriority }) {
  const variant = priority === "urgent" ? "danger" : priority === "high" ? "warning" : "neutral";
  return <StatusBadge variant={variant}>{PRIORITY_LABELS[priority] ?? priority}</StatusBadge>;
}
