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
import { formatOpsMoney, UNKNOWN_AMOUNT } from "@/lib/darajaMoney";
import { useDarajaResource } from "@/lib/darajaAuth";
import { age, HealthStrip } from "@/components/daraja/HealthStrip";
import { clockTime, RefreshControl } from "@/components/daraja/RefreshControl";
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
    fetchedAt: positionFetchedAt,
    refetch: refetchPosition,
  } = useDarajaResource<LedgerPosition>("/ledger/position/");

  const {
    data: accounts,
    loading: accountsLoading,
    error: accountsError,
    fetchedAt: accountsFetchedAt,
    refetch: refetchAccounts,
  } = useDarajaResource<OpsAccountsPayload>("/ledger/accounts/");

  const columns: Column<OpsAccountRow>[] = [
    {
      key: "label",
      header: "Account",
      render: (a) => (
        <span className="flex flex-wrap items-center gap-2">
          <span>{a.label}</span>
          {/* THE MIRROR IS NOT THE HOUSE'S MONEY, and the row says so where
              the row is read. The `pool` account mirrors everything sitting
              in the pooled Selcom account -- customers' balances included --
              so an operator adding this line to the others, or reading it as
              Daraja's, would be counting money the house merely holds for
              somebody else. It is listed with its real balance because the
              figure is genuinely useful beside the live pool read; it is
              excluded from `total` and labelled here so the two cannot be
              read as the same kind of money
              (dashboard/views/ledger.py:67-79). */}
          {a.is_pool_mirror ? (
            <StatusBadge variant="warning">pool mirror — not house money</StatusBadge>
          ) : null}
        </span>
      ),
    },
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
            ? // "total" NAMED FOR WHAT IT NOW MEANS. The key is unchanged but
              // the number is not: it is the house's own money, with the pool
              // mirror excluded. Calling it "total" on screen, next to a
              // table that lists the mirror, would invite exactly the sum the
              // backend stopped computing.
              `${accounts.accounts.length} account${accounts.accounts.length === 1 ? "" : "s"} · ${formatOpsMoney(accounts.total)} of the house's own money`
            : undefined
        }
        /* THE ONLY REFRESH THIS SCREEN HAD WAS ErrorState's Retry, reachable
           only once a request had already failed. See RefreshControl for why
           this is a button and a timestamp rather than a poll. Both GETs are
           refetched together: they are independent requests but one reading
           of the house's position, and refreshing half of it would put two
           moments on one screen. */
        actions={
          <RefreshControl
            label="Position"
            fetchedAt={positionFetchedAt}
            busy={positionLoading || accountsLoading}
            onRefresh={() => {
              void refetchPosition();
              void refetchAccounts();
            }}
          />
        }
      />

      {positionError ? (
        <ErrorState message={positionError} onRetry={refetchPosition} />
      ) : position ? (
        <div className="mb-6">
          <HealthStrip position={position} />
          <LastRuns position={position} />
          {/* SAID ONCE, FOR EVERY FIGURE ABOVE. `age()` renders "38s ago" from
              an `age_seconds` the SERVER computed while building this payload,
              so it is a fixed number that looks like a live clock -- the most
              misleading thing on the strip, because it implies a freshness
              none of these figures has. The gap, the pool, the direction and
              the queue depths carry no time of their own at all. */}
          <p className="mt-3 text-xs text-text-faint">
            Every figure above is as of {clockTime(positionFetchedAt)}, and so is
            every &ldquo;x ago&rdquo;: the ages were computed on the server when
            this payload was built and do not count up on their own. Nothing
            here refreshes by itself.
          </p>
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

      {accounts ? (
        <p className="mt-3 text-xs text-text-muted">
          <span className="font-medium">Pool mirror:</span>{" "}
          {/* NEVER `formatOpsMoney` ALONE FOR THE NULL. The backend sends null,
              not "0.00", when there is no pool account at all -- a missing
              mirror and an empty one are different facts, and an em dash with
              no reason beside it reads as the first when it could be either.
              The placeholder is shown WITH its explanation, the same rule the
              health strip follows for every other unreadable figure. */}
          {accounts.pool_mirror === null
            ? `${UNKNOWN_AMOUNT} — no pool account on file`
            : formatOpsMoney(accounts.pool_mirror)}
          {" — the ledger's mirror of everything sitting in the pooled Selcom "}
          {"account, customers' money included. Deliberately not part of the "}
          {"figure above, and not the house's to spend."}
          {accountsFetchedAt !== null
            ? ` Accounts as of ${clockTime(accountsFetchedAt)}.`
            : ""}
        </p>
      ) : null}
    </>
  );
}

/**
 * THE COLOUR RULE FOR `last_runs`, and the third state that changed it.
 *
 * `ok`/`degraded` could say "did the work" and "did some of it"; neither
 * could say "could not run at all", which is what a lock-skipped tick is --
 * and what a WEDGED poller writes every two minutes. `skipped` is that third
 * fact, derived on the backend from an exact match against the writer's own
 * `CommandRun.SKIPPED_NOTE` constant, never from parsing `note`. Four honest
 * states:
 *
 *   did the work   ok=true  degraded=false skipped=false  -> green  "ok"
 *   partial        ok=true  degraded=true  skipped=false  -> amber  "degraded"
 *   could not run  ok=false degraded=false skipped=true   -> amber  "skipped"
 *   dead           ok=false degraded=false skipped=false  -> red    "failed"
 *
 * RED IS RESERVED FOR `ok === false && skipped === false`, and `skipped` is
 * checked FIRST. A skip now sets `ok=false` on the backend (it gained no
 * information about ingestion, which is what `ok=false` means there), so the
 * old `!run.ok ? "danger"` would paint a red alarm on this strip every other
 * minute: skips are routine against a 2-minute cron when a 120s statement
 * timeout with --days 2 can take ~240s. A strip that is red every other
 * minute gets tuned out, and a strip that is tuned out is the 2026-09-16
 * blindness one level down. A wedged poller is meant to surface as the
 * STALENESS of the last non-skipped run instead -- see the honest limit
 * recorded on the cell below. `note` carries detail no boolean can express
 * (e.g. "unreadable=2/7") and is always rendered when present.
 *
 * `last_runs` itself is nullable (its own CommandRun read can fail
 * independently of everything else in the position payload) and is not
 * rendered as an empty strip when it is -- `last_runs_error` explains why.
 *
 * Exported, with `lastRunState` beside it, so the four states can be driven
 * and asserted against the real component rather than a copy of it.
 */
export function lastRunState(run: CommandRunInfo): {
  variant: StatusVariant;
  label: string;
} {
  if (run.skipped) return { variant: "warning", label: "skipped" };
  if (!run.ok) return { variant: "danger", label: "failed" };
  if (run.degraded) return { variant: "warning", label: "degraded" };
  return { variant: "success", label: "ok" };
}

export function LastRuns({ position }: { position: LedgerPosition }) {
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

  const { variant, label } = lastRunState(run);

  return (
    <div className="rounded-card border border-border-soft bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{command}</span>
        <StatusBadge variant={variant}>{label}</StatusBadge>
      </div>
      <div className="mt-1 text-xs text-text-muted">{age(run.age_seconds)}</div>
      {/* AN HONEST LIMIT, WRITTEN ON THE CELL. The payload carries only the
          LATEST run per command, so when that run was skipped the age above
          is the skip's -- freshly written, small, and saying nothing about
          when a deposit was last ingested. A poller wedged while holding the
          lock produces exactly this: a young amber cell, every two minutes,
          forever. The strip cannot show the age of the last non-skipped run
          because the backend does not send it; it can at least refuse to let
          this age be read as one. */}
      {run.skipped ? (
        <div className="mt-1 text-xs text-text-muted">
          Could not run — another run held the lock. The age above is this
          skip&rsquo;s, not a successful run&rsquo;s, and nothing was ingested.
          Repeated skips mean a wedged run, not a healthy one.
        </div>
      ) : null}
      {run.note ? <div className="mt-1 text-xs text-text-muted">{run.note}</div> : null}
    </div>
  );
}
