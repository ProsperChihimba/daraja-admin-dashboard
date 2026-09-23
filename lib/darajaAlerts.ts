// lib/darajaAlerts.ts
// Critical ops alerts -- dashboard/views/alerts.py.
//
// The dashboard channel is never opt-out: this page is the record, SMS and
// email are the escalation. Acknowledging stops the 30-minute repeat; it does
// NOT resolve the alert, which only a detector can.
import darajaApi from "@/lib/darajaApi";
import type { Paginated } from "@/types/daraja";
import type { StatusVariant } from "@/components/ui/status_badge";

export type AlertState = "open" | "acknowledged" | "closed";

/** Shared with the detail page so the state badge is always the same
 * colour wherever an alert's state is shown. */
export const ALERT_STATE_VARIANT: Record<AlertState, StatusVariant> = {
  open: "danger",
  acknowledged: "warning",
  closed: "neutral",
};

export type AlertRow = {
  alert_id: string;
  kind: string;
  severity: string;
  subject: string;
  body: string;
  state: AlertState;
  target_type: string;
  target_ref: string;
  opened_at: string;
  closed_at: string | null;
  last_notified_at: string | null;
  notify_count: number;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
};

export type AlertDeliveryState = "claimed" | "sent" | "failed" | "skipped";

export type AlertDelivery = {
  delivery_id: string;
  channel: "sms" | "email";
  recipient: string;
  username: string | null;
  attempt: number;
  // `claimed` was added to AlertDelivery.state after this type was first
  // written (dashboard/models.py's AlertDelivery.CLAIMED) -- written by
  // _claim() BEFORE a send is attempted, and left behind when the process
  // dies mid-send. It is NOT a success and must not be folded into `sent`.
  state: AlertDeliveryState;
  error: string;
  created_at: string;
};

export type AlertDetail = AlertRow & { deliveries: AlertDelivery[] };

export const ALERTS_PATH = "/alerts/";

export async function acknowledgeAlert(
  alertId: string,
  note: string,
): Promise<AlertDetail> {
  const { data } = await darajaApi.post<AlertDetail>(
    `/alerts/${alertId}/acknowledge/`,
    { note },
  );
  return data;
}

export type AlertsPage = Paginated<AlertRow> & { open_count: number };
