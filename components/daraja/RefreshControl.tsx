// components/daraja/RefreshControl.tsx
//
// "As of 02:10:33" plus a Refresh button, for the two ops screens that are
// read during an incident.
//
// WHY THIS EXISTS. Both screens fetched once per mount and wired their
// `refetch` only to `ErrorState.onRetry` -- a control reachable ONLY after a
// request had already failed. On a successful load there was no refresh, no
// poll and no keyboard path, so an operator who opened /daraja/ledger at
// 02:10 and watched it through an incident was still reading 02:10's answer
// at 04:00 with nothing on the screen saying so. Worse, the one apparently
// live number was the most misleading: `age()` counts up from an
// `age_seconds` the SERVER computed at fetch time, so the halt cell implied a
// freshness the payload never had.
//
// DELIBERATELY MANUAL, NOT A POLL. An auto-refreshing money screen is a
// product decision -- it changes what an operator is looking at while they
// are looking at it, and it puts a recurring live Selcom call behind a tab
// somebody left open. A button plus a visible fetch time makes the staleness
// legible without making that decision.
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * The wall-clock moment a payload arrived, as "02:10:33", or an em dash.
 *
 * Client-side only in practice: `fetchedAt` is null until a fetch resolves in
 * the browser, so the server render never produces a time and there is
 * nothing for hydration to disagree about.
 */
export function clockTime(at: number | null | undefined): string {
  if (at === null || at === undefined || !Number.isFinite(at)) return "—";
  return new Date(at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function RefreshControl({
  fetchedAt,
  onRefresh,
  busy = false,
  label = "Data",
}: {
  fetchedAt: number | null;
  onRefresh: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-muted" data-slot="fetched-at">
        {fetchedAt === null
          ? `${label}: not loaded yet`
          : `${label} as of ${clockTime(fetchedAt)} · does not refresh on its own`}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={onRefresh}
        aria-label="Refresh"
      >
        {busy ? "Refreshing…" : "Refresh"}
      </Button>
    </div>
  );
}
