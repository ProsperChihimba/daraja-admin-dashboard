"use client";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/types/admin";

export interface AuditDetailModalProps {
  entry: AuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** success-ish / error-ish classification for free-text `result` values. */
export function resultVariant(result: string): StatusVariant {
  const r = result.toLowerCase();
  if (r.includes("fail") || r.includes("error")) return "danger";
  if (r.includes("success") || r === "ok") return "success";
  return "neutral";
}

function fmtValue(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "string") return v || "(empty)";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function MetaItem({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className={cn("mt-0.5 text-sm text-text", className)}>{value}</div>
    </div>
  );
}

export function AuditDetailModal({ entry, open, onOpenChange }: AuditDetailModalProps) {
  if (!entry) return null;

  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const hasDiff = entry.before !== null || entry.after !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-[15px]">{entry.action}</DialogTitle>
          <p className="text-xs text-text-muted">{formatDateTime(entry.created_at)}</p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 rounded-card border border-border-soft bg-page-cream/40 p-4 sm:grid-cols-2">
          <MetaItem
            label="Actor"
            value={
              entry.actor
                ? `${entry.actor}${entry.actor_phone ? ` (${entry.actor_phone})` : ""}`
                : (entry.actor_phone || "—")
            }
          />
          <MetaItem label="Entity" value={`${entry.entity_type} ${entry.entity_id}`} />
          <MetaItem label="MFI" value={entry.organization_name ?? "—"} />
          <MetaItem label="IP address" value={entry.ip || "—"} />
          <MetaItem
            label="Result"
            value={
              <StatusBadge variant={resultVariant(entry.result)}>{entry.result || "—"}</StatusBadge>
            }
          />
          {entry.reason ? <MetaItem label="Reason" value={entry.reason} /> : null}
          {entry.error ? (
            <MetaItem label="Error" value={entry.error} className="text-danger-fg" />
          ) : null}
        </div>

        <div>
          <h3 className="mb-2 font-heading text-sm font-semibold text-text">Before → After</h3>
          {!hasDiff || keys.length === 0 ? (
            <p className="rounded-card border border-dashed border-border-soft px-4 py-6 text-center text-sm text-text-muted">
              No before/after data recorded for this action.
            </p>
          ) : (
            <div className="max-h-80 overflow-auto rounded-card border border-border-soft">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-page-cream">
                  <tr className="text-left text-xs font-medium text-text-muted">
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Before</th>
                    <th className="px-3 py-2">After</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => {
                    const beforeVal = fmtValue(before[key]);
                    const afterVal = fmtValue(after[key]);
                    const changed = beforeVal !== afterVal;
                    return (
                      <tr
                        key={key}
                        className={cn(
                          "border-t border-border-soft",
                          changed && "bg-warning-bg/10",
                        )}
                      >
                        <td
                          className={cn(
                            "px-3 py-2 align-top text-xs font-semibold",
                            changed ? "text-brand" : "text-text-muted",
                          )}
                        >
                          {key}
                        </td>
                        <td className="max-w-48 break-all px-3 py-2 align-top font-mono text-xs text-text-muted">
                          {beforeVal}
                        </td>
                        <td
                          className={cn(
                            "max-w-48 break-all px-3 py-2 align-top font-mono text-xs",
                            changed ? "font-semibold text-text" : "text-text-muted",
                          )}
                        >
                          {afterVal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
