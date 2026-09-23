// app/daraja/(ops)/alerts/[alertId]/page.tsx  (URL: /daraja/alerts/<alertId>)
//
// The one question an operator cannot answer anywhere else in the browser:
// "did the SMS actually go out?" GET /dashboard/alerts/<id>/
// (dashboard/views/alerts.py AlertDetail, dashboard/serializers/alerts.py
// AlertDetailSerializer) serves the full delivery history behind every alert
// row on /daraja/alerts; this is the screen that opens it. Follows
// MerchantDetailPage's detail-route shape (header + tabs-free body) and
// AlertsPageView's acknowledge flow (DangerousActionModal, refetch on
// success) exactly, so the two alert screens do not drift.
"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { useDarajaResource } from "@/lib/darajaAuth";
import { extractOpsErrorMessage } from "@/lib/darajaActions";
import {
  ALERT_STATE_VARIANT, acknowledgeAlert,
  type AlertDelivery, type AlertDeliveryState, type AlertDetail,
} from "@/lib/darajaAlerts";

// Not `success` -- a claimed-and-unresolved send is the unknown-outcome
// state check_alerts writes BEFORE attempting a send, and a row that never
// moved past it means the process died mid-send (dashboard/models.py
// AlertDelivery.CLAIMED). `failed`/`skipped` share the same loud treatment
// as each other: both are a channel that did not reach anyone, and an
// operator scanning during an incident should not have to read the state
// column carefully to notice either one.
const DELIVERY_VARIANT: Record<AlertDeliveryState, StatusVariant> = {
  sent: "success",
  failed: "danger",
  skipped: "danger",
  claimed: "warning",
};

const DELIVERY_LABEL: Record<AlertDeliveryState, string> = {
  sent: "sent",
  failed: "failed",
  skipped: "skipped",
  claimed: "claimed — outcome unknown",
};

// A `failed`/`skipped` row tints the whole row, not just its state cell --
// the point made in the brief is that this must be impossible to miss while
// scanning, not something you notice only after reading the badge.
const ROW_TINT: Record<AlertDeliveryState, string> = {
  sent: "",
  failed: "bg-danger-bg/60",
  skipped: "bg-danger-bg/60",
  claimed: "bg-warning-bg/60",
};

/** Deliveries grouped by attempt, newest attempt first; rows inside a group
 * keep their original (chronological) order. */
function groupByAttempt(deliveries: AlertDelivery[]): [number, AlertDelivery[]][] {
  const groups = new Map<number, AlertDelivery[]>();
  for (const d of deliveries) {
    const g = groups.get(d.attempt);
    if (g) g.push(d);
    else groups.set(d.attempt, [d]);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
}

function DeliveriesTable({ deliveries }: { deliveries: AlertDelivery[] }) {
  if (deliveries.length === 0) {
    // An alert with no delivery rows at all is not "nothing to show" --
    // notification never ran, or every channel was skipped before a row
    // could even be written. An empty DataTable reads as "all clear"; this
    // must read as the opposite.
    return (
      <Card className="border border-danger-fg">
        <CardHeader><CardTitle>Nothing was sent for this alert</CardTitle></CardHeader>
        <CardContent className="text-sm">
          There is no delivery record at all -- notification has not run, or
          every channel was skipped before anything could be attempted.
          Nobody was told about this alert by SMS or email.
        </CardContent>
      </Card>
    );
  }

  const groups = groupByAttempt(deliveries);

  return (
    <div className="rounded-card border border-border-soft bg-surface overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>For</TableHead>
            <TableHead>State</TableHead>
            <TableHead className="whitespace-normal">Error</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map(([attempt, rows]) => (
            <React.Fragment key={attempt}>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="bg-page-cream text-xs font-semibold text-text-muted">
                  Attempt {attempt}
                </TableCell>
              </TableRow>
              {rows.map((d) => (
                <TableRow key={d.delivery_id} className={ROW_TINT[d.state]}>
                  <TableCell className="uppercase">{d.channel}</TableCell>
                  <TableCell>{d.recipient}</TableCell>
                  <TableCell>{d.username ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge variant={DELIVERY_VARIANT[d.state] ?? "neutral"}>
                      {DELIVERY_LABEL[d.state] ?? d.state}
                    </StatusBadge>
                  </TableCell>
                  {/* Rendered in full, never truncated -- this is where
                      "SES throttled", "phone missing or not verified" and
                      "SMS is not configured (no token)" show up, the exact
                      sentences that explain a silent channel. */}
                  <TableCell className="whitespace-normal">{d.error || "—"}</TableCell>
                  <TableCell title={formatDateTime(d.created_at)}>
                    {formatDateTime(d.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AlertDetailPage() {
  const { alertId } = useParams<{ alertId: string }>();
  const { data: alert, loading, error, refetch } = useDarajaResource<AlertDetail>(
    `/alerts/${alertId}/`,
  );
  const [ackOpen, setAckOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  async function handleAck(note: string) {
    if (!alert) return;
    setActionError(null);
    try {
      await acknowledgeAlert(alert.alert_id, note);
      setAckOpen(false);
      refetch();
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not acknowledge this alert.");
      setActionError(msg);
      throw new Error(msg); // keeps the modal open, per DangerousActionModal
    }
  }

  if (error) {
    return (
      <>
        <PageHeader title="Alert" />
        <ErrorState message={error} onRetry={refetch} />
      </>
    );
  }
  if (loading && !alert) {
    return (
      <>
        <PageHeader title="Alert" />
        <LoadingBlock />
      </>
    );
  }
  if (!alert) return null;

  return (
    <>
      <PageHeader
        title={alert.subject}
        subtitle={`${alert.kind} · opened ${formatDateTime(alert.opened_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge variant={ALERT_STATE_VARIANT[alert.state] ?? "neutral"}>
              {alert.state}
            </StatusBadge>
            {alert.state === "open" ? (
              <Button size="sm" variant="outline" onClick={() => { setActionError(null); setAckOpen(true); }}>
                Acknowledge
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="text-sm">
          {/* The body carries the numbers that justified the alert -- the
              gap, the count, how long a detector has been quiet. Rendered
              in full, never truncated, unlike the list row's preview. */}
          <p className="whitespace-pre-wrap text-text">{alert.body}</p>
          {alert.acknowledged_by ? (
            <p className="mt-3 text-xs text-text-muted">
              Acknowledged by {alert.acknowledged_by} at{" "}
              {formatDateTime(alert.acknowledged_at)}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="text-sm text-text-muted">
          {/* `notify_count` and the number of attempts below can legitimately
              differ -- an attempt where every channel failed is listed in
              the table but does not increment this count. Said here once so
              the mismatch reads as documented behaviour, not a bug report. */}
          Notified {alert.notify_count}× — attempts that reached someone.
          Failed or skipped attempts are listed below, but do not count here.
        </CardContent>
      </Card>

      <h2 className="mb-3 font-heading text-lg font-semibold text-text">
        Delivery history
      </h2>
      <DeliveriesTable deliveries={alert.deliveries} />

      <DangerousActionModal
        open={ackOpen}
        onOpenChange={setAckOpen}
        title={`Acknowledge: ${alert.subject}`}
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
