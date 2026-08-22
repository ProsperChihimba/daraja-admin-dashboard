"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status_badge";
import { StatusBadgeFor } from "@/components/common/StatusBadgeFor";
import { StatTile } from "@/components/overview/StatTile";
import { OrgListTab } from "@/components/org/OrgListTab";
import { OrgTransactionsTab } from "@/components/org/OrgTransactionsTab";
import { SuspendActivateDialog } from "@/components/org/SuspendActivateDialog";
import { RecordPaymentDialog } from "@/components/org/RecordPaymentDialog";
import { formatMoney, formatNumber, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type {
  OrganizationDetail,
  OrganizationStaffMember,
  OrganizationUser,
  SubscriptionPayment,
  LoanRow,
  BorrowerRow,
  RepaymentRow,
} from "@/types/admin";

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: org, loading, error, refetch } = useAdminResource<OrganizationDetail>(
    `/admin/organizations/${id}/`,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);

  if (loading && !org) {
    return (
      <>
        <PageHeader title="Organization" />
        {error ? <ErrorState message={error} onRetry={refetch} /> : <LoadingBlock />}
      </>
    );
  }
  if (error && !org) {
    return (
      <>
        <PageHeader title="Organization" />
        <ErrorState message={error} onRetry={refetch} />
      </>
    );
  }
  if (!org) return null;

  const subtitle = [org.region, org.district].filter(Boolean).join(" · ") || undefined;
  const isActive = org.status === "active";

  // ── Column defs for the org-scoped operational tabs ──────────────
  const loanColumns: Column<LoanRow>[] = [
    { key: "loan_id", header: "Loan #", render: (l) => l.loan_id },
    { key: "borrower_name", header: "Borrower", render: (l) => l.borrower_name },
    { key: "principal", header: "Principal", render: (l) => formatMoney(l.principal) },
    { key: "outstanding", header: "Outstanding", render: (l) => formatMoney(l.outstanding) },
    { key: "status", header: "Status", render: (l) => <StatusBadgeFor status={l.status} kind="loan" /> },
    { key: "start_date", header: "Start", render: (l) => formatDate(l.start_date) },
  ];
  const borrowerColumns: Column<BorrowerRow>[] = [
    {
      key: "full_name",
      header: "Name",
      render: (b) => (
        <div>
          <div className="font-medium text-text">{b.full_name}</div>
          <div className="text-xs text-text-muted">{b.system_id}</div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (b) => b.phone ?? "—" },
    { key: "status", header: "Status", render: (b) => <StatusBadgeFor status={b.status} kind="borrower" /> },
    { key: "outstanding_debt", header: "Outstanding debt", render: (b) => formatMoney(b.outstanding_debt) },
  ];
  const repaymentColumns: Column<RepaymentRow>[] = [
    { key: "repayment_id", header: "Repayment #", render: (r) => r.repayment_id },
    { key: "loan_loan_id", header: "Loan #", render: (r) => r.loan_loan_id },
    { key: "amount", header: "Amount", render: (r) => formatMoney(r.amount_paid ?? r.amount) },
    { key: "paid_date", header: "Paid", render: (r) => formatDate(r.paid_date) },
    { key: "status", header: "Status", render: (r) => <StatusBadgeFor status={r.status} kind="loan" /> },
  ];
  const staffColumns: Column<OrganizationStaffMember>[] = [
    { key: "full_name", header: "Name", render: (s) => s.full_name ?? "—" },
    { key: "phone", header: "Phone", render: (s) => s.phone ?? "—" },
    { key: "role", header: "Role", render: (s) => s.role ?? "—" },
    { key: "status", header: "Status", render: (s) => s.status ?? "—" },
    { key: "has_login", header: "Has login", render: (s) => (s.has_login ? "Yes" : "No") },
  ];
  const userColumns: Column<OrganizationUser>[] = [
    { key: "name", header: "Name", render: (u) => u.name ?? "—" },
    { key: "phone", header: "Phone", render: (u) => u.phone ?? "—" },
    { key: "email", header: "Email", render: (u) => u.email ?? "—" },
    { key: "role", header: "Role", render: (u) => u.role ?? "—" },
    { key: "staff_role", header: "Staff role", render: (u) => u.staff_role ?? "—" },
  ];
  const paymentColumns: Column<SubscriptionPayment>[] = [
    { key: "amount", header: "Amount", render: (p) => (p.amount != null ? formatMoney(p.amount) : "—") },
    { key: "status", header: "Status", render: (p) => p.status ?? "—" },
    { key: "date", header: "Date", render: (p) => formatDate(p.paid_at ?? p.created_at) },
  ];

  return (
    <>
      <PageHeader
        title={org.name}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
              Record payment
            </Button>
            <Button
              variant={isActive ? "destructive" : "outline"}
              onClick={() => setDialogOpen(true)}
            >
              {isActive ? "Suspend" : "Activate"}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="performance">
        <TabsList variant="line" className="mb-4 h-auto flex-wrap">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="borrowers">Borrowers</TabsTrigger>
          <TabsTrigger value="repayments">Repayments</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="staff">Staff &amp; Users</TabsTrigger>
        </TabsList>

        {/* ── Performance: MFI-level portfolio + subscription + status ── */}
        <TabsContent value="performance">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Borrowers" value={formatNumber(org.portfolio.borrowers)} />
                  <StatTile
                    label="Active loans"
                    value={`${formatNumber(org.portfolio.loans_active)} of ${formatNumber(org.portfolio.loans_total)}`}
                  />
                  <StatTile label="Overdue loans" value={formatNumber(org.portfolio.loans_overdue)} />
                  <StatTile label="Disbursed" value={formatMoney(org.portfolio.disbursed)} />
                  <StatTile label="Collected" value={formatMoney(org.portfolio.collected)} />
                  <StatTile label="Outstanding" value={formatMoney(org.portfolio.outstanding)} />
                  <StatTile label="Collected today" value={formatMoney(org.portfolio.collected_today)} />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div>
                    <StatusBadge variant={isActive ? "success" : "danger"}>
                      {isActive ? "Active" : "Suspended"}
                    </StatusBadge>
                  </div>
                  {!isActive ? (
                    <div className="text-sm text-text-muted">
                      Suspended {formatDateTime(org.suspended_at)}
                      {org.suspended_reason ? ` — ${org.suspended_reason}` : ""}
                    </div>
                  ) : null}
                  <div className="text-sm text-text-muted">Support phone: {org.support_phone ?? "—"}</div>
                  <div className="text-sm text-text-muted">Registered {formatDate(org.created_at)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subscription</CardTitle>
                </CardHeader>
                <CardContent>
                  {org.subscription ? (
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="font-medium text-text">{org.subscription.package?.name ?? "—"}</div>
                      <div className="text-text-muted">Status: {org.subscription.status ?? "—"}</div>
                      <div className="text-text-muted">
                        Expiry: {formatDate(org.subscription.current_period_end)}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">No subscription.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent subscription payments</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<SubscriptionPayment>
                  columns={paymentColumns}
                  rows={org.recent_payments ?? []}
                  rowKey={(p) => p.id ?? p.order_id ?? JSON.stringify(p)}
                  emptyMessage="No payments found."
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="loans">
          <OrgListTab<LoanRow>
            orgId={org.id}
            path="/admin/loans/"
            columns={loanColumns}
            rowKey={(l) => l.id}
            onRowClick={(l) => router.push(`/loans/${l.id}`)}
            emptyMessage="No loans for this MFI."
          />
        </TabsContent>

        <TabsContent value="borrowers">
          <OrgListTab<BorrowerRow>
            orgId={org.id}
            path="/admin/borrowers/"
            columns={borrowerColumns}
            rowKey={(b) => b.id}
            onRowClick={(b) => router.push(`/borrowers/${b.id}`)}
            emptyMessage="No borrowers for this MFI."
          />
        </TabsContent>

        <TabsContent value="repayments">
          <OrgListTab<RepaymentRow>
            orgId={org.id}
            path="/admin/repayments/"
            columns={repaymentColumns}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/loans/${r.loan_id ?? ""}`)}
            emptyMessage="No repayments for this MFI."
          />
        </TabsContent>

        <TabsContent value="transactions">
          <OrgTransactionsTab orgId={org.id} />
        </TabsContent>

        <TabsContent value="staff">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<OrganizationStaffMember>
                  columns={staffColumns}
                  rows={org.staff ?? []}
                  rowKey={(s) => s.id}
                  emptyMessage="No staff found."
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Users</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<OrganizationUser>
                  columns={userColumns}
                  rows={org.users ?? []}
                  rowKey={(u) => u.id}
                  emptyMessage="No users found."
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <SuspendActivateDialog
        org={{ id: org.id, status: org.status, name: org.name }}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDone={() => {
          setDialogOpen(false);
          void refetch();
        }}
      />
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        organizationId={org.id}
        onDone={() => {
          setPaymentDialogOpen(false);
          void refetch();
        }}
      />
    </>
  );
}
