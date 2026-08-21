"use client";
import * as React from "react";

import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status_badge";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { AuditDetailModal, resultVariant } from "@/components/audit/AuditDetailModal";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry, Paginated } from "@/types/admin";

const PAGE_SIZE = 100;

const ENTITY_TYPES = [
  "organization",
  "loan",
  "mtaji_transaction",
  "subscription_payment",
  "package",
  "discount",
  "support_issue",
  "site_config",
] as const;

const ACTIONS = [
  "organization.suspend",
  "organization.activate",
  "loan.adjust",
  "transaction.reverse",
  "package.create",
  "package.update",
  "package.deactivate",
  "discount.create",
  "discount.update",
  "payment.record_manual",
  "support_issue.create",
  "support_issue.update",
  "system.flags_update",
  "admin.login",
] as const;

const RESULTS = ["success", "failure"] as const;

export default function AuditPage() {
  const [page, setPage] = React.useState(1);
  const [action, setAction] = React.useState("");
  const [entityType, setEntityType] = React.useState("");
  const [result, setResult] = React.useState("");
  const [selected, setSelected] = React.useState<AuditEntry | null>(null);
  const [dates, setDates] = React.useState<DateRange>(EMPTY_RANGE);

  const { data, loading, error, refetch } = useAdminResource<Paginated<AuditEntry>>(
    "/admin/audit/",
    {
      page,
      action: action || undefined,
      entity_type: entityType || undefined,
      result: result || undefined,
      created_after: dates.after || undefined,
      created_before: dates.before || undefined,
    },
  );

  const columns: Column<AuditEntry>[] = [
    { key: "created_at", header: "Time", render: (e) => formatDateTime(e.created_at) },
    {
      key: "actor",
      header: "Actor",
      render: (e) => e.actor ?? e.actor_phone ?? "—",
    },
    {
      key: "action",
      header: "Action",
      render: (e) => <span className="font-mono text-xs text-text">{e.action}</span>,
    },
    {
      key: "entity",
      header: "Entity",
      render: (e) => `${e.entity_type} ${e.entity_id}`,
    },
    { key: "org", header: "MFI", render: (e) => e.organization_name ?? "—" },
    {
      key: "result",
      header: "Result",
      render: (e) => <StatusBadge variant={resultVariant(e.result)}>{e.result || "—"}</StatusBadge>,
    },
  ];

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Every administrative action, append-only" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={action || "all"}
          onValueChange={(v) => {
            setAction(v === "all" ? "" : (v as string));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={entityType || "all"}
          onValueChange={(v) => {
            setEntityType(v === "all" ? "" : (v as string));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All entity types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entity types</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={result || "all"}
          onValueChange={(v) => {
            setResult(v === "all" ? "" : (v as string));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All results" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            {RESULTS.map((r) => (
              <SelectItem key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
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
          <DataTable<AuditEntry>
            columns={columns}
            rows={data?.results ?? []}
            loading={loading}
            emptyMessage="No audit events found."
            rowKey={(e) => e.id}
            onRowClick={(e) => setSelected(e)}
          />
          {data ? (
            <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
          ) : null}
        </>
      )}

      <AuditDetailModal
        entry={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
