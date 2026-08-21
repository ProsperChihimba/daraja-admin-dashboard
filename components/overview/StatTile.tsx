import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}

/**
 * KPI tile for the overview dashboard: muted label, large heading value,
 * optional muted sub-line (e.g. "12 active · 2 suspended").
 */
export function StatTile({ label, value, sub, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-1 font-heading text-2xl font-bold tabular-nums text-text">{value}</div>
      {sub ? <div className="mt-1 text-xs text-text-faint">{sub}</div> : null}
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-card border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="h-3 w-20 animate-pulse rounded bg-page-cream" />
      <div className="mt-2 h-7 w-16 animate-pulse rounded bg-page-cream" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-page-cream" />
    </div>
  );
}
