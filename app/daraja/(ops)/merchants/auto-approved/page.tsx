// app/daraja/(ops)/merchants/auto-approved/page.tsx  (URL: /daraja/merchants/auto-approved)
//
// Sole-prop merchants approved by the system with no reviewer, oldest first,
// until someone samples them. See lib/darajaReview.ts. A static segment, so
// it wins over merchants/[id] for this one path.
"use client";
import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useDarajaResource } from "@/lib/darajaAuth";
import { extractOpsErrorMessage } from "@/lib/darajaActions";
import {
  AUTO_APPROVED_PATH,
  markSampled,
  type AutoApprovedRow,
  type Paginated,
} from "@/lib/darajaReview";

const PAGE_SIZE = 50;

export default function AutoApprovedPage() {
  const [page, setPage] = React.useState(1);
  const [target, setTarget] = React.useState<AutoApprovedRow | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const { data, loading, error, refetch } = useDarajaResource<Paginated<AutoApprovedRow>>(
    AUTO_APPROVED_PATH,
    { page, page_size: PAGE_SIZE },
  );

  async function handleSampled(note: string) {
    if (!target) return;
    setActionError(null);
    try {
      const res = await markSampled(target.employer_id, note);
      setNotice(`${target.business_name ?? target.employer_id} marked reviewed by ${res.sampled_by}.`);
      setTarget(null);
      refetch();
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not mark this merchant reviewed.");
      setActionError(msg);
      // Rethrown so the modal stays open with the note the reviewer typed.
      throw new Error(msg);
    }
  }

  const columns: Column<AutoApprovedRow>[] = [
    { key: "business_name", header: "Merchant",
      render: (m) => (
        <Link href={`/daraja/merchants/${m.employer_id}`} className="underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}>
          {m.business_name ?? "—"}
        </Link>
      ) },
    { key: "phone_number", header: "Phone", render: (m) => m.phone_number ?? "—" },
    { key: "owner_nida_present", header: "NIDA",
      render: (m) => m.owner_nida_present == null ? "—"
        : <StatusBadge variant={m.owner_nida_present ? "success" : "warning"}>
            {m.owner_nida_present ? "given" : "missing"}</StatusBadge> },
    { key: "active", header: "State",
      render: (m) => m.active == null ? "—"
        : <StatusBadge variant={m.active ? "success" : "neutral"}>
            {m.active ? "active" : "inactive"}</StatusBadge> },
    { key: "auto_approved_at", header: "Auto-approved",
      render: (m) => <span title={formatDateTime(m.auto_approved_at)}>
        {formatRelative(m.auto_approved_at)}</span> },
    { key: "employer_id", header: "",
      render: (m) => (
        <Button size="sm" variant="outline"
                onClick={(e) => { e.stopPropagation(); setActionError(null); setTarget(m); }}>
          Mark reviewed
        </Button>
      ) },
  ];

  return (
    <>
      <PageHeader title="Auto-approved merchants"
                  subtitle={data ? `${data.count} not yet reviewed` : undefined}
                  actions={<Link href="/daraja/merchants"><Button size="sm" variant="ghost">All merchants</Button></Link>} />
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Sole-prop signups are approved automatically, with no reviewer. Check each one
        after the fact. Marking a merchant reviewed changes nothing about it; to stop
        one, open it and request a suspension.
      </p>

      {notice ? <p className="mb-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      <DataTable
        columns={columns}
        rows={data?.results ?? []}
        loading={loading}
        rowKey={(m) => m.employer_id}
        emptyMessage="Every auto-approved merchant has been reviewed."
      />
      <Pagination page={page} count={data?.count ?? 0} pageSize={PAGE_SIZE}
                  onPage={setPage} />

      <DangerousActionModal
        open={target !== null}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title={`Mark reviewed: ${target?.business_name ?? target?.employer_id ?? ""}`}
        impact={<>
          Records that you checked this merchant, with your note, and removes it from
          this list. The merchant itself is not changed.
          {actionError ? <span className="mt-2 block text-destructive">{actionError}</span> : null}
        </>}
        confirmLabel="Mark reviewed"
        requireReason
        onConfirm={handleSampled}
      />
    </>
  );
}
