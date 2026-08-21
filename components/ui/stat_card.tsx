import { cn } from "@/lib/utils";
import { TextEyebrow, TextSubtle } from "./typography";
import { ArrowDown, ArrowUp } from "lucide-react";

type Trend = "up" | "down" | "flat";

export function StatCard({
  label,
  value,
  trend,
  trendDirection = "up",
  loading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  trend?: string;
  trendDirection?: Trend;
  loading?: boolean;
  className?: string;
}) {
  const trendColor =
    trendDirection === "up"
      ? "text-brand"
      : trendDirection === "down"
        ? "text-[color:var(--risk-high)]"
        : "text-text-muted";

  return (
    <div
      className={cn(
        "relative flex min-h-[88px] flex-col justify-between rounded-card border border-border-soft bg-surface px-4 py-3 shadow-card",
        className,
      )}
    >
      <div className="absolute right-4 top-3">
        <TextEyebrow className="normal-case tracking-normal text-[10px] text-text-muted font-normal">
          {label}
        </TextEyebrow>
      </div>
      <div className="text-[26px] font-bold leading-tight text-text tabular-nums">
        {loading ? <span className="inline-block h-7 w-20 animate-pulse rounded-md bg-page-cream" /> : value}
      </div>
      {trend ? (
        <div className={cn("mt-3 flex items-center gap-1 text-xs", trendColor)}>
          {trendDirection === "up" ? (
            <ArrowUp className="size-3" />
          ) : trendDirection === "down" ? (
            <ArrowDown className="size-3" />
          ) : null}
          <span className="font-medium">{trend}</span>
          <TextSubtle className="ml-1">vs Last month</TextSubtle>
        </div>
      ) : null}
    </div>
  );
}
