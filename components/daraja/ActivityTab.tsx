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

const rowKeyOf = (r: TimelineRow) => `${r.kind}:${r.link_type}:${r.link_id}`;

/**
 * Pairs a payout with the expense it actually settles, on the REAL relation.
 *
 * `related_expense_id` is `ExpensePayout.expense_id` -- the FK column of a
 * OneToOneField, read straight off the payout row
 * (dashboard/services/timeline.py). It is a CharField, never an int: it is
 * compared with `===` against `link_id` and must not be coerced to a number.
 * It is set on PAYOUT rows only and is null on every other kind, expense rows
 * included.
 *
 * WHAT THIS REPLACED, AND WHY THERE IS NO FALLBACK. The previous version
 * paired a row with the NEXT row when one was a payout, one an expense, and
 * the amounts matched. Adjacency is not a relation: two 10,000 expenses where
 * only the older was paid sort as [unpaid, payout, paid], so the UNPAID
 * expense was labelled "linked" to the other expense's payout and the paid one
 * rendered as unpaid -- the exact inversion of the truth, asserted with no
 * hedge, and the grouped row's own timestamp was replaced by "↳ same payment",
 * removing the one piece of evidence that would have exposed it. Keeping
 * adjacency as a fallback for rows whose id is null would restore that
 * inversion on precisely those rows, so there is none: a payout with no
 * `related_expense_id`, or whose expense is not on the loaded page, renders as
 * its own unpaired row. That is honest -- an unpaired payout is not a claim.
 */
function groupRelatedRows(rows: TimelineRow[]): TimelineRow[][] {
  const expenseAt = new Map<string, number>();
  rows.forEach((r, i) => {
    if (r.kind === "expense") expenseAt.set(r.link_id, i);
  });

  const partnerOf = new Map<number, number>();
  const claimed = new Set<number>();
  rows.forEach((r, i) => {
    if (r.kind !== "payout" || !r.related_expense_id) return;
    const j = expenseAt.get(r.related_expense_id);
    // `claimed` guards the one-to-one: the FK cannot legitimately point two
    // payouts at one expense, and if the data ever did, the second payout
    // stays unpaired rather than the expense being rendered twice.
    if (j === undefined || claimed.has(j)) return;
    claimed.add(j);
    partnerOf.set(i, j);
  });

  const groups: TimelineRow[][] = [];
  rows.forEach((r, i) => {
    if (claimed.has(i)) return; // rendered beneath its payout instead
    const j = partnerOf.get(i);
    groups.push(j === undefined ? [r] : [r, rows[j]]);
  });
  return groups;
}

export function ActivityTab({ employerId }: { employerId: string }) {
  const [kind, setKind] = React.useState<string>("");
  const [before, setBefore] = React.useState<string | undefined>(undefined);
  const [rows, setRows] = React.useState<TimelineRow[]>([]);
  const [exhausted, setExhausted] = React.useState(false);
  const applied = React.useRef<Set<string>>(new Set());
  const seen = React.useRef<Set<string>>(new Set());

  const { data, dataKey, loading, error, refetch } = useDarajaResource<ActivityEnvelope>(
    `/employers/${employerId}/activity/`,
    before ? { before } : undefined,
  );

  const requestKey = JSON.stringify(before ? { before } : {});
  // Only ever the response fetched FOR the request now showing -- `data`
  // still holds the previous page while the next one is in flight, and
  // appending that would double the page on screen (see CursorList, C1).
  const page = dataKey === requestKey ? data : null;

  // The endpoint's `results` may legitimately hold more than the requested
  // `limit` (a tied page boundary is extended, never split) -- accumulate
  // exactly what came back, never re-slice it down to a fixed size.
  //
  // Deduped by (kind, link_type, link_id) on append: a page whose oldest rows
  // tie on `occurred_at` with rows already on screen re-delivers them, and the
  // same movement must not be listed twice.
  React.useEffect(() => {
    if (!page || dataKey === null) return;
    if (!before) {
      applied.current = new Set([dataKey]);
      seen.current = new Set(page.results.map(rowKeyOf));
      setRows(page.results);
      return;
    }
    if (applied.current.has(dataKey)) return;
    applied.current.add(dataKey);

    const fresh = page.results.filter((r) => !seen.current.has(rowKeyOf(r)));
    fresh.forEach((r) => seen.current.add(rowKeyOf(r)));

    // TERMINATION IS DECIDED ON THE RESPONSE AND THE CURSOR, not on what
    // survives de-duplication. `before` is the timestamp of the oldest row on
    // screen; if a page adds no row older than that, the cursor cannot
    // advance and every further click re-issues the identical request
    // forever, with no visible progress (whole-branch review, I3).
    const nextOldest = fresh.length
      ? fresh[fresh.length - 1].occurred_at
      : before;
    if (page.results.length === 0 || nextOldest === before) setExhausted(true);
    if (fresh.length) setRows((prev) => [...prev, ...fresh]);
  }, [page, dataKey, before]);

  // Memoised on the inputs, not on a fresh array: `filtered` used to be
  // rebuilt every render, so useMemo([filtered]) never once hit (M3).
  const groups = React.useMemo(
    () => groupRelatedRows(kind ? rows.filter((r) => r.kind === kind) : rows),
    [rows, kind],
  );

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
                    key={rowKeyOf(r)}
                    className={cn(group.length > 1 && "bg-brand-soft/25")}
                  >
                    {/*
                      BOTH timestamps are always shown. The grouped row used to
                      render "↳ same payment" in place of its own time, which
                      removed the only evidence an operator could have used to
                      catch a mis-paired row. The pairing is a real FK now, but
                      a row's own time is still a fact about that row and the
                      screen does not get to withhold it.
                    */}
                    <TableCell className={cn(i > 0 && "pl-6 text-text-muted")}>
                      {formatDateTime(r.occurred_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant="neutral">{KIND_LABEL[r.kind]}</StatusBadge>
                      {group.length > 1 ? (
                        <span className="ml-2 text-[10px] uppercase text-text-muted">
                          {i === 0 ? "settles below" : "settled by above"}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-normal">{r.summary}</TableCell>
                    <TableCell>
                      {r.amount === null ? "—" : formatMoney(r.amount)}
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
