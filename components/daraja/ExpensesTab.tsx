// components/daraja/ExpensesTab.tsx
"use client";
import { CursorList } from "@/components/daraja/CursorList";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatMoney, formatDateTime } from "@/lib/format";
import type { ExpenseRow } from "@/types/daraja";

export function ExpensesTab({ employerId }: { employerId: string }) {
  return (
    <CursorList<ExpenseRow>
      path={`/employers/${employerId}/expenses/`}
      rowKey={(e) => e.expense_id}
      emptyMessage="No expenses yet."
      columns={[
        { key: "expense_date", header: "When",
          render: (e) => formatDateTime(e.expense_date) },
        { key: "expense_type", header: "Type" },
        { key: "description", header: "Description" },
        { key: "amount", header: "Amount",
          render: (e) => formatMoney(Number(e.amount)) },
        { key: "status", header: "Status",
          render: (e) => <StatusBadge variant={
            e.status === "Success" ? "success"
              : e.status?.startsWith("Failed") ? "danger" : "warning"
          }>{e.status}</StatusBadge> },
        { key: "payout_state", header: "Payout",
          render: (e) => e.payout_state ?? "—" },
      ]}
    />
  );
}
