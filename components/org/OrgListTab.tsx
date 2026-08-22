"use client";

import * as React from "react";
import { useAdminResource } from "@/lib/useAdminResource";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Pagination } from "@/components/common/Pagination";
import type { Paginated } from "@/types/admin";

const PAGE_SIZE = 100;

/** Generic org-scoped, paginated list used by the MFI detail tabs. Fetches
 *  `path?org=<orgId>&page=…` and renders the shared DataTable + Pagination. */
export function OrgListTab<T>({
  orgId,
  path,
  columns,
  rowKey,
  onRowClick,
  emptyMessage,
  extraParams,
}: {
  orgId: string;
  path: string;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage: string;
  extraParams?: Record<string, unknown>;
}) {
  const [page, setPage] = React.useState(1);
  const { data, loading, error, refetch } = useAdminResource<Paginated<T>>(path, {
    org: orgId,
    page,
    ...extraParams,
  });

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <DataTable<T>
        columns={columns}
        rows={data?.results ?? []}
        loading={loading}
        emptyMessage={emptyMessage}
        rowKey={rowKey}
        onRowClick={onRowClick}
      />
      {data ? (
        <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
      ) : null}
    </>
  );
}
