"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status_badge";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";
import type { OrganizationRow, Paginated } from "@/types/admin";

const PAGE_SIZE = 100;

export default function OrganizationsPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"" | "active" | "suspended">("");
  const [dates, setDates] = React.useState<DateRange>(EMPTY_RANGE);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error, refetch } = useAdminResource<Paginated<OrganizationRow>>(
    "/admin/organizations/",
    {
      page,
      q: q || undefined,
      status: status || undefined,
      created_after: dates.after || undefined,
      created_before: dates.before || undefined,
    },
  );

  const columns: Column<OrganizationRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (o) => (
        <div>
          <div className="font-medium text-text">{o.name}</div>
          {o.region || o.district ? (
            <div className="text-xs text-text-muted">
              {[o.region, o.district].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <StatusBadge variant={o.status === "active" ? "success" : "danger"}>
          {o.status === "active" ? "Active" : "Suspended"}
        </StatusBadge>
      ),
    },
    {
      key: "borrowers",
      header: "Borrowers",
      render: (o) => formatNumber(o.stats.borrowers),
    },
    {
      key: "loans_active",
      header: "Active loans",
      render: (o) => `${formatNumber(o.stats.loans_active)} of ${formatNumber(o.stats.loans_total)}`,
    },
    {
      key: "outstanding",
      header: "Outstanding",
      render: (o) => formatMoney(o.stats.outstanding),
    },
    {
      key: "subscription",
      header: "Subscription",
      render: (o) =>
        o.subscription?.package?.name
          ? `${o.subscription.package.name}${o.subscription.status ? ` · ${o.subscription.status}` : ""}`
          : "—",
    },
    {
      key: "created_at",
      header: "Created",
      render: (o) => formatDate(o.created_at),
    },
  ];

  return (
    <>
      <PageHeader title="Organizations" subtitle="All MFIs on the platform" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, region, district, phone…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : (v as "active" | "suspended"));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
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
          <DataTable<OrganizationRow>
            columns={columns}
            rows={data?.results ?? []}
            loading={loading}
            emptyMessage="No organizations found."
            rowKey={(o) => o.id}
            onRowClick={(o) => router.push(`/organizations/${o.id}`)}
          />
          {data ? (
            <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
          ) : null}
        </>
      )}
    </>
  );
}
