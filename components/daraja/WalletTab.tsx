// components/daraja/WalletTab.tsx
"use client";
import { CursorList } from "@/components/daraja/CursorList";
import { formatMoney, formatDateTime } from "@/lib/format";
import type { DepositRow, EntryRow } from "@/types/daraja";

export function WalletTab({ employerId }: { employerId: string }) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-2 font-heading text-sm font-semibold text-text">Statement</h3>
        <CursorList<EntryRow>
          path={`/employers/${employerId}/statement/`}
          rowKey={(e) => e.entry_id}
          emptyMessage="No ledger entries for this merchant."
          columns={[
            { key: "created", header: "When",
              render: (e) => formatDateTime(e.created) },
            { key: "movement_kind", header: "Movement" },
            { key: "amount", header: "Amount",
              render: (e) => formatMoney(Number(e.amount)) },
            { key: "reference", header: "Reference",
              render: (e) => <span className="font-mono text-xs">{e.reference}</span> },
          ]}
        />
      </section>
      <section>
        <h3 className="mb-2 font-heading text-sm font-semibold text-text">Deposits</h3>
        <CursorList<DepositRow>
          path={`/employers/${employerId}/deposits/`}
          rowKey={(d) => d.intent_id}
          emptyMessage="No deposits yet."
          columns={[
            { key: "registered", header: "When",
              render: (d) => formatDateTime(d.registered) },
            { key: "amount", header: "Amount",
              render: (d) => formatMoney(Number(d.amount)) },
            { key: "state", header: "State" },
            { key: "source_account_number", header: "From" },
          ]}
        />
      </section>
    </div>
  );
}
