// app/daraja/(ops)/alerts/page.tsx  (URL: /daraja/alerts)
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
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
  ALERT_STATE_VARIANT, ALERTS_PATH, acknowledgeAlert, type AlertRow, type AlertsPage,
} from "@/lib/darajaAlerts";

const PAGE_SIZE = 50;

export default function AlertsPageView() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [target, setTarget] = React.useState<AlertRow | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const { data, loading, error, refetch } = useDarajaResource<AlertsPage>(
    ALERTS_PATH, { page, page_size: PAGE_SIZE },
  );

  async function handleAck(note: string) {
    if (!target) return;
    setActionError(null);
    try {
      await acknowledgeAlert(target.alert_id, note);
      setTarget(null);
      refetch();
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not acknowledge this alert.");
      setActionError(msg);
      throw new Error(msg);
    }
  }

  const columns: Column<AlertRow>[] = [
    { key: "state", header: "State",
      render: (a) => <StatusBadge variant={ALERT_STATE_VARIANT[a.state] ?? "neutral"}>
        {a.state}</StatusBadge> },
    { key: "subject", header: "Alert",
      render: (a) => <div>
        <div className="font-medium">{a.subject}</div>
        <div className="text-xs text-muted-foreground">{a.body}</div>
      </div> },
    { key: "opened_at", header: "Opened",
      render: (a) => <span title={formatDateTime(a.opened_at)}>
        {formatRelative(a.opened_at)}</span> },
    { key: "notify_count", header: "Notified",
      render: (a) => a.notify_count === 0 ? "—" : `${a.notify_count}×` },
    { key: "acknowledged_by", header: "Acknowledged",
      render: (a) => a.acknowledged_by
        ? <span title={formatDateTime(a.acknowledged_at)}>{a.acknowledged_by}</span>
        : "—" },
    { key: "alert_id", header: "",
      render: (a) => a.state === "open"
        ? <Button size="sm" variant="outline"
                  onClick={(e) => { e.stopPropagation(); setActionError(null); setTarget(a); }}>
            Acknowledge
          </Button>
        : null },
  ];

  return (
    <>
      <PageHeader title="Alerts"
                  subtitle={data ? `${data.open_count} open` : undefined} />
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Critical conditions that stop money moving. Acknowledging stops the
        half-hourly SMS and email; the alert closes on its own when the
        condition clears.
      </p>

      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      <DataTable columns={columns} rows={data?.results ?? []} loading={loading}
                 rowKey={(a) => a.alert_id}
                 onRowClick={(a) => router.push(`/daraja/alerts/${a.alert_id}`)}
                 emptyMessage="Nothing is wrong. No alerts have been raised." />
      <Pagination page={page} count={data?.count ?? 0} pageSize={PAGE_SIZE}
                  onPage={setPage} />

      <DangerousActionModal
        open={target !== null}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title={`Acknowledge: ${target?.subject ?? ""}`}
        impact={<>
          Records your name and the time, and stops the repeat notifications.
          It does NOT fix the condition or close the alert.
          {actionError ? <span className="mt-2 block text-destructive">{actionError}</span> : null}
        </>}
        confirmLabel="Acknowledge"
        requireReason
        onConfirm={handleAck}
      />
    </>
  );
}
