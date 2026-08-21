"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status_badge";
import { StatTile } from "@/components/overview/StatTile";
import { SuspendActivateDialog } from "@/components/org/SuspendActivateDialog";
import { RecordPaymentDialog } from "@/components/org/RecordPaymentDialog";
import { formatMoney, formatNumber, formatDate, formatDateTime } from "@/lib/format";
import type {
  OrganizationDetail,
  OrganizationStaffMember,
  OrganizationUser,
  SubscriptionPayment,
} from "@/types/admin";

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: org, loading, error, refetch } = useAdminResource<OrganizationDetail>(
    `/admin/organizations/${id}/`,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);

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
    {
      key: "amount",
      header: "Amount",
      render: (p) => (p.amount != null ? formatMoney(p.amount) : "—"),
    },
    { key: "status", header: "Status", render: (p) => p.status ?? "—" },
    {
      key: "date",
      header: "Date",
      render: (p) => formatDate(p.paid_at ?? p.created_at),
    },
  ];

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

      <div className="flex flex-col gap-4">
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
            <div className="text-sm text-text-muted">
              Support phone: {org.support_phone ?? "—"}
            </div>
            <div className="text-sm text-text-muted">Created {formatDate(org.created_at)}</div>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            {org.subscription ? (
              <div className="flex flex-col gap-1 text-sm">
                <div className="font-medium text-text">
                  {org.subscription.package?.name ?? "—"}
                </div>
                <div className="text-text-muted">
                  Status: {org.subscription.status ?? "—"}
                </div>
                <div className="text-text-muted">
                  Period end: {formatDate(org.subscription.current_period_end)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No subscription.</p>
            )}
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
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
