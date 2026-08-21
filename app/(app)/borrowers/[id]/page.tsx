"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadgeFor } from "@/components/common/StatusBadgeFor";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatMoney, formatDate } from "@/lib/format";
import type { BorrowerDetail, LoanRowLike } from "@/types/admin";

export default function BorrowerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: b, loading, error, refetch } = useAdminResource<BorrowerDetail>(
    `/admin/borrowers/${id}/`,
  );

  const loanColumns: Column<LoanRowLike>[] = [
    { key: "loan_id", header: "Loan #", render: (l) => l.loan_id },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusBadgeFor status={l.status} kind="loan" />,
    },
    {
      key: "principal",
      header: "Principal",
      render: (l) => formatMoney(l.principal),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      render: (l) => formatMoney(l.outstanding),
    },
    { key: "start_date", header: "Start", render: (l) => formatDate(l.start_date) },
    { key: "end_date", header: "End", render: (l) => formatDate(l.end_date) },
  ];

  if (loading && !b) {
    return (
      <>
        <PageHeader title="Borrower" />
        {error ? <ErrorState message={error} onRetry={refetch} /> : <LoadingBlock />}
      </>
    );
  }

  if (error && !b) {
    return (
      <>
        <PageHeader title="Borrower" />
        <ErrorState message={error} onRetry={refetch} />
      </>
    );
  }

  if (!b) return null;

  const initials = (b.full_name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <>
      <PageHeader title={b.full_name} subtitle={`${b.system_id} · ${b.phone ?? "—"}`} />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar size="lg">
                {b.profile_photo_url ? <AvatarImage src={b.profile_photo_url} alt={b.full_name} /> : null}
                <AvatarFallback>{initials || "?"}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-xs text-text-muted">Status</div>
                  <StatusBadgeFor status={b.status} kind="borrower" />
                </div>
                <div>
                  <div className="text-xs text-text-muted">Nature</div>
                  <div className="text-text">{b.nature ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Gender</div>
                  <div className="text-text">{b.gender ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">National ID</div>
                  <div className="text-text">{b.national_id ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Profession</div>
                  <div className="text-text">{b.profession ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">MFI</div>
                  <div className="text-text">{b.organization?.name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Location</div>
                  <div className="text-text">
                    {[b.street, b.house_number, b.district, b.region]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Registered</div>
                  <div className="text-text">{formatDate(b.registered_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Active loan amount</div>
                  <div className="text-text">{formatMoney(b.active_loan_amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Outstanding debt</div>
                  <div className="text-text">{formatMoney(b.outstanding_debt)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {b.guarantor ? (
          <Card>
            <CardHeader>
              <CardTitle>Guarantor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-xs text-text-muted">Name</div>
                  <div className="text-text">{b.guarantor.full_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Phone</div>
                  <div className="text-text">{b.guarantor.phone ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Relationship</div>
                  <div className="text-text">{b.guarantor.relationship ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">National ID</div>
                  <div className="text-text">{b.guarantor.national_id ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Address</div>
                  <div className="text-text">{b.guarantor.address ?? "—"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<LoanRowLike>
              columns={loanColumns}
              rows={b.loans ?? []}
              rowKey={(l) => l.id}
              emptyMessage="No loans found."
              onRowClick={(l) => router.push(`/loans/${l.id}`)}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
