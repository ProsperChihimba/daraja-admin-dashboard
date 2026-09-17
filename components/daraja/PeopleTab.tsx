// components/daraja/PeopleTab.tsx
"use client";
import { DataTable } from "@/components/common/DataTable";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { useDarajaResource } from "@/lib/darajaAuth";
import type { PeoplePayload } from "@/types/daraja";

export function PeopleTab({ employerId }: { employerId: string }) {
  const { data, loading, error, refetch } = useDarajaResource<PeoplePayload>(
    `/employers/${employerId}/people/`,
  );
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading && !data) return <LoadingBlock />;
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-2 font-heading text-sm font-semibold text-text">
          Employees
        </h3>
        <DataTable
          rows={data?.employees ?? []}
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
      </section>
      <section>
        <h3 className="mb-2 font-heading text-sm font-semibold text-text">
          Branches
        </h3>
        <DataTable
          rows={data?.branches ?? []}
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
