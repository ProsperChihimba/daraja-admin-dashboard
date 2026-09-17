// components/daraja/CursorList.tsx
"use client";
import * as React from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { ErrorState } from "@/components/common/PageStates";
import { Button } from "@/components/ui/button";
import { useDarajaResource } from "@/lib/darajaAuth";
import type { CursorPaged } from "@/types/daraja";

/**
 * Accumulates the pages of one cursor-paginated endpoint.
 *
 * WHY THE `dataKey` CHECK IS THE WHOLE POINT. This effect used to depend on
 * `[data, cursor]` and append `data.results` whenever either changed. Clicking
 * "Load more" changes `cursor` SYNCHRONOUSLY while `data` still holds the
 * previous page (useDarajaResource keeps the old response on screen while the
 * next one is in flight), so the effect ran once with the OLD page under the
 * NEW cursor -- appending page 1 to page 1 -- and again when page 2 arrived.
 * A 60-row statement plus one click listed rows 1-50 twice. It needed no race,
 * no Strict Mode and no slow network, and it reached the Expenses, Statement,
 * Deposits and Cards tables, where the duplicated rows are a merchant's real
 * money (whole-branch review, C1).
 *
 * The fix pairs a response with the request that produced it: `dataKey` is the
 * params `data` was fetched for, so a response is only ever appended under its
 * OWN cursor, and `applied` records which cursors have already been folded in
 * so a page is appended EXACTLY ONCE.
 *
 * DELIBERATELY NOT de-duplication of rows after the fact. De-duping by row id
 * would have hidden this bug rather than fixed it, and it would equally hide
 * genuine repeats -- two real payments of the same amount, seconds apart, are
 * ordinary on a statement and must both be shown.
 *
 * A DIFFERENT `path` IS A DIFFERENT RESULT SET, and this hook now says so
 * itself. `cursor`, `rows` and `applied` all describe ONE query; carried into
 * another they are not merely stale, they are wrong -- the old cursor asks the
 * new query to resume from a position taken in the old one (so page one of the
 * new query is never fetched), and the old rows stay on screen underneath the
 * new query's controls. That was live in shipped code: PeopleTab's path is
 * built from a dynamic-route `employerId`, and Next.js reuses the component
 * instance across merchant-to-merchant navigation, so merchant A's employees
 * were left rendered under merchant B's name. Callers used to have to defend
 * themselves with `key={path}` and every caller that forgot was silently
 * wrong; the reset below makes correctness the default.
 */
export function useCursorPages<T, E extends CursorPaged<T> = CursorPaged<T>>(
  path: string,
) {
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [rows, setRows] = React.useState<T[]>([]);
  const applied = React.useRef<Set<string>>(new Set());

  // Reset DURING RENDER, not in an effect. React discards this render and
  // re-runs it before committing, so the `useDarajaResource` call below never
  // reaches its fetch effect holding the previous query's cursor -- an effect
  // would run only AFTER a committed render had already dispatched a request
  // for the new path carrying the old cursor. This is React's documented
  // "adjusting state when a prop changes" pattern, and it is the whole reason
  // the reset is here rather than in a useEffect.
  //
  // `applied` is deliberately NOT cleared here: `dataKey` now carries the path
  // (lib/darajaAuth.ts), so a key recorded under the previous path can never
  // collide with one under the new path, and the `!cursor` branch below
  // rebuilds the set from scratch when the first page lands.
  const [pathShowing, setPathShowing] = React.useState(path);
  if (path !== pathShowing) {
    setPathShowing(path);
    setCursor(undefined);
    setRows([]);
  }

  const { data, dataKey, isCurrent, loading, error, refetch } =
    useDarajaResource<E>(path, cursor ? { cursor } : undefined);

  // THE RESET ABOVE DOES NOT TOUCH `loading`, AND FOR ONE COMMIT THAT LIED.
  // `loading` lives in useDarajaResource and only turns true inside `refetch`,
  // which runs from a passive effect -- so the committed render immediately
  // after a path change held `rows: []`, `loading: false`, `error: null`, and
  // CursorList below rendered its emptyMessage: "No deposit intents match this
  // filter." about a filter that had not been asked yet. (In PeopleTab the
  // same commit rendered an empty Employees table beside the PREVIOUS
  // merchant's branch list, which is the cross-tenant class the reset exists
  // to remove, surviving in a state variable the reset does not reach.)
  //
  // `isCurrent` already answers this exactly: it is false whenever the held
  // response was not fetched for what is being asked for now, which covers
  // the reset window, the first mount, and a page in flight. An error is
  // excluded so a failure still renders as a failure rather than as a
  // permanent spinner.
  const settling = !isCurrent && error === null;

  // The response for what is being asked for NOW, or nothing. Everything
  // below reads this rather than `data`, so a page held over from an earlier
  // cursor can neither be appended nor hand back its already-consumed `next`.
  //
  // `isCurrent` COMES FROM THE HOOK. This file used to rebuild the hook's key
  // itself, and so did ActivityTab, which meant the composition formula lived
  // in three places and a third consumer that got it slightly wrong would show
  // an empty list forever while its requests all succeeded (review, Important
  // 1). `dataKey` below is used only as an opaque token for `applied`.
  const page = isCurrent ? data : null;

  React.useEffect(() => {
    if (!page || dataKey === null) return;
    if (!cursor) {
      // First page (or a refetch of it): replace, and forget what was applied.
      applied.current = new Set([dataKey]);
      setRows(page.results);
      return;
    }
    if (applied.current.has(dataKey)) return;
    applied.current.add(dataKey);
    setRows((prev) => [...prev, ...page.results]);
  }, [page, dataKey, cursor]);

  const nextCursor = React.useMemo(() => {
    if (!page?.next) return null;
    try {
      return new URL(page.next).searchParams.get("cursor");
    } catch {
      return null;
    }
  }, [page?.next]);

  return {
    rows,
    page,
    // A freshly reset list reports itself as loading, never as empty.
    loading: loading || settling,
    error,
    refetch,
    nextCursor,
    loadMore: () => nextCursor && setCursor(nextCursor),
  };
}

/**
 * A cursor-paginated tab.
 *
 * These tables are written while being read, so the backend paginates them by
 * cursor and returns no `count` -- which is why this shows "Load more" rather
 * than the numbered Pagination component. Rows accumulate client-side.
 */
export function CursorList<T>({
  path,
  columns,
  rowKey,
  emptyMessage,
}: {
  path: string;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyMessage: string;
}) {
  const { rows, loading, error, refetch, nextCursor, loadMore } =
    useCursorPages<T>(path);

  // ONLY a failure with nothing to show takes the whole area. An error three
  // pages into a statement used to replace the entire table with ErrorState:
  // the accumulated rows survived in state but vanished from the screen, so
  // an operator reading a merchant's money lost their place -- and could not
  // tell whether the rows were gone or merely hidden -- because one request
  // failed (whole-branch review, M2). The rows already read stay; the error
  // is reported above them, with the same Retry.
  if (error && !rows.length) return <ErrorState message={error} onRetry={refetch} />;

  // "Still loading" and "that was the last page" are two different facts and
  // used to render identically: `nextCursor` derives from `page`, which is
  // null from the click until the response lands, so the button UNMOUNTED
  // while its own next page was in flight and its disabled/"Loading…" state
  // was unreachable (whole-branch review, M1). It stays mounted while a
  // further page is loading, and disappears only when the last page has
  // actually arrived with `next: null`.
  const showLoadMore = Boolean(nextCursor) || (loading && rows.length > 0);

  return (
    <>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : null}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !rows.length}
        rowKey={rowKey}
        emptyMessage={emptyMessage}
      />
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
