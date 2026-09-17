// components/daraja/CursorList.tsx
"use client";
import * as React from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { ErrorState } from "@/components/common/PageStates";
import { Button } from "@/components/ui/button";
import { useDarajaResource } from "@/lib/darajaAuth";
import type { CursorPaged } from "@/types/daraja";

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
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [rows, setRows] = React.useState<T[]>([]);
  const { data, loading, error, refetch } = useDarajaResource<CursorPaged<T>>(
    path,
    cursor ? { cursor } : undefined,
  );

  React.useEffect(() => {
    if (!data) return;
    setRows((prev) => (cursor ? [...prev, ...data.results] : data.results));
  }, [data, cursor]);

  const nextCursor = React.useMemo(() => {
    if (!data?.next) return null;
    try {
      return new URL(data.next).searchParams.get("cursor");
    } catch {
      return null;
    }
  }, [data?.next]);

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
            onClick={() => setCursor(nextCursor)}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
