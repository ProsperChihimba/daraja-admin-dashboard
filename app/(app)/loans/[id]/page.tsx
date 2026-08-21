"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadgeFor } from "@/components/common/StatusBadgeFor";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/overview/StatTile";
import { AdjustLoanDialog } from "@/components/loan/AdjustLoanDialog";
import { formatMoney, formatDate } from "@/lib/format";
import type { LoanDetail, RepaymentLike } from "@/types/admin";

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: loan, loading, error, refetch } = useAdminResource<LoanDetail>(
    `/admin/loans/${id}/`,
  );
  const [adjustOpen, setAdjustOpen] = React.useState(false);

  const repaymentColumns: Column<RepaymentLike>[] = [
    { key: "payment_no", header: "#", render: (r) => r.payment_no ?? "—" },
    {
      key: "scheduled_date",
      header: "Due date",
      render: (r) => formatDate(r.scheduled_date),
    },
    {
      key: "paid_date",
      header: "Paid date",
      render: (r) => formatDate(r.paid_date),
    },
    {
      key: "amount",
      header: "Amount",
      render: (r) => (r.amount != null ? formatMoney(r.amount) : "—"),
    },
    {
      key: "amount_paid",
      header: "Amount paid",
      render: (r) => (r.amount_paid != null ? formatMoney(r.amount_paid) : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadgeFor status={r.status} kind="loan" />,
    },
    {
      key: "transaction_reference",
      header: "Reference",
      render: (r) => r.transaction_reference || "—",
    },
  ];

  if (loading || !loan) {
    return (
      <>
        <PageHeader title="Loan" />
        {error ? <ErrorState message={error} onRetry={refetch} /> : <LoadingBlock />}
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Loan" />
        <ErrorState message={error} onRetry={refetch} />
      </>
    );
  }

  const collateral = loan.collateral;

  return (
    <>
      <PageHeader
        title={`Loan ${loan.loan_id}`}
        subtitle={`${loan.borrower_name ?? "—"} · ${loan.organization?.name ?? "—"}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setAdjustOpen(true)}>
              Adjust
            </Button>
            <StatusBadgeFor status={loan.status} kind="loan" />
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Money summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile label="Principal" value={formatMoney(loan.principal)} />
              <StatTile label="Interest" value={formatMoney(loan.interest_amount)} />
              <StatTile label="Fees" value={formatMoney(loan.fees_total)} />
              <StatTile label="Total payable" value={formatMoney(loan.total_payable)} />
              <StatTile label="Amount paid" value={formatMoney(loan.amount_paid)} />
              <StatTile label="Outstanding" value={formatMoney(loan.outstanding)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-xs text-text-muted">Payment method</div>
                <div className="text-text">{loan.payment_method ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Interest</div>
                <div className="text-text">
                  {loan.interest_kind === "percent"
                    ? `${loan.interest_rate ?? "—"}% / ${loan.interest_rate_unit ?? "—"}`
                    : (loan.interest_kind ?? "—")}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Duration</div>
                <div className="text-text">
                  {loan.loan_duration ?? "—"} {loan.loan_duration_unit ?? ""}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Repayment frequency</div>
                <div className="text-text">{loan.repayment_frequency ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Repayment count</div>
                <div className="text-text">{loan.repayment_count ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Repayment per period</div>
                <div className="text-text">
                  {loan.repayment_per_period != null ? formatMoney(loan.repayment_per_period) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Start date</div>
                <div className="text-text">{formatDate(loan.start_date)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">End date</div>
                <div className="text-text">{formatDate(loan.end_date)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loan.fees && loan.fees.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Fees</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {loan.fees.map((f, i) => (
                <div key={f.id ?? i} className="flex items-center justify-between">
                  <span className="text-text">{f.name}</span>
                  <span className="text-text-muted">{formatMoney(f.amount)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {collateral ? (
          <Card>
            <CardHeader>
              <CardTitle>Collateral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-xs text-text-muted">Asset</div>
                  <div className="text-text">{collateral.asset_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Asset value</div>
                  <div className="text-text">
                    {collateral.asset_value != null ? formatMoney(collateral.asset_value) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Status</div>
                  <div className="text-text">{collateral.status ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Guarantor</div>
                  <div className="text-text">{collateral.guarantor_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Guarantor phone</div>
                  <div className="text-text">{collateral.guarantor_phone ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Guarantor national ID</div>
                  <div className="text-text">{collateral.guarantor_national_id ?? "—"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Repayment schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<RepaymentLike>
              columns={repaymentColumns}
              rows={loan.repayments ?? []}
              rowKey={(r) => r.id}
              emptyMessage="No repayments found."
            />
          </CardContent>
        </Card>
      </div>

      <AdjustLoanDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        loan={{
          id: loan.id,
          loan_id: loan.loan_id,
          status: loan.status,
          outstanding: loan.outstanding,
          amount_paid: loan.amount_paid,
          total_payable: loan.total_payable,
        }}
        onDone={() => {
          setAdjustOpen(false);
          void refetch();
        }}
      />
    </>
  );
}
