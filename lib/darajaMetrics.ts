// lib/darajaMetrics.ts -- GET /dashboard/metrics/ (dashboard/views/metrics.py).
//
// The ops Metrics screen's ten business figures for a chosen window, plus
// the same figures for the immediately preceding window of equal length, so
// the screen can say "up/down from last time" without ever recomputing that
// comparison itself.
//
// THE SHAPE BELOW IS COPIED FIELD-FOR-FIELD FROM dashboard/views/metrics.py
// (`Metrics.get` / `_window_on_the_wire` / `_serialise`), not guessed at,
// because a typo here is a silently empty column tsc cannot catch:
//
//   { window: {from, to}, compared_to: {from, to},
//     current: {...}, previous: {...},
//     notes: {card_margin_tzs_per_usd, card_margin_is_assumed,
//             card_creation_cost_usd} }
//
// `current`/`previous` share ONE shape (`MetricsFigures` below), the same
// fifteen keys `dashboard.services.metrics.compute_metrics` returns:
//
//   deposits_tzs, deposits_count, payouts_tzs, payouts_count,
//   fee_revenue_tzs, registrations_new, registrations_total, active_new,
//   active_total, card_revenue_tzs, card_cost_usd, card_volume_usd,
//   card_volume_tzs, cards_created, card_topups_funded
//
// MONEY KEYS, per the view's own `MONEY_KEYS` frozenset -- these seven cross
// the wire as quantised DRF decimal STRINGS ("12345.67" or, on an all-zero
// window, "0.00"), never a float:
//
//   deposits_tzs, payouts_tzs, fee_revenue_tzs, card_revenue_tzs,
//   card_cost_usd, card_volume_usd, card_volume_tzs
//
// Hand every one of those untouched to `formatOpsMoney`/`formatOpsMoneyAs`.
// NEVER `Number()`, `parseFloat()` or `toFixed()` -- these are figures
// somebody will reconcile against the ledger, same rule as
// lib/darajaTreasury.ts states for its own money fields. The other eight
// keys (the two counts and the four registration/active figures) are plain
// JSON integers -- `compute_metrics` never quantises a count.
//
// `card_cost_usd` and `card_volume_usd` are the ONLY dollar figures in this
// shape; every other money key is shillings. The screen renders
// `card_cost_usd` on its own card, through `formatOpsMoneyAs("USD", ...)`,
// and does not surface `card_volume_usd` at all -- `card_volume_tzs` is the
// figure an operator reads for card volume, and showing the same volume
// twice in two currencies on one screen invites exactly the summing this
// module's other rule (below) forbids for a different pair of fields.
//
// PAYOUTS INCLUDE THE FEE. The ledger writes a merchant's wallet leg as
// -(amount + fee), so `payouts_tzs` overlaps `fee_revenue_tzs` by exactly
// the fee on every payout. The two must never be presented so that adding
// them reads as "total money out" -- they stay in different groups on the
// screen ("Money moved" vs "What Daraja earned") and there is no total row
// spanning the two.
//
// CUMULATIVE FIGURES ARE A SNAPSHOT, NOT A FLOW. `registrations_total` and
// `active_total` are counts AS AT THE WINDOW'S END, not something that
// happened during the window -- the matching `registrations_new`/
// `active_new` is the windowed flow. Rendering a period-over-period delta
// on the *_total pair would invite reading "+3%" as growth during the
// window when it is really just "later minus earlier calendar cursor";
// the screen shows the total plain, with the *_new figure (which DOES get
// a previous-window comparison, like every other figure here) beside it.
//
// `notes.card_margin_is_assumed` is always `true` today: `card_revenue_tzs`
// is `compute_metrics` applying Daraja's stated TZS/USD margin to funded
// top-up volume, not something read off the ledger the way
// `fee_revenue_tzs` is. The screen renders that caveat next to the number,
// not only in this comment.
import darajaApi from "@/lib/darajaApi";

/** current/previous: dashboard.services.metrics.compute_metrics's own
 * fifteen keys, unchanged. See this file's header for which seven are
 * money-as-string and which eight are plain counts. */
export type MetricsFigures = {
  deposits_tzs: string;
  deposits_count: number;
  payouts_tzs: string;
  payouts_count: number;
  fee_revenue_tzs: string;
  registrations_new: number;
  registrations_total: number;
  active_new: number;
  active_total: number;
  card_revenue_tzs: string;
  card_cost_usd: string;
  card_volume_usd: string;
  card_volume_tzs: string;
  cards_created: number;
  card_topups_funded: number;
};

/** One window, as the wire states it: `to` is the last INCLUDED day (the
 * view's `_window_on_the_wire` turns its internal half-open [start, end)
 * back into this inclusive-on-both-ends vocabulary before responding). */
export type MetricsWindow = {
  from: string;
  to: string;
};

export type MetricsNotes = {
  card_margin_tzs_per_usd: string;
  card_margin_is_assumed: boolean;
  card_creation_cost_usd: string;
};

/**
 * How far back the LEDGER can actually see, and whether each window is inside
 * it.
 *
 * `deposits_*`, `payouts_*` and `fee_revenue_tzs` are read from the ledger,
 * which begins at the float opening (2026-09-11 in production). Before that
 * Daraja ran on Tembo -- revenue included -- and none of that traffic is in
 * these books, so those five figures come back as a truthful 0 for an earlier
 * window. On screen, beside a non-zero registrations count, that reads as "we
 * moved no money that month": August 2026 answers 0 when it really held 199
 * payouts, 46,043,797 moved and 407,480 in fees.
 *
 * So the screen must render `missing_before` INSTEAD of those five figures
 * whenever `complete` is false. `figures` names exactly which keys are
 * affected, so this client never keeps its own copy of that list -- the
 * backend owns it and they cannot drift.
 *
 * `since` is null when no float opening has been booked: a fresh system with
 * no Tembo era behind it, where every window is covered and no caveat is
 * justified.
 */
export type MetricsLedgerCoverage = {
  /** The whole window is inside the ledger. */
  complete: boolean;
  /**
   * The window ends BEFORE the ledger begins, so its ledger figures mean
   * nothing and the screen hides them. Distinct from `complete: false`, which
   * a STRADDLING window also carries -- and straddling is the common case,
   * since any calendar month containing the float opening straddles it.
   */
  entirely_before: boolean;
  /**
   * For a straddling window: the date the figures actually start from. They
   * are real but understated, so the screen SHOWS them with this as a note.
   * Null when the window is complete or entirely before.
   */
  covers_from: string | null;
  missing_before: string | null;
};

export type MetricsLedger = {
  since: string | null;
  figures: string[];
  window: MetricsLedgerCoverage;
  compared_to: MetricsLedgerCoverage;
};

export type MetricsResponse = {
  window: MetricsWindow;
  compared_to: MetricsWindow;
  current: MetricsFigures;
  previous: MetricsFigures;
  ledger: MetricsLedger;
  notes: MetricsNotes;
};

export const METRICS_PATH = "/metrics/";

/**
 * GET /dashboard/metrics/?from=YYYY-MM-DD&to=YYYY-MM-DD.
 *
 * Both params must be given together or omitted together -- the view 400s
 * on a lone `from` or `to` rather than guessing the missing half (see its
 * own docstring). Omitting both asks for the current calendar month, which
 * is this screen's default.
 */
export async function fetchMetrics(
  range?: { from: string; to: string },
): Promise<MetricsResponse> {
  const { data } = await darajaApi.get<MetricsResponse>(METRICS_PATH, {
    params: range,
  });
  return data;
}
