"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState as UiEmptyState } from "@/components/ui/empty_state";
import { cn } from "@/lib/utils";

/** Simple centered "loading" block for whole-page/section loading states. */
export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 p-8 text-text-muted", className)}>
      <Skeleton className="h-6 w-40" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-card border border-border-soft bg-surface px-6 py-10 text-center">
      <p className="text-sm text-danger-fg">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Friendly wrapper around the ported `@/components/ui/empty_state` EmptyState
 * (which requires a `title` and takes `description`, not `message`).
 * Downstream code (DataTable, pages) uses this `{ title?, message }` shape.
 */
export interface EmptyStateProps {
  title?: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return <UiEmptyState title={title ?? "No records found"} description={message} />;
}
