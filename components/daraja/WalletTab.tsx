// components/daraja/WalletTab.tsx
"use client";
import { CursorList } from "@/components/daraja/CursorList";
import { formatDateTime } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
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
            // Entry.amount is a Decimal serialized as a string -- handed to
            // the formatter as the string it is, never through Number()
            // first. THE 2-DECIMAL COLUMN: Entry.amount is
            // DecimalField(20,2) and carries the ledger legs of a card load,
            // so 2,512.47 and 0.30 are both ordinary here. The shared
            // formatMoney rounded them to "TZS 2,512" and "TZS 0" -- this
            // column is exactly why the ops screens have their own formatter
            // (lib/darajaMoney.ts). Signed, too: a debit renders negative.
            { key: "amount", header: "Amount",
              render: (e) => formatOpsMoney(e.amount) },
            // Movement.reference is `blank=True, default=""`
            // (wallets/models.py:58) -- a movement recorded without one is
            // ordinary, and rendered a blank cell that reads as a broken
            // screen. `||`, not `??`: the empty string is the live value
            // here, exactly as on the Deposits "From" column below (M3).
            { key: "reference", header: "Reference",
              render: (e) => (
                <span className="font-mono text-xs">{e.reference || "—"}</span>
              ) },
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
              render: (d) => formatOpsMoney(d.amount) },
            { key: "state", header: "State" },
            // DepositIntent.source_account_number defaults to "" rather than
            // NULL (wallets/models.py), so a legacy intent renders a blank
            // cell that reads as a rendering bug. `||`, not `??` (M6).
            { key: "source_account_number", header: "From",
              render: (d) => d.source_account_number || "—" },
          ]}
        />
      </section>
    </div>
  );
}
