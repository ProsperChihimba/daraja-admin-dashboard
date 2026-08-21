"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingBlock, ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatTile } from "@/components/overview/StatTile";
import { StatusBadge } from "@/components/ui/status_badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { formatNumber, formatDate, formatRelative } from "@/lib/format";
import type {
  AdoptionStats,
  RecentSignup,
  TopActiveOrg,
} from "@/types/admin";

const BRAND = "#33993C";

function SubscriptionBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-text-faint">None</span>;
  const variant =
    status === "active"
      ? "success"
      : status === "trial"
        ? "warning"
        : "danger";
  return <StatusBadge variant={variant}>{status}</StatusBadge>;
}

export default function OverviewPage() {
  const router = useRouter();
  const { data, loading, error, refetch } =
    useAdminResource<AdoptionStats>("/admin/overview/adoption/");

  const signupColumns: Column<RecentSignup>[] = [
    {
      key: "name",
      header: "MFI",
      render: (o) => (
        <div>
          <div className="font-medium text-text">{o.name}</div>
          <div className="text-xs text-text-muted">
            {formatNumber(o.users)} users · {formatNumber(o.loans)} loans
          </div>
        </div>
      ),
    },
    { key: "created_at", header: "Signed up", render: (o) => formatDate(o.created_at) },
    {
      key: "subscription_status",
      header: "Plan",
      render: (o) => <SubscriptionBadge status={o.subscription_status} />,
    },
    {
      key: "last_activity_at",
      header: "Last active",
      render: (o) => (
        <span className={o.last_activity_at ? "text-text" : "text-text-faint"}>
          {formatRelative(o.last_activity_at)}
        </span>
      ),
    },
  ];

  const activeColumns: Column<TopActiveOrg>[] = [
    { key: "name", header: "MFI", render: (o) => o.name },
    {
      key: "events_7d",
      header: "Events (7d)",
      render: (o) => (
        <span className="font-medium tabular-nums">{formatNumber(o.events_7d)}</span>
      ),
    },
    { key: "last_activity_at", header: "Last active", render: (o) => formatRelative(o.last_activity_at) },
    {
      key: "subscription_status",
      header: "Plan",
      render: (o) => <SubscriptionBadge status={o.subscription_status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Adoption & usage across the platform"
      />

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading || !data ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          {/* KPI row — adoption posture */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total MFIs"
              value={formatNumber(data.summary.total_orgs)}
              sub={`${formatNumber(data.summary.suspended)} suspended`}
            />
            <StatTile
              label="New this week"
              value={formatNumber(data.summary.new_this_week)}
              sub={`${formatNumber(data.summary.new_this_month)} this month`}
            />
            <StatTile
              label="Paying MFIs"
              value={formatNumber(data.summary.paying)}
              sub={`of ${formatNumber(data.summary.total_orgs)} total`}
            />
            <StatTile
              label="Active (7 days)"
              value={formatNumber(data.summary.active_7d)}
              sub={`${formatNumber(data.summary.active_30d)} in 30 days`}
            />
            <StatTile
              label="Trial MFIs"
              value={formatNumber(data.summary.trial)}
            />
            <StatTile
              label="Expired"
              value={formatNumber(data.summary.expired)}
            />
            <StatTile
              label="Usage events (7d)"
              value={formatNumber(data.summary.activity_events_7d)}
            />
            <StatTile
              label="Staff users"
              value={formatNumber(data.summary.total_users)}
            />
          </div>

          {/* Signups trend */}
          <Card>
            <CardHeader>
              <CardTitle>New MFI signups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.signups_by_month}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--color-border-soft)"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-secondary)" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--color-border-soft)",
                        background: "var(--color-surface)",
                        fontSize: 13,
                      }}
                      labelStyle={{ color: "var(--color-text)" }}
                    />
                    <Bar dataKey="count" name="Signups" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent signups + most active */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 font-heading text-lg font-bold text-text">
                Recent signups
              </h2>
              <DataTable<RecentSignup>
                columns={signupColumns}
                rows={data.recent_signups}
                emptyMessage="No signups yet."
                rowKey={(o) => o.id}
                onRowClick={(o) => router.push(`/organizations/${o.id}`)}
              />
            </div>
            <div>
              <h2 className="mb-3 font-heading text-lg font-bold text-text">
                Most active MFIs (7 days)
              </h2>
              <DataTable<TopActiveOrg>
                columns={activeColumns}
                rows={data.top_active_orgs}
                emptyMessage="No activity recorded yet."
                rowKey={(o) => o.id}
                onRowClick={(o) => router.push(`/organizations/${o.id}`)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
