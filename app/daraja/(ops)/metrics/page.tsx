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
// THE FIGURES ARE NEVER PARSED. THE PERCENTAGE IS NOT A FIGURE.
//
// Every money value is rendered straight from the decimal STRING the API
// sent, through formatOpsMoney/formatOpsMoneyAs, and never passes through
// `Number()`/`parseFloat()`/`toFixed()` -- a figure somebody will reconcile
// against the ledger must survive to the pixel.
//
// The "↑ 18%" beside it is a different kind of thing: a RATIO between two
// windows, rounded for reading, and nobody reconciles a percentage. Computing
// it cannot corrupt the money on screen because the money on screen never
// comes from that computation -- `percentChange` returns a label and touches
// nothing else. A first version of this screen left the percentage out on the
// grounds that computing it would be "arithmetic on money"; that over-applied
// the rule and left the operator to do the subtraction in their head, which is
// the one thing a metrics screen exists to save them.
//
// The previous window's raw value stays on screen underneath, so the
// percentage is always checkable against the two numbers it came from.
"use client";
import * as React from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { formatOpsMoney, formatOpsMoneyAs } from "@/lib/darajaMoney";
import { useDarajaResource } from "@/lib/darajaAuth";
import { METRICS_PATH, type MetricsResponse } from "@/lib/darajaMetrics";

/** A secondary count shown under a money figure -- e.g. "1,234 deposits
 * (previous window: 987)". These stay side-by-side with no percentage: the
 * percentage belongs to the headline figure above them, and a second arrow on
 * the supporting line competes with it for the same glance. */
type CountDetail = {
  label: string;
  current: number;
  previous: number;
};

/**
 * "↑ 18%" / "↓ 4%" / "no change", or null when there is nothing honest to say.
 *
 * Accepts the decimal STRINGS the API sends (money) or plain numbers (counts).
 * The parse here feeds ONLY the percentage -- the value shown to the operator
 * is always formatted from the original string, never from this.
 *
 * Returns null, rather than a number, when:
 *   - the previous window was zero. Growth from nothing is not a percentage;
 *     "↑ ∞%" and "↑ 100%" are both lies. The card shows "previous window: 0"
 *     and lets the operator read it.
 *   - either value will not parse. Silence beats a confident wrong arrow.
 */
function percentChange(previous: string | number, current: string | number): string | null {
  const before = Number(previous);
  const after = Number(current);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (before === 0) return null;
  const pct = ((after - before) / Math.abs(before)) * 100;
  if (!Number.isFinite(pct)) return null;
  const rounded = Math.round(pct);
  if (rounded === 0) return "no change";
  return `${rounded > 0 ? "↑" : "↓"} ${Math.abs(rounded)}%`;
}

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
  const change = percentChange(previous, current);
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-4">
        <div className="text-sm font-medium text-text-muted">{title}</div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-2xl font-semibold text-text">{format(current)}</div>
          {/* The ratio, not the money. The figure above is formatted from the
              API's own string and owes nothing to this. */}
          {change ? (
            <span className="text-xs font-medium text-text-muted whitespace-nowrap">
              {change}
            </span>
          ) : null}
        </div>
        <div className="text-xs text-text-muted">previous window: {format(previous)}</div>
        {details?.map((d) => (
          <div key={d.label} className="text-xs text-text-muted">
            {d.current.toLocaleString()} {d.label} (previous window:{" "}
            {d.previous.toLocaleString()})
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
  // Only the FLOW gets a comparison. The total above is a snapshot as at the
  // window's end, and a percentage on it would read as growth during the window.
  const newChange = percentChange(newPrevious, newCurrent);
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-4">
        <div className="text-sm font-medium text-text-muted">{title}</div>
        <div className="text-2xl font-semibold text-text">{total.toLocaleString()}</div>
        <div className="text-xs text-text-faint">
          as at the end of the window -- not a flow, so there is no previous-window comparison
        </div>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-text">
            {newCurrent.toLocaleString()} {newLabel} this window
          </span>
          {newChange ? (
            <span className="text-xs font-medium text-text-muted whitespace-nowrap">
              {newChange}
            </span>
          ) : null}
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
