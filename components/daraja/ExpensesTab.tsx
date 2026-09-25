// components/daraja/ExpensesTab.tsx -- a merchant's expenses, and the one
// control that can hand back the shillings of a Lipa Namba till payment that
// never landed.
//
// WHY THE REVERSAL LIVES HERE. A stuck Lipa Namba payment is visible to an
// operator as an expense of this merchant's that has not reached Success --
// the ledger already moved their money and nTZS has not confirmed the till
// was paid (the same condition `dashboard.alerts.detectors.lipa_stuck` pages
// on as an IMPORTANT alert after 30 minutes). This is the screen someone is
// already on when they ask "why is this merchant's payment still pending",
// so the control goes here rather than on a new screen nobody would open.
//
// WHAT THIS TAB CANNOT DO, AND WHY THE ID IS TYPED. The rows below are
// `Expenses`, and `expense_id` is NOT `payment_id`: the dashboard API does
// not serialise the LipaPayment row at all today, so this screen cannot list
// payment ids and does not pretend to. The reversal asks for the payment_id
// -- which is also the nTZS Idempotency-Key, and therefore the string the
// operator has in front of them on nTZS's own dashboard while they are
// gathering the evidence the request requires.
"use client";
import * as React from "react";
import { CursorList } from "@/components/daraja/CursorList";
import { ReversalPanel, LIPA_REVERSE } from "@/components/daraja/ReversalRequest";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatDateTime } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
import {
  getActionCatalogue,
  type ActionCatalogueEntry,
} from "@/lib/darajaActions";
import type { ExpenseRow } from "@/types/daraja";

export function ExpensesTab({ employerId }: { employerId: string }) {
  const [catalogue, setCatalogue] = React.useState<ActionCatalogueEntry[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    // "So the UI never renders a button that would 403" -- ActionCatalogue's
    // own docstring. `may_request` is computed with the same _may() the
    // create endpoint checks, so a button hidden here truly could not have
    // been used. A failed catalogue read shows no button rather than guessing
    // that this account may return somebody's money.
    getActionCatalogue()
      .then((rows) => { if (!cancelled) setCatalogue(rows); })
      .catch(() => { if (!cancelled) setCatalogue([]); });
    return () => { cancelled = true; };
  }, []);

  const mayReverse =
    catalogue?.some((c) => c.action_type === LIPA_REVERSE && c.may_request) ?? false;

  return (
    <>
      <ReversalPanel kind="lipa" may={mayReverse} />

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
    </>
  );
}
