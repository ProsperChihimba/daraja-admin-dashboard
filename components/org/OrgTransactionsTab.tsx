"use client";

import * as React from "react";
import { useAdminResource } from "@/lib/useAdminResource";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/ui/status_badge";
import { Button } from "@/components/ui/button";
import { ReverseTxnDialog } from "@/components/txn/ReverseTxnDialog";
import { formatMoney, formatDate } from "@/lib/format";
import type { Paginated, TransactionKind, TransactionRow } from "@/types/admin";

const PAGE_SIZE = 100;

const KIND_LABELS: Record<TransactionKind, string> = {
  mkopo: "Loan disbursed",
  rejesho: "Repayment",
  matumizi: "Expense",
  mtaji: "Capital added",
  adjustment: "Adjustment",
};

/** Org-scoped mtaji ledger with the audited reverse action. */
export function OrgTransactionsTab({ orgId }: { orgId: string }) {
  const [page, setPage] = React.useState(1);
  const [reversingTxn, setReversingTxn] = React.useState<TransactionRow | null>(null);
  const { data, loading, error, refetch } = useAdminResource<Paginated<TransactionRow>>(
    "/admin/transactions/",
    { org: orgId, page },
  );

  const columns: Column<TransactionRow>[] = [
    {
      key: "name",
      header: "Description",
      render: (t) => (
        <div>
          <div className="font-medium text-text">{t.name}</div>
          {t.note ? <div className="text-xs text-text-muted">{t.note}</div> : null}
        </div>
      ),
    },
    {
      key: "kind",
      header: "Type",
      render: (t) => (
        <StatusBadge variant="neutral">
          {KIND_LABELS[t.kind as TransactionKind] ?? t.kind}
        </StatusBadge>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (t) => {
        const prefix = t.direction === "in" ? "+" : t.direction === "out" ? "-" : "";
        return `${prefix}${formatMoney(t.amount)}`;
      },
    },
    { key: "mtaji_after", header: "Balance after", render: (t) => formatMoney(t.mtaji_after) },
    { key: "date", header: "Date", render: (t) => formatDate(t.date) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (t) =>
        t.changes_mtaji ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setReversingTxn(t)}>
              Reverse
            </Button>
          </div>
        ) : null,
    },
  ];

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <DataTable<TransactionRow>
        columns={columns}
        rows={data?.results ?? []}
        loading={loading}
        emptyMessage="No transactions found."
        rowKey={(t) => t.id}
      />
      {data ? (
        <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
      ) : null}

      <ReverseTxnDialog
        open={!!reversingTxn}
        onOpenChange={(o) => {
          if (!o) setReversingTxn(null);
        }}
        txn={reversingTxn}
        onDone={() => {
          setReversingTxn(null);
          void refetch();
        }}
      />
    </>
  );
}
