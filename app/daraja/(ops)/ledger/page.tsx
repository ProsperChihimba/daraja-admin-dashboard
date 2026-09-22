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
           moments on one screen.

           `refetchPosition({ live: "1" })` -- NOT a bare `refetchPosition()`
           -- is the ONE place on this screen that asks for a live Selcom
           read (C2). The mount-time load above requests
           `/ledger/position/` with no `live` param, which reads the stored
           PoolReading instead of calling Selcom; only this button's click
           should make the live call, on an account that has been throttling
           since 2026-09-17. `refetchAccounts()` has no live/stale concept of
           its own and keeps its ordinary call. */
        actions={
          <RefreshControl
            label="Position"
            fetchedAt={positionFetchedAt}
            busy={positionLoading || accountsLoading}
            onRefresh={() => {
              void refetchPosition({ live: "1" });
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

// A JUDGEMENT, NOT A MEASUREMENT. How long `last_ok_age_seconds` may grow
// with no successful run before the strip stops calling a command healthy,
// even while ticks (including skips) keep arriving on schedule. One pair of
// numbers applied uniformly across every tracked command rather than a
// threshold per cadence (reconcile_wallets/check_alerts poll every 2
// minutes, reconcile_lipa every 5, poll_deposits on its own schedule):
// amber is generous enough that a couple of missed ticks on the slowest of
// them is not itself an alarm, red is the point past which "the poller is
// ticking but not working" is no longer a maybe.
const LAST_OK_AGE = {
  amberAfterSeconds: 15 * 60,
  redAfterSeconds: 60 * 60,
} as const;

type RunSeverity = "success" | "warning" | "danger";
const SEVERITY_RANK: Record<RunSeverity, number> = {
  success: 0,
  warning: 1,
  danger: 2,
};

/** The four tick states, unchanged from before this task -- see the big
 *  comment on `lastRunState` below for how they combine with staleness. */
function tickState(run: CommandRunInfo): { variant: RunSeverity; label: string } {
  if (run.skipped) return { variant: "warning", label: "skipped" };
  if (!run.ok) return { variant: "danger", label: "failed" };
  if (run.degraded) return { variant: "warning", label: "degraded" };
  return { variant: "success", label: "ok" };
}

/** `null` when the tick age is not stale enough to say anything about it. */
function stalenessState(
  run: CommandRunInfo,
): { variant: RunSeverity; label: string } | null {
  // THE CLOSED HONEST LIMIT. No successful run is on record at all -- not
  // "unknown", worse than any threshold below, and must never be allowed to
  // read as the green "ok" tick state alone would otherwise show. The same
  // rule this payload already applies to `pool_balance`/`ledger_total`: a
  // missing number is not an all-clear.
  if (run.last_ok_age_seconds === null) {
    return { variant: "warning", label: "no successful run" };
  }
  if (run.last_ok_age_seconds > LAST_OK_AGE.redAfterSeconds) {
    return { variant: "danger", label: "stale" };
  }
  if (run.last_ok_age_seconds > LAST_OK_AGE.amberAfterSeconds) {
    return { variant: "warning", label: "stale" };
  }
  return null;
}

/**
 * THE COLOUR RULE FOR `last_runs`, and the honest limit that used to be
 * recorded here as open.
 *
 * `ok`/`degraded` could say "did the work" and "did some of it"; neither
 * could say "could not run at all", which is what a lock-skipped tick is --
 * and what a WEDGED poller writes every two minutes. `skipped` is that third
 * fact, derived on the backend from an exact match against the writer's own
 * `CommandRun.SKIPPED_NOTE` constant, never from parsing `note`. Four honest
 * TICK states (`tickState` above):
 *
 *   did the work   ok=true  degraded=false skipped=false  -> green  "ok"
 *   partial        ok=true  degraded=true  skipped=false  -> amber  "degraded"
 *   could not run  ok=false degraded=false skipped=true   -> amber  "skipped"
 *   dead           ok=false degraded=false skipped=false  -> red    "failed"
 *
 * Among those four, red is reserved for `ok === false && skipped === false`,
 * checked FIRST against skipped. A skip sets `ok=false` on the backend (it
 * gained no information about ingestion), so the naive `!run.ok ? "danger"`
 * would paint a red alarm on this strip every other minute: skips are
 * routine against a 2-minute cron when a 120s statement timeout with --days
 * 2 can take ~240s. A strip that is red every other minute gets tuned out,
 * and a strip that is tuned out is the 2026-09-16 blindness one level down.
 *
 * THE HOLE THIS USED TO LEAVE OPEN: the payload carries only the LATEST run
 * per command, so a WEDGED poller -- one that keeps starting and keeps
 * failing to get the lock -- writes a fresh skip every two minutes forever.
 * The tick table alone reads that as "skipped", amber, seconds old, on
 * every load, with nothing distinguishing a five-minute wedge from a
 * five-hour one. This comment used to record that as an honest limit the
 * backend had not closed. IT NOW HAS: `last_ok_age_seconds` is the age of
 * the newest run that actually did the work, computed on the backend the
 * same way `age_seconds` is (see `CommandRunInfo.last_ok_age_seconds`).
 * `stalenessState` above turns that number into a second, independent
 * severity -- amber past 15 minutes with no successful run, red past 60 --
 * and `lastRunState` returns the WORSE of the tick state and the staleness
 * state (by `SEVERITY_RANK`, ties keeping the tick's more specific label).
 * That is the whole point: a poller skipping every two minutes on schedule
 * must stop looking healthy once the gap since its last real success
 * crosses the line, even while ticks keep arriving.
 *
 * `note` carries detail no boolean can express (e.g. "unreadable=2/7") and
 * is always rendered when present.
 *
 * `last_runs` itself is nullable (its own CommandRun read can fail
 * independently of everything else in the position payload) and is not
 * rendered as an empty strip when it is -- `last_runs_error` explains why.
 *
 * Exported, with `lastRunState` beside it, so the states can be driven and
 * asserted against the real component rather than a copy of it.
 */
export function lastRunState(run: CommandRunInfo): {
  variant: StatusVariant;
  label: string;
} {
  const tick = tickState(run);
  const stale = stalenessState(run);
  if (stale === null) return tick;
  return SEVERITY_RANK[stale.variant] > SEVERITY_RANK[tick.variant] ? stale : tick;
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
      {/* THE PRIMARY AGE IS NOW THE WORKING AGE, not the newest tick's. The
          old cell here could only show `age_seconds` -- the newest run of
          any kind -- with a disclaimer that a wedged poller makes that
          number meaningless (see the colour-rule comment above
          `lastRunState`). The backend now sends the age of the last run
          that actually did the work, so that is what leads; `null` reads as
          words, never as "0s ago", since a missing number is not "just
          happened". */}
      <div className="mt-1 text-xs text-text-muted">
        {run.last_ok_age_seconds === null
          ? "no successful run on record"
          : `${age(run.last_ok_age_seconds)} since last success`}
      </div>
      {/* The raw last-tick time is kept, smaller -- what the poller is doing
          RIGHT NOW (including a skip) is still a useful, different fact from
          when it last did the work. */}
      <div className="mt-0.5 text-[11px] text-text-faint" title={run.started}>
        last tick {age(run.age_seconds)}
      </div>
      {run.skipped ? (
        <div className="mt-1 text-xs text-text-muted">
          Could not run — another run held the lock. Nothing was ingested by
          this tick; repeated skips mean a wedged run, not a healthy one, and
          the age above (not this tick) is what turns amber and then red if
          it keeps happening.
        </div>
      ) : null}
      {run.note ? <div className="mt-1 text-xs text-text-muted">{run.note}</div> : null}
    </div>
  );
}
