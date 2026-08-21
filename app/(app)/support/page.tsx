"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IssueStatusBadge, IssuePriorityBadge } from "@/components/support/badges";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { CreateIssueDialog } from "@/components/support/CreateIssueDialog";
import { formatDate } from "@/lib/format";
import type { IssueCategory, IssuePriority, IssueStatus, Paginated, SupportIssue } from "@/types/admin";

const PAGE_SIZE = 100;

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  loan: "Loan",
  payment: "Payment",
  account: "Account",
  data: "Data",
  technical: "Technical",
  other: "Other",
};

export default function SupportPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"" | IssueStatus>("");
  const [priority, setPriority] = React.useState<"" | IssuePriority>("");
  const [openOnly, setOpenOnly] = React.useState(false);
  const [dates, setDates] = React.useState<DateRange>(EMPTY_RANGE);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error, refetch } = useAdminResource<Paginated<SupportIssue>>(
    "/admin/issues/",
    {
      page,
      q: q || undefined,
      status: status || undefined,
      priority: priority || undefined,
      open: openOnly ? "1" : undefined,
      created_after: dates.after || undefined,
      created_before: dates.before || undefined,
    },
  );

  const columns: Column<SupportIssue>[] = [
    { key: "reference", header: "Reference", render: (i) => i.reference },
    { key: "title", header: "Title", render: (i) => i.title },
    { key: "organization_name", header: "MFI", render: (i) => i.organization_name ?? "—" },
    {
      key: "category",
      header: "Category",
      render: (i) => CATEGORY_LABELS[i.category] ?? i.category,
    },
    { key: "priority", header: "Priority", render: (i) => <IssuePriorityBadge priority={i.priority} /> },
    { key: "status", header: "Status", render: (i) => <IssueStatusBadge status={i.status} /> },
    { key: "notes_count", header: "Notes", render: (i) => i.notes_count },
    { key: "created_at", header: "Created", render: (i) => formatDate(i.created_at) },
  ];

  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Internal operations issues"
        actions={<Button onClick={() => setCreateOpen(true)}>New issue</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by reference, title, reporter…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : (v as IssueStatus));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priority || "all"}
          onValueChange={(v) => {
            setPriority(v === "all" ? "" : (v as IssuePriority));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="open-only" className="cursor-pointer">
          <Checkbox
            id="open-only"
            checked={openOnly}
            onCheckedChange={(checked) => {
              setOpenOnly(checked === true);
              setPage(1);
            }}
          />
          Open only
        </Label>
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
          <DataTable<SupportIssue>
            columns={columns}
            rows={data?.results ?? []}
            loading={loading}
            emptyMessage="No support issues found."
            rowKey={(i) => i.id}
            onRowClick={(i) => router.push(`/support/${i.id}`)}
          />
          {data ? (
            <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
          ) : null}
        </>
      )}

      <CreateIssueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => {
          setCreateOpen(false);
          void refetch();
        }}
      />
    </>
  );
}
