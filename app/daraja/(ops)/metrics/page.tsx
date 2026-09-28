// app/daraja/(ops)/metrics/page.tsx  (URL: /daraja/metrics)
//
// The ops Metrics screen: ten business figures for a chosen window,
// GET /dashboard/metrics/ (dashboard/views/metrics.py, via
// dashboard.services.metrics.compute_metrics). Read-only -- this screen has
// no request/approve flow of its own, unlike Treasury; it exists so an
// operator can see the business's own numbers without asking an engineer to
// run a query.
//
// TWO RULINGS THIS SCREEN OBEYS, BOTH FROM THE FIELD DATA ITSELF:
//
//   1. `payouts_tzs` INCLUDES THE FEE (the ledger writes a merchant's wallet
//      leg as -(amount + fee)), so it overlaps `fee_revenue_tzs` by exactly
//      the fee on every payout. The two live in different groups below
//      ("Money moved" vs "What Daraja earned") and there is no total row
//      spanning groups -- adding them would silently double-count the fee
//      as "money out".
//   2. `registrations_total`/`active_total` are snapshots AS AT THE
//      WINDOW'S END, not flows during it. They render with no
//      previous-window comparison (a "+3%" beside a lifetime total invites
//      reading it as growth that happened in the window); the matching
//      `registrations_new`/`active_new` -- which IS a flow -- renders
//      beside it and gets the same previous-window comparison every other
//      figure on this screen gets.
//
// NO ARITHMETIC ON THE FIGURES THEMSELVES, ANYWHERE ON THIS SCREEN. Every
// "change against previous" below is the current and previous values shown
// side by side, never a computed delta or percentage -- computing one would
// mean parsing the money fields' decimal STRINGS, which is exactly what
// lib/darajaMetrics.ts (and, underneath it, lib/darajaMoney.ts) forbids: a
// figure somebody will reconcile against the ledger must never pass through
// `Number()`/`parseFloat()`/`toFixed()`. The count fields (plain JSON
// integers) get the same side-by-side treatment for consistency, not
// because they carry the same risk.
"use client";
import * as React from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { formatOpsMoney, formatOpsMoneyAs } from "@/lib/darajaMoney";
import { useDarajaResource } from "@/lib/darajaAuth";
import { METRICS_PATH, type MetricsResponse } from "@/lib/darajaMetrics";

/** One count figure shown beside its own previous-window value -- e.g.
 * "1,234 deposits (previous window: 987)". Plain integers, so `current`/
 * `previous` are compared by eye, not computed into a delta here either. */
type CountDetail = {
  label: string;
  current: number;
  previous: number;
};

/**
 * A single money figure: the window's value, its previous-window value
 * shown beside it (never summed, never diffed), and optionally the count(s)
 * that go with it and a caveat note.
 *
 * `currency` picks the formatter -- `formatOpsMoneyAs("USD", ...)` for the
 * one dollar figure on this screen (`card_cost_usd`), `formatOpsMoney`
 * (hardcoded TZS) for every other money key. Never the other way around:
 * see lib/darajaMetrics.ts's header for why `card_cost_usd` is the only USD
 * figure this screen renders.
 */
function MoneyStatCard({
  title,
  currency,
  current,
  previous,
  details,
  note,
}: {
  title: string;
  currency: "TZS" | "USD";
  current: string;
  previous: string;
  details?: CountDetail[];
  note?: string;
}) {
  const format = (value: string) =>
    currency === "USD" ? formatOpsMoneyAs("USD", value) : formatOpsMoney(value);
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-4">
        <div className="text-sm font-medium text-text-muted">{title}</div>
        <div className="text-2xl font-semibold text-text">{format(current)}</div>
        <div className="text-xs text-text-muted">previous window: {format(previous)}</div>
        {details?.map((d) => (
          <div key={d.label} className="text-xs text-text-muted">
            {d.current.toLocaleString()} {d.label} (previous window: {d.previous.toLocaleString()})
          </div>
        ))}
        {note ? <div className="text-xs text-warning-fg">{note}</div> : null}
      </CardContent>
    </Card>
  );
}

/**
 * A cumulative figure (`registrations_total`/`active_total`) beside its own
 * windowed flow (`registrations_new`/`active_new`).
 *
 * The total renders PLAIN -- no vs.-previous comparison -- because it is a
 * snapshot as at the window's end, not something that happened during the
 * window; a delta on it would read as growth during the window when it is
 * really just an earlier-vs-later calendar cursor. The `new` figure below it
 * IS a flow, so it gets the same previous-window comparison every other
 * figure on this screen gets.
 */
function CumulativeStatCard({
  title,
  total,
  newLabel,
  newCurrent,
  newPrevious,
}: {
  title: string;
  total: number;
  newLabel: string;
  newCurrent: number;
  newPrevious: number;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-4">
        <div className="text-sm font-medium text-text-muted">{title}</div>
        <div className="text-2xl font-semibold text-text">{total.toLocaleString()}</div>
        <div className="text-xs text-text-faint">
          as at the end of the window -- not a flow, so there is no previous-window comparison
        </div>
        <div className="mt-1 text-sm font-medium text-text">
          {newCurrent.toLocaleString()} {newLabel} this window
        </div>
        <div className="text-xs text-text-muted">
          previous window: {newPrevious.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-faint">
      {children}
    </h2>
  );
}

export default function MetricsPage() {
  // EMPTY_RANGE (both sides unset) means "send no from/to params at all" --
  // which is exactly what the view reads as "give me the current calendar
  // month" (dashboard/views/metrics.py's `month_window` branch). That is
  // this screen's default window, so no seeding is needed here.
  const [range, setRange] = React.useState<DateRange>(EMPTY_RANGE);
  // The view 400s on a lone `from` or `to` rather than guessing the other
  // half -- so params are sent only once BOTH sides are filled in; a
  // one-sided edit (the user has only picked "from" so far) simply keeps
  // asking for the default month until the second date lands.
  const params = React.useMemo(
    () => (range.after && range.before ? { from: range.after, to: range.before } : undefined),
    [range.after, range.before],
  );
  const { data, loading, error, refetch } = useDarajaResource<MetricsResponse>(
    METRICS_PATH,
    params,
  );

  const current = data?.current;
  const previous = data?.previous;
  const notes = data?.notes;

  return (
    <>
      <PageHeader
        title="Metrics"
        subtitle="Ten business figures for a window, compared to the window immediately before it."
        actions={<DateRangeFilter value={range} onChange={setRange} label="Window" />}
      />

      {data ? (
        <p className="mb-4 text-xs text-text-muted">
          Showing {data.window.from} to {data.window.to} -- compared to {data.compared_to.from} to{" "}
          {data.compared_to.to}.
        </p>
      ) : null}

      {/* Only a failure with nothing to show takes the whole area -- a
          figure set already read stays on screen, with the error and Retry
          above it (the convention app/daraja/(ops)/treasury/page.tsx set). */}
      {error && !data ? <ErrorState message={error} onRetry={refetch} /> : null}
      {error && data ? (
        <div className="mb-3">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : null}

      {loading && !data ? <LoadingBlock /> : null}

      {current && previous && notes ? (
        <div className="flex flex-col gap-6">
          <section>
            <GroupHeading>Money moved</GroupHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MoneyStatCard
                title="Deposits"
                currency="TZS"
                current={current.deposits_tzs}
                previous={previous.deposits_tzs}
                details={[
                  {
                    label: "deposits",
                    current: current.deposits_count,
                    previous: previous.deposits_count,
                  },
                ]}
              />
              <MoneyStatCard
                title="Payouts"
                currency="TZS"
                current={current.payouts_tzs}
                previous={previous.payouts_tzs}
                details={[
                  {
                    label: "payouts",
                    current: current.payouts_count,
                    previous: previous.payouts_count,
                  },
                ]}
                note="Includes the fee charged on each payout -- do not add this to fee revenue below, that double-counts the fee."
              />
              <MoneyStatCard
                title="Card volume"
                currency="TZS"
                current={current.card_volume_tzs}
                previous={previous.card_volume_tzs}
                details={[
                  {
                    label: "cards issued",
                    current: current.cards_created,
                    previous: previous.cards_created,
                  },
                  {
                    label: "top-ups funded",
                    current: current.card_topups_funded,
                    previous: previous.card_topups_funded,
                  },
                ]}
              />
            </div>
          </section>

          <section>
            <GroupHeading>Merchants</GroupHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <CumulativeStatCard
                title="Registrations"
                total={current.registrations_total}
                newLabel="new registrations"
                newCurrent={current.registrations_new}
                newPrevious={previous.registrations_new}
              />
              <CumulativeStatCard
                title="Active merchants"
                total={current.active_total}
                newLabel="newly active"
                newCurrent={current.active_new}
                newPrevious={previous.active_new}
              />
            </div>
          </section>

          <section>
            <GroupHeading>What Daraja earned</GroupHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MoneyStatCard
                title="Fee revenue"
                currency="TZS"
                current={current.fee_revenue_tzs}
                previous={previous.fee_revenue_tzs}
              />
              <MoneyStatCard
                title="Card revenue"
                currency="TZS"
                current={current.card_revenue_tzs}
                previous={previous.card_revenue_tzs}
                note={
                  notes.card_margin_is_assumed
                    ? `Assumes a ${notes.card_margin_tzs_per_usd} TZS/USD margin -- not a figure booked on the ledger.`
                    : undefined
                }
              />
              <MoneyStatCard
                title="Card cost"
                currency="USD"
                current={current.card_cost_usd}
                previous={previous.card_cost_usd}
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
