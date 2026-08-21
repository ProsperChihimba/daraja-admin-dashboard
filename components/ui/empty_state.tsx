import { cn } from "@/lib/utils";
import { TextH5, TextMuted } from "./typography";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-border-soft bg-surface/50 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-page-cream text-text-muted">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <TextH5 className="mb-1">{title}</TextH5>
      {description ? <TextMuted className="max-w-sm">{description}</TextMuted> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
