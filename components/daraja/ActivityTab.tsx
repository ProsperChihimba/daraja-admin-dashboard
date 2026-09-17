// components/daraja/ActivityTab.tsx
"use client";
import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/PageStates";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatMoney, formatDateTime } from "@/lib/format";
import { useDarajaResource } from "@/lib/darajaAuth";
import { cn } from "@/lib/utils";
import type { ActivityEnvelope, TimelineRow } from "@/types/daraja";

const KIND_LABEL: Record<TimelineRow["kind"], string> = {
  expense: "Expense",
  payout: "Payout",
  deposit: "Deposit",
  card_load: "Card load",
  admin: "Admin",
};

const KIND_FILTERS = ["", "expense", "payout", "deposit", "card_load", "admin"] as const;

const SKELETON_ROWS = 6;

/**
 * Pairs an adjacent expense/payout with a matching amount.
 *
 * Neither `reference` nor `link_id` ties the pair together: a payout row's
 * `reference` is `ExpensePayout.payout_id`, its own primary key, never the
 * `expense_id` of the expense it pays out (confirmed against
 * `payments/services/expense_payout.py`, which never copies one id onto the
 * other -- `TimelineRow` has no field carrying that FK at all). `occurred_at`
 * ties are not reliable either: live data shows a payout's `created_at`
 * landing 1-1.5s after its expense's `expense_date` (two separate INSERTs
 * in the same request, not one), never bit-identical. What IS reliable,
 * confirmed against a real merchant's activity: `run_expense_payout` always
 * passes `amount = int(expense.amount)` (`payments/services/expense_payout.py`),
 * so the pair carries the same `amount`, and the backend's own sort
 * (`occurred_at` desc, `reference` desc) always places the payout row
 * immediately before its expense row. Adjacency + a matching amount is the
 * best signal this screen has without a real FK to join on.
 */
function groupRelatedRows(rows: TimelineRow[]): TimelineRow[][] {
  const groups: TimelineRow[][] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const next = rows[i + 1];
    const isPair =
      next &&
      row.amount !== null &&
      next.amount !== null &&
      Number(row.amount) === Number(next.amount) &&
      ((row.kind === "payout" && next.kind === "expense") ||
        (row.kind === "expense" && next.kind === "payout"));
    if (isPair) {
      groups.push([row, next]);
      i += 1;
    } else {
      groups.push([row]);
    }
  }
  return groups;
}

export function ActivityTab({ employerId }: { employerId: string }) {
  const [kind, setKind] = React.useState<string>("");
  const [before, setBefore] = React.useState<string | undefined>(undefined);
  const [rows, setRows] = React.useState<TimelineRow[]>([]);

  const { data, loading, error, refetch } = useDarajaResource<ActivityEnvelope>(
    `/employers/${employerId}/activity/`,
    before ? { before } : undefined,
  );

  // The endpoint's `results` may legitimately hold more than the requested
  // `limit` (a tied page boundary is extended, never split) -- accumulate
  // exactly what came back, never re-slice it down to a fixed size.
  //
  // Deduped by (kind, link_type, link_id) on append: a "Load older" click
  // that lands while the previous fetch for the same `before` is still in
  // flight -- or a page whose oldest row ties on `occurred_at` with rows
  // already on screen -- must not double a row that's already showing.
  React.useEffect(() => {
    if (!data) return;
    setRows((prev) => {
      if (!before) return data.results;
      const seen = new Set(prev.map((r) => `${r.kind}:${r.link_type}:${r.link_id}`));
      const fresh = data.results.filter(
        (r) => !seen.has(`${r.kind}:${r.link_type}:${r.link_id}`),
      );
      return [...prev, ...fresh];
    });
  }, [data, before]);

  const filtered = kind ? rows.filter((r) => r.kind === kind) : rows;
  const groups = React.useMemo(() => groupRelatedRows(filtered), [filtered]);

  // No `next`/`count` on this envelope (dashboard/services/timeline.py is
  // cursor-by-timestamp, not cursor-by-token), so "no more history" is
  // inferred the only way available: the most recent older-page fetch came
  // back empty.
  const exhausted = before !== undefined && !!data && data.results.length === 0;
  const oldest = rows.length ? rows[rows.length - 1].occurred_at : undefined;

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {KIND_FILTERS.map((k) => (
          <button
            key={k || "all"}
            onClick={() => setKind(k)}
            className={cn(
              "rounded-pill border px-3 py-1 text-xs",
              kind === k ? "bg-primary text-white" : "border-border-soft",
            )}
          >
            {k ? KIND_LABEL[k as TimelineRow["kind"]] : "All"}
          </button>
        ))}
      </div>

      <div className="rounded-card border border-border-soft bg-surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !rows.length ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState message="Nothing recorded for this merchant yet." />
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) =>
                group.map((r, i) => (
                  <TableRow
                    key={`${r.kind}:${r.link_type}:${r.link_id}`}
                    className={cn(group.length > 1 && "bg-brand-soft/25")}
                  >
                    <TableCell>
                      {i === 0 ? (
                        formatDateTime(r.occurred_at)
                      ) : (
                        <span className="pl-3 text-text-muted">↳ same payment</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="neutral">{KIND_LABEL[r.kind]}</StatusBadge>
                      {group.length > 1 ? (
                        <span className="ml-2 text-[10px] uppercase text-text-muted">
                          linked
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-normal">{r.summary}</TableCell>
                    <TableCell>
                      {r.amount === null ? "—" : formatMoney(Number(r.amount))}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{r.reference}</span>
                    </TableCell>
                  </TableRow>
                )),
              )
            )}
          </TableBody>
        </Table>
      </div>

      {rows.length && !exhausted ? (
        <div className="py-3 text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !oldest}
            onClick={() => oldest && setBefore(oldest)}
          >
            {loading ? "Loading…" : "Load older activity"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
