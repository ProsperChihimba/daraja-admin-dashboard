// app/(app)/daraja/merchants/page.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { formatMoney, formatDate, formatRelative } from "@/lib/format";
import { useDarajaResource } from "@/lib/darajaAuth";
import type { MerchantRow, Paginated } from "@/types/daraja";

const PAGE_SIZE = 50;

// The model's own comment records NULL kyc_status on historical rows, even
// though MerchantRow types the field as a plain string (types/daraja.ts).
// Both helpers take the wider type on purpose and never render the string
// "null" -- an unset status reads as "Unknown", not a false "warning".
const kycVariant = (s: string | null | undefined): StatusVariant =>
  s === "approved" ? "success" : s === "rejected" ? "danger" : s ? "warning" : "neutral";

const kycLabel = (s: string | null | undefined): string => {
  if (!s) return "Unknown";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// Employer.KYC_STATUSES (employer/models.py) -- the backend 400s on any
// value outside this set, so the filter options must be its exact vocabulary,
// not just the three or four values likely to be selected.
const KYC_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "reupload_requested",
  "resubmitted",
] as const;

export default function MerchantsPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [kyc, setKyc] = React.useState("");
  const [dates, setDates] = React.useState<DateRange>(EMPTY_RANGE);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error, refetch } = useDarajaResource<Paginated<MerchantRow>>(
    "/employers/",
    {
      page,
      page_size: PAGE_SIZE,
      q: q || undefined,
      kyc_status: kyc || undefined,
      registered_after: dates.after || undefined,
      registered_before: dates.before || undefined,
    },
  );

  const columns: Column<MerchantRow>[] = [
    { key: "business_name", header: "Merchant",
      render: (m) => m.business_name ?? "—" },
    { key: "phone_number", header: "Phone",
      render: (m) => m.phone_number ?? "—" },
    { key: "kyc_status", header: "KYC",
      render: (m) => <StatusBadge variant={kycVariant(m.kyc_status)}>{kycLabel(m.kyc_status)}</StatusBadge> },
    { key: "active", header: "State",
      render: (m) => <StatusBadge variant={m.active ? "success" : "neutral"}>
        {m.active ? "active" : "inactive"}</StatusBadge> },
    // A merchant with no wallet at all annotates to `None` server-side and
    // the row serializer reports "0" (dashboard/serializers/employers.py) --
    // a real, unexceptional state (see L&M Tutashinda, 2026-09-16), rendered
    // here as TZS 0 rather than hidden or special-cased.
    { key: "balance", header: "Balance",
      render: (m) => formatMoney(Number(m.balance)) },
    { key: "last_activity_at", header: "Last activity",
      render: (m) => formatRelative(m.last_activity_at) },
    { key: "registered", header: "Registered",
      render: (m) => formatDate(m.registered) },
  ];

  return (
    <>
      <PageHeader title="Merchants"
                  subtitle={data ? `${data.count} total` : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, phone, email or TIN"
               className="max-w-xs" value={qInput}
               onChange={(e) => setQInput(e.target.value)} />
        <Select value={kyc || "all"} onValueChange={(v) => { setKyc(!v || v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="KYC status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {KYC_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{kycLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangeFilter value={dates} onChange={(d) => { setDates(d); setPage(1); }} />
      </div>

      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        loading={loading}
        rowKey={(m) => m.employer_id}
        emptyMessage="No merchants match these filters."
        onRowClick={(m) => router.push(`/daraja/merchants/${m.employer_id}`)}
      />
      <Pagination page={page} count={data?.count ?? 0} pageSize={PAGE_SIZE}
                  onPage={setPage} />
    </>
  );
}
