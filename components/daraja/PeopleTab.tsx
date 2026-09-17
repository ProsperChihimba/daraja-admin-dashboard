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

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading && !employees.length) return <LoadingBlock />;

  return (
    <div className="space-y-8">
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
        {nextCursor ? (
          <div className="py-3 text-center">
            <Button variant="outline" size="sm" disabled={loading} onClick={loadMore}>
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
