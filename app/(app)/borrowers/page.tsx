"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadgeFor } from "@/components/common/StatusBadgeFor";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import type { BorrowerRow, Paginated } from "@/types/admin";

const PAGE_SIZE = 100;

export default function BorrowersPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [dates, setDates] = React.useState<DateRange>(EMPTY_RANGE);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error, refetch } = useAdminResource<Paginated<BorrowerRow>>(
    "/admin/borrowers/",
    {
      page,
      q: q || undefined,
      created_after: dates.after || undefined,
      created_before: dates.before || undefined,
    },
  );

  const columns: Column<BorrowerRow>[] = [
    {
      key: "full_name",
      header: "Name",
      render: (b) => (
        <div>
          <div className="font-medium text-text">{b.full_name}</div>
          <div className="text-xs text-text-muted">{b.system_id}</div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (b) => b.phone ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (b) => <StatusBadgeFor status={b.status} kind="borrower" />,
    },
    {
      key: "outstanding_debt",
      header: "Outstanding debt",
      render: (b) => formatMoney(b.outstanding_debt),
    },
    { key: "org", header: "MFI", render: (b) => b.org },
  ];

  return (
    <>
      <PageHeader title="Borrowers" subtitle="Every borrower across all MFIs" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, phone, national ID, system ID…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="max-w-xs"
        />
        <DateRangeFilter
          value={dates}
          onChange={(v) => {
            setDates(v);
            setPage(1);
          }}
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          <DataTable<BorrowerRow>
            columns={columns}
            rows={data?.results ?? []}
            loading={loading}
            emptyMessage="No borrowers found."
            rowKey={(b) => b.id}
            onRowClick={(b) => router.push(`/borrowers/${b.id}`)}
          />
          {data ? (
            <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
          ) : null}
        </>
      )}
    </>
  );
}
