// components/daraja/PeopleTab.tsx
"use client";
import * as React from "react";
import { DataTable } from "@/components/common/DataTable";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { Button } from "@/components/ui/button";
import { useCursorPages } from "@/components/daraja/CursorList";
import type { BranchRow, EmployeeRow, PeoplePayload } from "@/types/daraja";

/**
 * Employees and branches for one merchant.
 *
 * ONE ENDPOINT, TWO COLLECTIONS. `GET /employers/<id>/people/` was
 * `{employees: [...], branches: [...]}` -- both lists complete and uncapped.
 * It is now `{results: [...employees...], next, previous, branches: [...]}`:
 * employees are the cursor-paginated body (page_size default 50, max 200),
 * because on a payroll product the employee table is the one list that can be
 * large for a single merchant. Branches ride ALONGSIDE the envelope and are
 * still complete -- a merchant holds a handful, one per CollectionAccount --
 * so they get no "load more" of their own (dashboard/views/employer_tabs.py).
 */
export function PeopleTab({ employerId }: { employerId: string }) {
  const { rows: employees, page, loading, error, refetch, nextCursor, loadMore } =
    useCursorPages<EmployeeRow, PeoplePayload>(`/employers/${employerId}/people/`);

  // Branches arrive with EVERY page of employees. Held in state rather than
  // read off `page`, which is null while a later page is in flight -- the
  // branch table must not blank out when "Load more employees" is clicked.
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  React.useEffect(() => {
    if (page) setBranches(page.branches);
  }, [page]);

  // ONLY a failure with nothing to show takes the whole tab. This was a bare
  // `if (error)`, which wiped every employee row already read -- and the
  // branch table beside them -- when one later page failed. That is the same
  // defect M2 fixed in CursorList; this file took M1's half of that commit
  // and not M2's, which left the two paginated tabs behaving differently on
  // an identical failure. The rows survive in state either way; what changes
  // is that they stay on screen, with the error reported above them.
  if (error && !employees.length) {
    return <ErrorState message={error} onRetry={refetch} />;
  }
  if (loading && !employees.length) return <LoadingBlock />;

  return (
    <div className="space-y-8">
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}
      <section>
        <h3 className="mb-2 font-heading text-sm font-semibold text-text">
          Employees
        </h3>
        <DataTable
          rows={employees}
          loading={false}
          rowKey={(e) => e.employee_id}
          emptyMessage="No employees."
          columns={[
            // Employee.full_name / Employee.phone_number are both
            // nullable (employee/models.py) -- render an em dash rather
            // than the string "null" or a blank cell that reads as a bug.
            { key: "full_name", header: "Name",
              render: (e) => e.full_name ?? "—" },
            { key: "phone_number", header: "Phone",
              render: (e) => e.phone_number ?? "—" },
          ]}
        />
        {/*
          Mounted while the next page is in flight, not just while a next
          cursor is known: `nextCursor` comes from `page`, which is null from
          the click until the response lands, so this button used to vanish
          mid-load and "loading" looked exactly like "that was the last page"
          (whole-branch review, M1).
        */}
        {nextCursor || (loading && employees.length > 0) ? (
          <div className="py-3 text-center">
            <Button variant="outline" size="sm"
                    disabled={loading || !nextCursor} onClick={loadMore}>
              {loading ? "Loading…" : "Load more employees"}
            </Button>
          </div>
        ) : null}
      </section>
      <section>
        <h3 className="mb-2 font-heading text-sm font-semibold text-text">
          Branches
        </h3>
        <DataTable
          rows={branches}
          loading={false}
          rowKey={(b) => b.branch_id}
          emptyMessage="No branches."
          columns={[{ key: "name", header: "Branch" }]}
        />
      </section>
      <p className="text-xs text-text-muted">
        Read-only: employees and branches belong to the merchant, and an admin
        edit here would silently overwrite what they set in their own app.
      </p>
    </div>
  );
}
