// app/daraja/(ops)/ledger/movements/page.tsx  (URL: /daraja/ledger/movements)
//
// The ledger explorer: every movement, newest first, each with its legs
// beneath it (components/daraja/MovementRow.tsx). Reached from the sidebar and
// from a row click on app/daraja/(ops)/ledger/page.tsx, which deep-links here
// as `?account_id=<id>` -- so the account filter is seeded from the query
// string rather than starting empty and silently ignoring where the operator
// came from.
//
// READ-ONLY, DELIBERATELY. There is no action control anywhere on this screen,
// and no disabled one standing in for a future one: a control that cannot act
// invites the one support question the screen has no way to answer. The only
// buttons here are Load more, the date range's Clear, and an error's Retry.
//
// THE HAZARD THIS FILE IS SHAPED AROUND: FILTERS ON TOP OF A CURSOR.
// `useCursorPages` accumulates pages into state that belongs to its component
// instance -- `cursor`, `rows`, and the `applied` ref. Nothing in it watches
// `path`. So if the path changed underneath a live instance:
//
//   * the already-advanced `cursor` would be sent to the NEW query, asking the
//     new result set to resume from a position taken in the old one, and page
//     one of the new filter would never be fetched at all;
//   * `rows` would still hold the previous filter's accumulated movements; and
//   * worse, `applied` already contains that cursor's key, so the incoming
//     response would be recognised as "already folded in" and DISCARDED --
//     leaving the operator looking at nothing but the old filter's rows under
//     the new filter's controls, with no error and no empty state to hint at
//     it.
//
// That is not a bug in the hook; the hook is scoped to one query by design
// (and its append-once-per-cursor rule, the Critical from Plan 1, is exactly
// what must not be reimplemented here). The fix is to make "a different query"
// mean "a different component instance": <MovementsList> is keyed on the very
// path it fetches, so React unmounts the old instance and mounts a fresh one
// whenever any filter changes, discarding cursor, rows and applied together.
// One expression, at the only place that knows a filter moved.
"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { MovementRow } from "@/components/daraja/MovementRow";
import { useCursorPages } from "@/components/daraja/CursorList";
import { useDarajaResource } from "@/lib/darajaAuth";
import type { LedgerKindsPayload, MovementRow as MovementRowData } from "@/types/daraja";

export interface MovementFilters {
  kind: string;
  reference: string;
  accountId: string;
  after: string;
  before: string;
}

/**
 * The endpoint path for one set of filters -- and, because of the hazard
 * described above, ALSO the identity of the list showing them.
 *
 * The filter values ride in the path's own query string rather than in the
 * hook's params, because `useCursorPages` owns that params object (it puts the
 * cursor there) and takes nothing else. Axios appends its `cursor` with `&`
 * when the url already carries a `?` (axios/lib/helpers/buildURL.js), so the
 * two compose correctly.
 *
 * Empty filters are OMITTED, never sent blank: the backend treats a missing
 * param and an empty one the same way today (`(request.query_params.get(...)
 * or "").strip()`), but sending `kind=` would still make two identical result
 * sets look like two different queries to the keying below, remounting the
 * list -- and throwing away loaded pages -- for a filter the operator never
 * set.
 */
export function movementsPath(filters: MovementFilters): string {
  const query = new URLSearchParams();
  if (filters.kind) query.set("kind", filters.kind);
  if (filters.reference) query.set("reference", filters.reference);
  if (filters.accountId) query.set("account_id", filters.accountId);
  // `start_date`/`end_date` are what dashboard/views/ledger.py reads (via
  // parse_date_param); the shared DateRangeFilter names its own fields
  // after/before, so they are mapped here rather than renamed there -- that
  // component drives `registered_after`/`registered_before` on the merchants
  // screen and is not this screen's to repurpose.
  if (filters.after) query.set("start_date", filters.after);
  if (filters.before) query.set("end_date", filters.before);
  const search = query.toString();
  return search ? `/ledger/movements/?${search}` : "/ledger/movements/";
}

/**
 * The kind filter's options, FETCHED, never hardcoded.
 *
 * `post(kind, reference, legs)` (wallets/services/ledger.py) takes a free
 * string and there is no enum anywhere in the system, which is why
 * /ledger/kinds/ exists: it reports the kinds actually present. A literal list
 * here would go stale the day a new movement type ships, and would do it
 * silently -- the new kind's movements would simply be unfilterable, and an
 * operator would have no way to tell the option was missing rather than the
 * data.
 */
function KindFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { data, error } = useDarajaResource<LedgerKindsPayload>("/ledger/kinds/");
  const kinds = data?.kinds ?? [];

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value || "all"}
        onValueChange={(v) => onChange(!v || v === "all" ? "" : String(v))}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Movement kind" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All kinds</SelectItem>
          {kinds.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {kind}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* A failed kinds read is said out loud. Falling back to a guessed list
          would be the hardcoding this endpoint exists to prevent, and showing
          a silently empty dropdown would read as "there are no kinds". */}
      {error ? (
        <span className="text-xs text-danger-fg">Kinds unavailable: {error}</span>
      ) : null}
    </div>
  );
}

/**
 * One filter's worth of movements. Mounted fresh per distinct `path` by the
 * key below -- see the header. It reimplements CursorList's SHELL (error,
 * empty, Load more) rather than reusing CursorList itself because these rows
 * are not a table: a movement's legs nest beneath it, and DataTable renders
 * one flat row per record. The accumulation, which is the part that had the
 * Critical bug, is NOT reimplemented -- `useCursorPages` does it.
 */
function MovementsList({ path }: { path: string }) {
  const { rows, loading, error, refetch, nextCursor, loadMore } =
    useCursorPages<MovementRowData>(path);

  // Only a failure with nothing to show takes the whole area; a failure three
  // pages in leaves the movements already read on screen with the error above
  // them, the convention CursorList set (whole-branch review, M2).
  if (error && !rows.length) return <ErrorState message={error} onRetry={refetch} />;

  // "Still loading" and "that was the last page" are different facts:
  // `nextCursor` is null while a page is in flight, so the button must stay
  // mounted on `loading` too, or it vanishes mid-click (CursorList, M1).
  const showLoadMore = Boolean(nextCursor) || (loading && rows.length > 0);

  return (
    <>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : null}

      {loading && !rows.length ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState message="No movements match these filters." />
      ) : (
        <ul className="space-y-3">
          {rows.map((movement) => (
            <MovementRow key={movement.movement_id} movement={movement} />
          ))}
        </ul>
      )}

      {showLoadMore ? (
        <div className="py-3 text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !nextCursor}
            onClick={loadMore}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Exported so a test harness can mount the real screen without Next's app
 * router context (`useSearchParams` only exists inside it). The default export
 * below is the page; this is the page's whole body.
 */
export function MovementsExplorer({ initialAccountId = "" }: { initialAccountId?: string }) {
  const [kind, setKind] = React.useState("");
  const [accountId, setAccountId] = React.useState(initialAccountId);
  const [referenceInput, setReferenceInput] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [dates, setDates] = React.useState<DateRange>(EMPTY_RANGE);

  // Debounced like the merchants search box: every committed keystroke is a
  // new path, and a new path is a remount that discards loaded pages. 400ms,
  // the same figure that screen uses.
  React.useEffect(() => {
    const timer = setTimeout(() => setReference(referenceInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [referenceInput]);

  const path = React.useMemo(
    () => movementsPath({ kind, reference, accountId, after: dates.after, before: dates.before }),
    [kind, reference, accountId, dates.after, dates.before],
  );

  return (
    <>
      <PageHeader
        title="Movements"
        subtitle="Every ledger movement, newest first, with both sides of each one."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <KindFilter value={kind} onChange={setKind} />
        <Input
          placeholder="Reference contains…"
          aria-label="Reference"
          className="max-w-xs"
          value={referenceInput}
          onChange={(e) => setReferenceInput(e.target.value)}
        />
        <Input
          placeholder="Account id"
          aria-label="Account id"
          className="max-w-xs"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        />
        <DateRangeFilter value={dates} onChange={setDates} />
      </div>

      {/* THE KEY IS THE POINT -- see the file header. `path` identifies the
          query, so any filter change mounts a fresh list and the previous
          filter's accumulated rows, cursor and applied-set go with the old
          instance. Without it the operator would silently be reading one
          filter's rows under another filter's controls. */}
      <MovementsList key={path} path={path} />
    </>
  );
}

function MovementsPageInner() {
  const searchParams = useSearchParams();
  // Seeded from the ledger screen's row click
  // (`/daraja/ledger/movements?account_id=<id>`). Read once as the initial
  // value of editable state: the operator must be able to clear it.
  return <MovementsExplorer initialAccountId={searchParams.get("account_id") ?? ""} />;
}

export default function MovementsPage() {
  // useSearchParams needs a Suspense boundary above it, the same shape
  // app/(app)/search/page.tsx already uses.
  return (
    <React.Suspense fallback={<LoadingBlock />}>
      <MovementsPageInner />
    </React.Suspense>
  );
}
