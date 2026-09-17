// app/daraja/(ops)/ledger/page.tsx  (URL: /daraja/ledger)
//
// The screen this whole plan exists for: the health strip an operator reads
// during an incident, above the house's own accounts (Revenue, Card
// Top-ups, Lipa Namba, and every other non-wallet ledger account). Customer
// wallets live on the wallet screens, not here -- see OpsAccountRow.
//
// `position` and `accounts` are two independent GETs, fetched and errored
// independently: a failed live Selcom read inside `position` must not blank
// out the accounts table, and a slow accounts query must not hide the health
// strip. Each gets its own ErrorState, following the pattern in
// app/daraja/(ops)/merchants/page.tsx.
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import { formatOpsMoney } from "@/lib/darajaMoney";
import { useDarajaResource } from "@/lib/darajaAuth";
import { age, HealthStrip } from "@/components/daraja/HealthStrip";
import type {
  CommandRunInfo,
  LedgerPosition,
  OpsAccountRow,
  OpsAccountsPayload,
} from "@/types/daraja";

export default function LedgerPage() {
  const router = useRouter();

  const {
    data: position,
    loading: positionLoading,
    error: positionError,
    refetch: refetchPosition,
  } = useDarajaResource<LedgerPosition>("/ledger/position/");

  const {
    data: accounts,
    loading: accountsLoading,
    error: accountsError,
    refetch: refetchAccounts,
  } = useDarajaResource<OpsAccountsPayload>("/ledger/accounts/");

  const columns: Column<OpsAccountRow>[] = [
    { key: "label", header: "Account" },
    { key: "kind", header: "Kind" },
    {
      key: "designation",
      header: "Designation",
      render: (a) => a.designation ?? "—",
    },
    {
      key: "balance",
      header: "Balance",
      // Entry-summed decimal string, 20,2 -- handed straight to the ops
      // formatter, same rule as everywhere else on this branch: no
      // Number(), no parseFloat(), no `|| 0`.
      render: (a) => formatOpsMoney(a.balance),
    },
  ];

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle={
          accounts
            ? `${accounts.accounts.length} account${accounts.accounts.length === 1 ? "" : "s"} · ${formatOpsMoney(accounts.total)} total`
            : undefined
        }
      />

      {positionError ? (
        <ErrorState message={positionError} onRetry={refetchPosition} />
      ) : position ? (
        <div className="mb-6">
          <HealthStrip position={position} />
          <LastRuns position={position} />
        </div>
      ) : positionLoading ? (
        <LoadingBlock className="mb-6" />
      ) : null}

      {accountsError ? <ErrorState message={accountsError} onRetry={refetchAccounts} /> : null}

      <DataTable
        columns={columns}
        rows={accounts?.accounts ?? []}
        loading={accountsLoading}
        rowKey={(a) => a.account_id}
        emptyMessage="No ops accounts found."
        onRowClick={(a) => router.push(`/daraja/ledger/movements?account_id=${a.account_id}`)}
      />
    </>
  );
}

/**
 * The rendering contract for `last_runs`, straight from the brief this task
 * answers: `ok === false` is a failed run (red); `degraded === true` is a
 * run that gained SOME but not all of its information (amber) -- distinct
 * states, because a half-broken poller must not read as green just because
 * it did not outright fail. `note` carries detail neither boolean can
 * express (e.g. "unreadable=2/7") and is always rendered when present.
 *
 * `last_runs` itself is nullable (its own CommandRun read can fail
 * independently of everything else in the position payload) and is not
 * rendered as an empty strip when it is -- `last_runs_error` explains why.
 */
function LastRuns({ position }: { position: LedgerPosition }) {
  if (position.last_runs_error) {
    return (
      <div className="mt-3 rounded-card border border-border-soft border-l-4 border-l-warning-bg bg-surface p-3 text-xs text-text-muted">
        Last runs unavailable: {position.last_runs_error}
      </div>
    );
  }
  if (!position.last_runs) return null;
  const entries = Object.entries(position.last_runs);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([command, run]) => (
        <LastRunCell key={command} command={command} run={run} />
      ))}
    </div>
  );
}

function LastRunCell({ command, run }: { command: string; run: CommandRunInfo | null }) {
  if (!run) {
    return (
      <div className="rounded-card border border-border-soft bg-surface p-3">
        <div className="text-xs font-medium text-text-muted">{command}</div>
        <div className="mt-1 text-sm text-text-muted">never run</div>
      </div>
    );
  }

  const variant: StatusVariant = !run.ok ? "danger" : run.degraded ? "warning" : "success";
  const label = !run.ok ? "failed" : run.degraded ? "degraded" : "ok";

  return (
    <div className="rounded-card border border-border-soft bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{command}</span>
        <StatusBadge variant={variant}>{label}</StatusBadge>
      </div>
      <div className="mt-1 text-xs text-text-muted">{age(run.age_seconds)}</div>
      {run.note ? <div className="mt-1 text-xs text-text-muted">{run.note}</div> : null}
    </div>
  );
}
