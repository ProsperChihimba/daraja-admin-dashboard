// components/daraja/WalletTab.tsx
//
// ONE STATEMENT PER WALLET, not one merged list.
//
// This tab used to read `/employers/<id>/statement/`: every ledger entry
// belonging to the merchant, from ALL of their wallets, in one table with no
// balances. The missing balance was not an oversight -- a merchant with
// branches holds a main wallet plus one per branch, and a running balance
// across several accounts is not a number that exists. Merging them made the
// balance unrenderable, and the merged list could not answer the question an
// operator opens this tab with: what does THIS wallet hold, and how did it
// get there.
//
// So the tab reads the wallet tree and renders the real statement for each
// wallet -- the same `/wallets/<account_id>/statement/` the wallet detail page
// uses, with Before / Credited / Debited / After per line and its own summary.
// Every figure comes from the backend; nothing here sums or subtracts money.
"use client";
import * as React from "react";

import { CursorList } from "@/components/daraja/CursorList";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatDateTime } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
import { useDarajaResource } from "@/lib/darajaAuth";
import type {
  DepositRow, EmployerWalletRow, EmployerWalletTree,
  WalletStatementLine, WalletStatementPage,
} from "@/types/daraja";

const statementColumns: Column<WalletStatementLine>[] = [
  { key: "registered", header: "When", render: (l) => formatDateTime(l.registered) },
  {
    key: "narration",
    header: "Narration",
    className: "whitespace-normal",
    render: (l) => l.narration || "—",
  },
  {
    key: "kind",
    header: "Kind",
    render: (l) => <StatusBadge variant="neutral">{l.kind}</StatusBadge>,
  },
  // BEFORE -> movement -> AFTER. A single balance column states only where the
  // wallet ended and leaves the reader to infer the origin from the row above,
  // which fails at the top of the window where there is no row above.
  {
    key: "balance_before",
    header: "Before",
    className: "text-text-muted",
    render: (l) => formatOpsMoney(l.balance_before),
  },
  { key: "amountCredited", header: "Credited", render: (l) => formatOpsMoney(l.amountCredited) },
  { key: "amountDebited", header: "Debited", render: (l) => formatOpsMoney(l.amountDebited) },
  { key: "balance_after", header: "After", render: (l) => formatOpsMoney(l.balance_after) },
];

/** One wallet: what it holds, and how it got there. */
function WalletStatement({ wallet, label }: { wallet: EmployerWalletRow; label: string }) {
  const { data, loading, error, refetch } = useDarajaResource<WalletStatementPage>(
    `/wallets/${wallet.account_id}/statement/`,
  );

  return (
    <section className="rounded-card border border-border-soft bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="font-heading text-sm font-semibold text-text">{label}</h4>
        <span className="font-mono text-xs text-text-muted">
          {wallet.account_no || "no account number"}
        </span>
        {wallet.active ? null : <StatusBadge variant="neutral">inactive</StatusBadge>}
        {/* WHICH BOOK ANSWERED. A migrated wallet's lines come from the ledger
            and an unmigrated one's from the legacy table; the rows look
            identical either way, so the two are only distinguishable here. */}
        {data ? <StatusBadge variant="neutral">{data.source}</StatusBadge> : null}
        <span className="ml-auto text-text">{formatOpsMoney(wallet.balance)}</span>
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : !data ? null : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([
              ["Opening", data.summary.opening_balance],
              ["Money in", data.summary.money_in],
              ["Money out", data.summary.money_out],
              ["Fees", data.summary.total_fees],
              ["Closing", data.summary.closing_balance],
            ] as const).map(([name, value]) => (
              <div key={name}>
                <div className="text-xs text-text-muted">{name}</div>
                <div className="text-text">{formatOpsMoney(value)}</div>
              </div>
            ))}
          </div>
          {data.results.length === 0 ? (
            <EmptyState message="No movements on this wallet in the last 30 days." />
          ) : (
            <DataTable
              columns={statementColumns}
              rows={data.results}
              rowKey={(l) => l.transaction_id}
            />
          )}
        </>
      )}
    </section>
  );
}

export function WalletTab({ employerId }: { employerId: string }) {
  const { data, loading, error, refetch } = useDarajaResource<EmployerWalletTree>(
    `/employers/${employerId}/wallets/`,
  );

  // `main_wallet` can be null: an employer whose wallets are all branch-owned,
  // or one with no wallet at all. Both are ordinary states, not errors, so
  // neither may render as a failure.
  const wallets: Array<{ wallet: EmployerWalletRow; label: string }> = React.useMemo(() => {
    if (!data) return [];
    const rows = data.main_wallet
      ? [{ wallet: data.main_wallet, label: "Main wallet" }]
      : [];
    for (const w of data.branch_wallets) {
      rows.push({ wallet: w, label: w.branch ? w.branch.name : "Other wallet" });
    }
    return rows;
  }, [data]);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="font-heading text-sm font-semibold text-text">Wallets</h3>
          {data ? (
            <span className="text-xs text-text-muted">
              {wallets.length === 1 ? "1 wallet" : `${wallets.length} wallets`} · total{" "}
              {formatOpsMoney(data.total_balance)}
            </span>
          ) : null}
        </div>

        {error && !data ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : wallets.length === 0 ? (
          <EmptyState message="This merchant has no wallets." />
        ) : (
          <div className="space-y-4">
            {wallets.map(({ wallet, label }) => (
              <WalletStatement key={wallet.account_id} wallet={wallet} label={label} />
            ))}
          </div>
        )}
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
