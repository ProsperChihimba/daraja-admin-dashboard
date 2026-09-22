// lib/darajaAlerts.ts
// Critical ops alerts -- dashboard/views/alerts.py.
//
// The dashboard channel is never opt-out: this page is the record, SMS and
// email are the escalation. Acknowledging stops the 30-minute repeat; it does
// NOT resolve the alert, which only a detector can.
import darajaApi from "@/lib/darajaApi";
import type { Paginated } from "@/types/daraja";

export type AlertState = "open" | "acknowledged" | "closed";

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

export type AlertDelivery = {
  delivery_id: string;
  channel: "sms" | "email";
  recipient: string;
  username: string | null;
  attempt: number;
  state: "sent" | "failed" | "skipped";
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
