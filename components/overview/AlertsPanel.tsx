import * as React from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/PageStates";
import type { OverviewAlert, OverviewAlertLevel } from "@/types/admin";

const LEVEL_CLASSES: Record<OverviewAlertLevel, string> = {
  warn: "border-l-warning-bg",
  info: "border-l-brand",
  danger: "border-l-danger-bg",
};

const LEVEL_DOT_CLASSES: Record<OverviewAlertLevel, string> = {
  warn: "bg-warning-bg",
  info: "bg-brand",
  danger: "bg-danger-bg",
};

export interface AlertsPanelProps {
  alerts: OverviewAlert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <div className="mt-6">
      <h2 className="font-heading text-lg font-semibold text-text">Alerts</h2>
      <div className="mt-3">
        {alerts.length === 0 ? (
          <EmptyState title="No active alerts" message="Everything looks normal right now." />
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <li
                key={alert.code}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-card border border-border-soft border-l-4 bg-surface px-4 py-3 shadow-[var(--shadow-card)]",
                  LEVEL_CLASSES[alert.level],
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", LEVEL_DOT_CLASSES[alert.level])} />
                  <span className="text-sm text-text">{alert.message}</span>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-text-muted">{alert.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
