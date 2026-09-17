// components/daraja/ExpensesTab.tsx
"use client";
import { CursorList } from "@/components/daraja/CursorList";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatDateTime } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
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
        // Expenses.amount really is a JSON number here (FloatField), unlike
        // every other money field on these tabs -- see ExpenseRow.amount.
        // formatOpsMoney takes it as the number it is and still shows every
        // decimal it carries; the shared formatMoney rounded 2,512.47 to
        // "TZS 2,512" (lib/darajaMoney.ts).
        { key: "amount", header: "Amount",
          render: (e) => formatOpsMoney(e.amount) },
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
