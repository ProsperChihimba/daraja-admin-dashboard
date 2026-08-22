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
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { StatTile, StatTileSkeleton } from "@/components/overview/StatTile";
import { formatNumber, formatDate, formatRelative } from "@/lib/format";
import type { AdoptionStats, OrganizationRow, Paginated } from "@/types/admin";

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

  const { data: adoption, loading: adoptionLoading, error: adoptionError } = useAdminResource<AdoptionStats>(
    "/admin/overview/adoption/",
  );

  const subscriptionVariant = (s: string | undefined | null): StatusVariant => {
    if (s === "active") return "success";
    if (s === "trial") return "warning";
    if (!s) return "neutral";
    return "danger";
  };

  const columns: Column<OrganizationRow>[] = [
    {
      key: "created_at",
      header: "Reg Date",
      render: (o) => formatDate(o.created_at),
    },
    {
      key: "name",
      header: "Name",
      render: (o) => <span className="font-medium text-text">{o.name}</span>,
    },
    {
      key: "address",
      header: "Address",
      render: (o) => [o.region, o.district].filter(Boolean).join(", ") || "—",
    },
    {
      key: "last_login",
      header: "Last Login",
      render: (o) => formatRelative(o.stats.last_login),
    },
    {
      key: "last_activity",
      header: "Last Activity",
      render: (o) => formatRelative(o.stats.last_activity),
    },
    {
      key: "subscription_status",
      header: "Subscription Status",
      render: (o) => (
        <StatusBadge variant={subscriptionVariant(o.subscription?.status)}>
          {o.subscription?.status
            ? o.subscription.status.charAt(0).toUpperCase() + o.subscription.status.slice(1)
            : "None"}
        </StatusBadge>
      ),
    },
    {
      key: "package",
      header: "Package",
      render: (o) => o.subscription?.package?.name ?? "—",
    },
    {
      key: "expiry",
      header: "Expiry",
      render: (o) => formatDate(o.subscription?.current_period_end),
    },
  ];

  return (
    <>
      <PageHeader title="Organizations" subtitle="All MFIs on the platform" />

      {adoptionError ? null : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {adoptionLoading || !adoption ? (
            Array.from({ length: 6 }).map((_, i) => <StatTileSkeleton key={i} />)
          ) : (
            <>
              <StatTile
                label="Total MFIs"
                value={formatNumber(adoption.summary.total_orgs)}
                sub={`${formatNumber(adoption.summary.suspended)} suspended`}
              />
              <StatTile
                label="New this month"
                value={formatNumber(adoption.summary.new_this_month)}
                sub={`${formatNumber(adoption.summary.new_this_week)} this week`}
              />
              <StatTile
                label="Active (7 days)"
                value={formatNumber(adoption.summary.active_7d)}
                sub={`${formatNumber(adoption.summary.active_30d)} in 30 days`}
              />
              <StatTile label="Paying" value={formatNumber(adoption.summary.paying)} />
              <StatTile label="Trial" value={formatNumber(adoption.summary.trial)} />
              <StatTile label="Expired" value={formatNumber(adoption.summary.expired)} />
            </>
          )}
        </div>
      )}

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
