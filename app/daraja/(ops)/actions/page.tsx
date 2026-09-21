// app/daraja/(ops)/actions/page.tsx  (URL: /daraja/actions)
//
// The money-action queue: every request anyone has made, pending first
// (dashboard/views/actions.py's `ActionRequests.get` ranks them explicitly,
// not alphabetically -- state's literal spelling would otherwise bury
// "pending" behind "executed"). Lives inside the Daraja route group, like
// every other ops screen, so it guards on the Daraja session rather than
// RequireAuth's Ankara superuser check.
"use client";
import * as React from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, EmptyState, LoadingBlock } from "@/components/common/PageStates";
import { Pagination } from "@/components/common/Pagination";
import { ActionRequestCard } from "@/components/daraja/ActionRequestCard";
import { extractOpsErrorMessage, listActionRequests, type ActionRequest } from "@/lib/darajaActions";
import type { Paginated } from "@/types/daraja";

const PAGE_SIZE = 50;

export default function ActionsQueuePage() {
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Paginated<ActionRequest> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await listActionRequests({ page, page_size: PAGE_SIZE });
      setData(d);
    } catch (e) {
      setError(extractOpsErrorMessage(e, "Failed to load the queue."));
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <>
      <PageHeader
        title="Money actions"
        subtitle={data ? `${data.count} total` : undefined}
      />

      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {loading && !data ? (
        <LoadingBlock />
      ) : data && data.results.length === 0 ? (
        <EmptyState message="No money-action requests yet." />
      ) : data ? (
        <div className="space-y-3">
          {data.results.map((r) => (
            <ActionRequestCard key={r.request_id} request={r} onDecided={refetch} />
          ))}
        </div>
      ) : null}

      <Pagination page={page} count={data?.count ?? 0} pageSize={PAGE_SIZE} onPage={setPage} />
    </>
  );
}
