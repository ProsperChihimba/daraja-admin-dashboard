import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";

/**
 * Maps loan/repayment/borrower status strings to a StatusBadge variant +
 * human label. Shared across investigation pages (Task 9a borrowers/loans,
 * Task 9b transactions/search).
 */
const VARIANTS: Record<"loan" | "borrower", Record<string, StatusVariant>> = {
  loan: {
    paid: "success",
    owed: "warning",
    overdue: "danger",
    partial: "warning",
    upcoming: "neutral",
  },
  borrower: {
    overdue: "danger",
    has_debt: "warning",
    no_debt: "neutral",
  },
};

const LABELS: Record<string, string> = {
  paid: "Paid",
  owed: "Owed",
  overdue: "Overdue",
  partial: "Partial",
  upcoming: "Upcoming",
  has_debt: "Has debt",
  no_debt: "No debt",
};

export function StatusBadgeFor({
  status,
  kind = "loan",
}: {
  status: string | null | undefined;
  /** "loan" also covers repayment statuses (paid/owed/overdue/partial/upcoming). */
  kind?: "loan" | "borrower";
}) {
  if (!status) return <StatusBadge variant="neutral">—</StatusBadge>;
  const variant = VARIANTS[kind][status] ?? "neutral";
  const label = LABELS[status] ?? status;
  return <StatusBadge variant={variant}>{label}</StatusBadge>;
}
