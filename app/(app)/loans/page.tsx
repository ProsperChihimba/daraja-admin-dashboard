"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadgeFor } from "@/components/common/StatusBadgeFor";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/format";
import type { LoanRow, LoanStatus, Paginated } from "@/types/admin";

const PAGE_SIZE = 100;

export default function LoansPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"" | LoanStatus>("");

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error, refetch } = useAdminResource<Paginated<LoanRow>>(
    "/admin/loans/",
    { page, q: q || undefined, status: status || undefined },
  );

  const columns: Column<LoanRow>[] = [
    { key: "loan_id", header: "Loan #", render: (l) => l.loan_id },
    { key: "borrower_name", header: "Borrower", render: (l) => l.borrower_name },
    { key: "org", header: "MFI", render: (l) => l.org },
    { key: "principal", header: "Principal", render: (l) => formatMoney(l.principal) },
    { key: "outstanding", header: "Outstanding", render: (l) => formatMoney(l.outstanding) },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusBadgeFor status={l.status} kind="loan" />,
    },
    { key: "start_date", header: "Start", render: (l) => formatDate(l.start_date) },
  ];

  return (
    <>
      <PageHeader title="Loans" subtitle="Every loan across all MFIs" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by loan #, borrower name, phone…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : (v as LoanStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="owed">Owed</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          <DataTable<LoanRow>
            columns={columns}
            rows={data?.results ?? []}
            loading={loading}
            emptyMessage="No loans found."
            rowKey={(l) => l.id}
            onRowClick={(l) => router.push(`/loans/${l.id}`)}
          />
          {data ? (
            <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
          ) : null}
        </>
      )}
    </>
  );
}
