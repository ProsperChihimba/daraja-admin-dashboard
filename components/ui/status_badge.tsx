import { cn } from "@/lib/utils";

export type StatusVariant = "success" | "warning" | "danger" | "neutral";

const styles: Record<StatusVariant, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  neutral: "bg-page-cream text-text-muted",
};

export function StatusBadge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: StatusVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-pill px-3 py-1 text-[11px] font-semibold tracking-tight whitespace-nowrap",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
