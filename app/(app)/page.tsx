"use client";

import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { StatTile, StatTileSkeleton } from "@/components/overview/StatTile";
import { AlertsPanel } from "@/components/overview/AlertsPanel";
import { formatMoney } from "@/lib/format";
import type { OverviewStats } from "@/types/admin";

export default function Home() {
  const { data, loading, error, refetch } = useAdminResource<OverviewStats>("/admin/overview/stats/");

  return (
    <>
      <PageHeader title="Overview" subtitle="What's happening across Ankara right now" />

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Organizations"
              value={data.organizations.total}
              sub={`${data.organizations.active} active · ${data.organizations.suspended} suspended`}
            />
            <StatTile
              label="Borrowers"
              value={data.borrowers.total}
              sub={`${data.borrowers.with_debt} with debt · ${data.borrowers.overdue} overdue`}
            />
            <StatTile
              label="Active loans"
              value={data.loans.active}
              sub={`of ${data.loans.total} total`}
            />
            <StatTile label="Outstanding portfolio" value={formatMoney(data.loans.outstanding)} />
            <StatTile label="Disbursed (all-time)" value={formatMoney(data.loans.disbursed)} />
            <StatTile label="Collected (all-time)" value={formatMoney(data.loans.collected)} />
            <StatTile
              label="Today's collections"
              value={formatMoney(data.today.collections)}
              sub={`${data.today.collections_count} payments`}
            />
            <StatTile
              label="Today's disbursements"
              value={formatMoney(data.today.disbursements)}
              sub={`${data.today.disbursements_count} loans`}
            />
            <StatTile
              label="Overdue"
              value={formatMoney(data.overdue.amount)}
              sub={`${data.overdue.loans} loans`}
            />
            <StatTile
              label="Revenue (this month)"
              value={formatMoney(data.revenue.this_month)}
              sub={`${formatMoney(data.revenue.total)} all-time`}
            />
            <StatTile
              label="Subscriptions"
              value={data.subscriptions.active}
              sub={`${data.subscriptions.expiring_soon} expiring soon · ${data.subscriptions.expired} expired`}
            />
            <StatTile
              label="Failed payments"
              value={data.revenue.failed_payments}
              sub={`${data.revenue.pending_payments} pending`}
            />
          </div>

          <AlertsPanel alerts={data.alerts} />
        </>
      )}
    </>
  );
}
