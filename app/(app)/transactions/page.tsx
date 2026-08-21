"use client";
import * as React from "react";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/ui/status_badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function TransactionsPage() {
  const [page, setPage] = React.useState(1);
  const [kind, setKind] = React.useState<"" | TransactionKind>("");
  const [org, setOrg] = React.useState("");
  const [reversingTxn, setReversingTxn] = React.useState<TransactionRow | null>(null);

  const { data, loading, error, refetch } = useAdminResource<Paginated<TransactionRow>>(
    "/admin/transactions/",
    { page, kind: kind || undefined, org: org || undefined },
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
        <StatusBadge variant="neutral">{KIND_LABELS[t.kind as TransactionKind] ?? t.kind}</StatusBadge>
      ),
    },
    { key: "org", header: "MFI", render: (t) => t.org },
    {
      key: "amount",
      header: "Amount",
      render: (t) => {
        const prefix = t.direction === "in" ? "+" : t.direction === "out" ? "-" : "";
        return `${prefix}${formatMoney(t.amount)}`;
      },
    },
    {
      key: "mtaji_after",
      header: "Balance after",
      render: (t) => formatMoney(t.mtaji_after),
    },
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

  return (
    <>
      <PageHeader title="Transactions" subtitle="Cross-tenant capital ledger (mtaji)" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={kind || "all"}
          onValueChange={(v) => {
            setKind(v === "all" ? "" : (v as TransactionKind));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="mkopo">Loan disbursed</SelectItem>
            <SelectItem value="rejesho">Repayment</SelectItem>
            <SelectItem value="matumizi">Expense</SelectItem>
            <SelectItem value="mtaji">Capital added</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={org}
          onChange={(e) => {
            setOrg(e.target.value);
            setPage(1);
          }}
          placeholder="MFI ID (organization UUID)"
          className="w-64"
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
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
        </>
      )}

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
