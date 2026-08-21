"use client";
import * as React from "react";
import { toast } from "sonner";

import api from "@/lib/axiosInstance";
import { useAdminResource } from "@/lib/useAdminResource";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatTile } from "@/components/overview/StatTile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatNumber, formatDateTime } from "@/lib/format";
import type { SystemHealth, ActivityRow } from "@/types/admin";

export default function SystemPage() {
  const { data, loading, error, refetch } = useAdminResource<SystemHealth>(
    "/admin/system/health/",
  );
  const [flagModalOpen, setFlagModalOpen] = React.useState(false);

  const activityColumns: Column<ActivityRow>[] = [
    { key: "created_at", header: "Time", render: (r) => formatDateTime(r.created_at) },
    {
      key: "method",
      header: "Method",
      render: (r) => <span className="font-mono text-xs text-text-muted">{r.method}</span>,
    },
    {
      key: "path",
      header: "Path",
      render: (r) => (
        <span
          className="block max-w-xs truncate font-mono text-xs text-text"
          title={r.path}
        >
          {r.path}
        </span>
      ),
    },
    { key: "feature", header: "Feature", render: (r) => r.feature || "—" },
    {
      key: "status_code",
      header: "Status",
      render: (r) => (
        <StatusBadge variant={r.status_code < 400 ? "success" : "danger"}>
          {r.status_code}
        </StatusBadge>
      ),
    },
    {
      key: "duration_ms",
      header: "Duration",
      render: (r) => `${formatNumber(r.duration_ms)} ms`,
    },
    { key: "user", header: "User", render: (r) => r.user || "—" },
    { key: "org", header: "MFI", render: (r) => r.org || "—" },
  ];

  if (loading && !data) {
    return (
      <>
        <PageHeader title="System" subtitle="Platform health, activity, and feature flags" />
        {error ? <ErrorState message={error} onRetry={refetch} /> : <LoadingBlock />}
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="System" subtitle="Platform health, activity, and feature flags" />
        <ErrorState message={error} onRetry={refetch} />
      </>
    );
  }

  if (!data) return null;

  const emailVerificationEnabled = data.flags.email_verification_enabled;

  return (
    <>
      <PageHeader title="System" subtitle="Platform health, activity, and feature flags" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Organizations"
          value={formatNumber(data.counts.organizations)}
          sub={`${formatNumber(data.counts.organizations_suspended)} suspended`}
        />
        <StatTile label="Users" value={formatNumber(data.counts.users)} />
        <StatTile label="Borrowers" value={formatNumber(data.counts.borrowers)} />
        <StatTile label="Loans" value={formatNumber(data.counts.loans)} />
        <StatTile label="Repayments" value={formatNumber(data.counts.repayments)} />
        <StatTile label="Transactions" value={formatNumber(data.counts.transactions)} />
        <StatTile label="Open issues" value={formatNumber(data.counts.open_issues)} />
        <StatTile label="Failed payments" value={formatNumber(data.counts.failed_payments)} />
        <StatTile label="Audit events" value={formatNumber(data.counts.audit_events)} />
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Feature flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border-soft bg-page-cream/40 p-4">
              <div>
                <div className="font-medium text-text">Email verification enforced</div>
                <p className="mt-0.5 text-sm text-text-muted">
                  When on, all users must verify their email before signing in.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge variant={emailVerificationEnabled ? "success" : "neutral"}>
                  {emailVerificationEnabled ? "On" : "Off"}
                </StatusBadge>
                <Button variant="outline" size="sm" onClick={() => setFlagModalOpen(true)}>
                  {emailVerificationEnabled ? "Turn off" : "Turn on"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<ActivityRow>
              columns={activityColumns}
              rows={data.recent_activity ?? []}
              emptyMessage="No recent activity."
              rowKey={(r) => String(r.id)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent errors</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<ActivityRow>
              columns={activityColumns}
              rows={data.recent_errors ?? []}
              emptyMessage="No recent errors."
              rowKey={(r) => String(r.id)}
            />
          </CardContent>
        </Card>
      </div>

      <DangerousActionModal
        open={flagModalOpen}
        onOpenChange={setFlagModalOpen}
        title={
          emailVerificationEnabled
            ? "Turn off email verification"
            : "Turn on email verification"
        }
        impact="When ON, all users must verify their email. When OFF, verification is not enforced."
        confirmLabel={emailVerificationEnabled ? "Turn off" : "Turn on"}
        requireReason={false}
        onConfirm={async () => {
          try {
            await api.patch("/admin/system/flags/", {
              email_verification_enabled: !emailVerificationEnabled,
            });
            toast.success(
              `Email verification ${!emailVerificationEnabled ? "enabled" : "disabled"}`,
            );
            void refetch();
          } catch {
            toast.error("Failed to update feature flag");
            throw new Error("failed");
          }
        }}
      />
    </>
  );
}
