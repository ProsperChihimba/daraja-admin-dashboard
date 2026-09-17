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
 */
export function useCursorPages<T, E extends CursorPaged<T> = CursorPaged<T>>(
  path: string,
) {
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [rows, setRows] = React.useState<T[]>([]);
  const applied = React.useRef<Set<string>>(new Set());
  const { data, dataKey, loading, error, refetch } = useDarajaResource<E>(
    path,
    cursor ? { cursor } : undefined,
  );

  const requestKey = JSON.stringify(cursor ? { cursor } : {});
  // The response for what is being asked for NOW, or nothing. Everything
  // below reads this rather than `data`, so a page held over from an earlier
  // cursor can neither be appended nor hand back its already-consumed `next`.
  const page = dataKey === requestKey ? data : null;

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
    loading,
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

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !rows.length}
        rowKey={rowKey}
        emptyMessage={emptyMessage}
      />
      {nextCursor ? (
        <div className="py-3 text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={loadMore}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
