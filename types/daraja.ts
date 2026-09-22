export interface DarajaAdminUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_superuser: boolean;
  groups: string[];
}

/** Count-bearing: the human-sized lists. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Cursor: the fast-growing tables. `count` is absent by design. */
export interface CursorPaged<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface MerchantRow {
  employer_id: string;
  business_name: string | null;
  phone_number: string | null;
  email_address: string | null;
  /**
   * NULLABLE, like `MerchantDetail.kyc_status` below. `Employer.kyc_status` is
   * `blank=True, null=True` (employer/models.py:65) and historical rows really
   * do carry NULL. Typed as a plain `string` this was a type lie of the same
   * class as the old `ExpenseRow.amount: string`: nothing breaks today because
   * every render path goes through lib/kyc.ts, which takes the wider type on
   * purpose -- but the two interfaces disagreed about one column, and the next
   * screen inherits whichever it reads (whole-branch review, M5).
   */
  kyc_status: string | null;
  active: boolean;
  registered: string;
  balance: string;
  last_activity_at: string | null;
}

/**
 * GET /employers/<id>/ -- EmployerDetailSerializer's own field set
 * (dashboard/serializers/employers.py), NOT an extension of MerchantRow:
 * the detail endpoint does not emit `last_activity_at`, which is computed on
 * the roster row only. Extending MerchantRow would type-check and read
 * `undefined` at runtime.
 */
export interface MerchantDetail {
  employer_id: string;
  business_name: string | null;
  phone_number: string | null;
  email_address: string | null;
  contact_person: string | null;
  active: boolean;
  kyc_status: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  tier: string | null;
  /** DecimalField, DRF-rendered as a string. Stored, never enforced. */
  monthly_cap_tzs: string | null;
  business_type: string | null;
  tin_number: string | null;
  owner_nida: string | null;
  region: string | null;
  district: string | null;
  physical_address: string | null;
  website: string | null;
  expected_volume: string | null;
  terms_accepted_at: string | null;
  phone_verified_at: string | null;
  email_verified_at: string | null;
  registered: string;
  /**
   * THIS MERCHANT'S TOTAL MONEY, as a string -- every wallet they hold,
   * summed, including inactive ones. It reads the same annotation the roster's
   * `balance` reads, so the two screens agree by construction; `wallet` below
   * is ONE wallet and is smaller whenever a merchant holds branch wallets
   * (Swahilies: balance 58738.43, wallet.balance 51738.43).
   *
   * Never null: a merchant holding no wallet at all serialises as the string
   * "0". Keep it a string -- no parseFloat, no arithmetic, no `|| 0`.
   */
  balance: string;
  /** The first-opened ACTIVE CollectionAccount, or null when the merchant has
   *  none -- a real, unexceptional state (a fresh signup, one never issued a
   *  wallet, or one whose only wallet has been deactivated). Note `balance`
   *  above can still be non-zero when this is null: an inactive wallet still
   *  holds the merchant's money. */
  wallet: { account_id: string; account_no: string; balance: string } | null;
  /** The three S3 URL fields that exist today (get_documents). A
   *  structured EmployerDocument table is a later plan, not assumed here. */
  documents: {
    business_licence: string | null;
    brela_certificate: string | null;
    memart: string | null;
  };
}

/** One row of the activity envelope below -- see ActivityEnvelope for the
 *  page-size caveat that applies to the list this sits in. */
export interface TimelineRow {
  occurred_at: string;
  kind: "expense" | "payout" | "deposit" | "card_load" | "admin";
  summary: string;
  amount: string | null;
  reference: string;
  link_type: string;
  link_id: string;
  /**
   * The `Expenses.expense_id` this payout settles -- `ExpensePayout.expense_id`,
   * the FK column of a OneToOneField (dashboard/services/timeline.py).
   *
   * Set on PAYOUT rows only; null on every other kind, expense rows included
   * (an expense's own id is already `link_id`). It is a CharField, so it is a
   * STRING, never a number: compare it with `===` against an expense row's
   * `link_id` and do not coerce it. This is the only sound way to pair the two
   * rows -- pairing by adjacency and equal amount attaches a payment to the
   * wrong expense.
   */
  related_expense_id: string | null;
}

/**
 * The envelope GET /employers/<id>/activity/ returns: `{results: [...]}`,
 * no `next`/`previous`/`count`. `results` may hold more rows than the
 * `limit` requested -- a page boundary that would split rows tied on
 * `occurred_at` is extended to include all of them, rather than silently
 * dropping the tied row that fell on the cut line. Do not treat this as a
 * fixed page size, and do not truncate the result client-side.
 */
export interface ActivityEnvelope {
  results: TimelineRow[];
}

export interface ExpenseRow {
  expense_id: string;
  expense_type: string;
  description: string;
  /**
   * A JSON NUMBER, not a string: `Expenses.amount` is a FloatField
   * (expenses/models.py:39), so ExpenseRowSerializer emits `1000.0`. Typed as
   * `string` this read as a lie the next screen would inherit (M4). It is the
   * one money field on these tabs that is not a Decimal-backed string; every
   * other one (Entry, DepositIntent, wallet balances, the merchant total) is.
   */
  amount: number;
  status: string;
  expense_date: string;
  payout_state: string | null;
}

export interface EntryRow {
  entry_id: string;
  amount: string;
  created: string;
  movement_kind: string;
  reference: string;
}

export interface DepositRow {
  intent_id: string;
  amount: string;
  state: string;
  description: string;
  /** Defaults to "" rather than NULL for legacy intents (wallets/models.py). */
  source_account_number: string;
  registered: string;
}

export interface CardRow {
  card_id: string;
  status: string;
  registered: string;
}

// Employee.full_name and Employee.phone_number are both
// `blank=True, null=True` (employee/models.py) and EmployeeRowSerializer
// (dashboard/serializers/employer_tabs.py) emits null for either -- typed
// as non-null `string` here would type-check and render the string "null"
// for a real, unexceptional row.
export interface EmployeeRow {
  employee_id: string;
  full_name: string | null;
  phone_number: string | null;
}

export interface BranchRow {
  branch_id: string;
  name: string;
}

/**
 * GET /employers/<id>/people/ -- employees are the CURSOR-PAGINATED body of
 * this payload (`results`/`next`/`previous`, page_size default 50, max 200);
 * branches ride alongside the envelope and are complete, not paginated
 * (dashboard/views/employer_tabs.py::EmployerPeople).
 *
 * It was `{employees: [...], branches: [...]}` with no paginator and no cap.
 * Extending CursorPaged rather than restating the envelope is what lets this
 * payload be accumulated by the same hook as the other five tabs.
 */
export interface PeoplePayload extends CursorPaged<EmployeeRow> {
  branches: BranchRow[];
}

// ---------------------------------------------------------------------------
// Ledger, position, and deposits (GET /dashboard/ledger/*, /dashboard/deposits/*)
//
// Derived from dashboard/views/ledger.py, dashboard/services/position.py,
// dashboard/views/deposits.py and dashboard/urls.py directly, NOT from the
// Task 6 brief -- the brief predates the backend and drifted from it across
// five task reviews. Known drift, corrected here:
//   * `halt.gap` does not exist; it is `halt.gap_magnitude`, and it is
//     UNSIGNED (LedgerHalt.gap is stored via abs() in reconcile.py).
//   * the top-level `gap`'s sign flipped: POSITIVE now means the ledger
//     claims more money than exists ("ledger_over"), matching the sign
//     check_invariant() uses to decide whether to halt.
//   * `last_runs[command]` gained `degraded: boolean` beside `ok`/`note`.
//   * the position payload gained `halt_error`, `last_runs_error` and
//     `stuck_payouts_error`, all nullable -- and `stuck_payouts` itself is
//     therefore nullable too (never a fabricated 0 on a DB failure, the same
//     rule `pool_balance`/`ledger_total` already follow).
//   * `DepositIntentRow` gained `registered` (the view emits it; the brief's
//     interface omitted it).
//   * the paginated ledger/deposit list endpoints ride DashboardPagination,
//     which is DRF CursorPagination -- `CursorPaged<T>` above, not
//     `Paginated<T>` (no `count`). `UnmatchedDebitsPayload` is the one
//     exception: that view builds its own `Response`, not a paginator.
//
// AND THE BACKEND'S OWN FIX WAVE (dashboard commits 1f23310, c6dea03), read
// from the source rather than from a summary:
//   * `LedgerLeg` gained `is_house_account`, and the OLD RULE IS WRONG. A
//     null `business_name` no longer means "house account" -- see the field.
//   * `/ledger/accounts/`: `total` keeps its key but now means the HOUSE'S
//     OWN money (the pool mirror excluded); `pool_mirror` and a per-row
//     `is_pool_mirror` are new.
//   * `last_runs[cmd]` gained `skipped` -- the third state, "could not run".
//   * the position payload gained `unmatched_error`, so `unmatched_count`
//     finally has the `*_error` sibling every other nullable number here had.

/** One non-wallet ledger account, or a wallet ops has designated for a
 *  system purpose (Revenue, Card Top-ups, Lipa Namba) -- GET
 *  /dashboard/ledger/accounts/. Customer wallets otherwise live on the
 *  wallet screens, not here. */
export interface OpsAccountRow {
  account_id: string;
  kind: string;
  label: string;
  /** Decimal string, summed from Entry -- never a number, never assume 2dp
   *  universally (Entry is 20,2; a wallet-mirror balance elsewhere is 50,5,
   *  and both are correct for their own column). */
  balance: string;
  wallet_account_id: string | null;
  designation: string | null;
  /**
   * This row is the POOL MIRROR, not one of the house's own accounts.
   *
   * The `pool` account mirrors everything sitting in the pooled Selcom
   * account, customers' money included (dashboard/views/ledger.py:67-79).
   * Its `balance` is still reported on the row, and it is deliberately NOT
   * part of `OpsAccountsPayload.total`. A screen that lets these read as the
   * same kind of money is telling an operator the house holds funds it is
   * merely holding FOR somebody.
   */
  is_pool_mirror: boolean;
}

export interface OpsAccountsPayload {
  accounts: OpsAccountRow[];
  /**
   * THE HOUSE'S OWN MONEY -- the sum of every listed account EXCEPT the pool
   * mirror. The key is unchanged but its meaning is not: it used to include
   * the mirror, and because the ledger sums to zero that reduced to MINUS the
   * sum of every customer wallet (one merchant holding 300.00 rendered
   * `total: "-300.00"` under the heading "the house's own accounts", going
   * further negative with every deposit an operator was glad to see).
   */
  total: string;
  /**
   * The pool mirror's balance, or null when there is NO pool account at all.
   *
   * `null`, never the string "0.00": a missing mirror is a different fact
   * from an empty one, and this endpoint never publishes a fabricated zero
   * for money (dashboard/views/ledger.py:143-146). Render the null as
   * `UNKNOWN_AMOUNT` plus the reason, never as a figure.
   */
  pool_mirror: string | null;
}

/** One tracked command's latest CommandRun row, or null if it has never
 *  run -- see `LedgerPosition.last_runs`. */
export interface CommandRunInfo {
  started: string;
  finished: string | null;
  ok: boolean;
  /** SOME-but-not-all of the run's work was unreadable; distinct from `ok`,
   *  which is reserved for a run that gained no information at all. */
  degraded: boolean;
  /**
   * THE THIRD STATE: the run COULD NOT RUN AT ALL -- another run held the
   * poller's lock. Derived on the backend from an exact match against
   * `CommandRun.SKIPPED_NOTE`, not from parsing `note`
   * (dashboard/services/position.py:99-107).
   *
   * A skip is recorded `ok=false` (wallets/models.py:634-642: it gained no
   * information about ingestion), so the four honest states are:
   *   did the work   ok=true  degraded=false skipped=false
   *   partial        ok=true  degraded=true  skipped=false
   *   could not run  ok=false degraded=false skipped=true
   *   dead           ok=false degraded=false skipped=false
   * Only the last is red. Skips are ROUTINE against a 2-minute cron (a 120s
   * statement timeout with --days 2 can take ~240s), so colouring them red
   * would put a red alarm on the strip every other minute and get the strip
   * tuned out -- which is how the 2026-09-16 blindness happens one level
   * down.
   */
  skipped: boolean;
  note: string;
  age_seconds: number;
  /**
   * THE WEDGE NUMBER. `age_seconds` above is "since the newest run of any
   * kind" -- a WEDGED poller that keeps starting and keeps failing to get
   * the lock writes a fresh skip every two minutes forever, so `age_seconds`
   * alone never reads as more than a couple of minutes old no matter how
   * long ingestion has actually been dead. `last_ok_at` is the `finished`
   * (or `started`) of the newest run that actually did the work -- `ok=true`
   * AND not `skipped` (a `degraded` run counts: it is `ok=true` by
   * definition, and partial success is information gained, not a failure to
   * run) -- computed on the backend the same way `started`/`finished` are
   * (dashboard/services/position.py::_last_runs). `null` when no such run
   * exists at all.
   */
  last_ok_at: string | null;
  /**
   * Seconds since `last_ok_at`, or `null` alongside it. `null` here is NOT
   * "just succeeded" -- it means no successful run is on record at all, and
   * must never be coerced to 0 or read as fresh, the same rule this payload
   * already applies to `pool_balance`/`ledger_total` when they cannot be
   * read. See `lastRunState` below for how this turns into the strip's
   * colour.
   */
  last_ok_age_seconds: number | null;
}

/** The active LedgerHalt, if any -- see `LedgerPosition.halt`. */
export interface LedgerHaltInfo {
  halt_id: string;
  active: boolean;
  reason: string;
  /** UNSIGNED. Named `gap_magnitude`, never `gap`, so it cannot be confused
   *  with the signed top-level `LedgerPosition.gap`. Nullable: LedgerHalt.gap
   *  itself is nullable in the model. */
  gap_magnitude: string | null;
  raised: string;
  age_seconds: number;
}

/** GET /dashboard/ledger/position/ -- ledger vs pool, halt, last runs.
 *  NEVER RAISES on the backend: each component below carries its own
 *  `*_error` sibling instead of blanking the whole response. */
export interface LedgerPosition {
  /** null when the local ledger could not be summed (corruption). */
  ledger_total: string | null;
  ledger_error: string | null;
  /**
   * NULL either when nothing has ever been measured yet, or (on `?live=1`
   * only) when the live Selcom read itself failed. NEVER render this as 0.
   *
   * DEFAULT LOAD (`GET /ledger/position/`, no `live` param) DOES NOT CALL
   * SELCOM AT ALL as of C2 -- it reads the pool measurement
   * `reconcile_wallets` already takes every two minutes
   * (wallets.models.PoolReading), on an account that has been answering 403
   * "excessive lookup usage" since 2026-09-17. `?live=1` -- the Refresh
   * button only -- makes the live call and records what it measures too.
   * See `pool_measured_at`/`pool_age_seconds`/`pool_stale` below: this
   * number always carries its own age, and a stored reading must never be
   * shown as if it were fresh -- the same reasoning that keeps this field
   * null instead of a fabricated 0.
   */
  pool_balance: string | null;
  pool_error: string | null;
  /** A genuine zero pool -- shown, but flagged: it is the shape of a bad
   *  read (the 2026-09-16 incident). */
  pool_suspect: boolean;
  /**
   * When `pool_balance` was actually measured -- an ISO timestamp, or null
   * when there is no reading at all. Never derive "now" from the absence of
   * this field; render it (via `pool_age_seconds`) or say it is unknown.
   */
  pool_measured_at: string | null;
  /**
   * How old `pool_balance` is, in whole seconds, computed on the SERVER the
   * same way every other `age_seconds` on this payload is (see
   * `CommandRunInfo.age_seconds`) -- it does not count up on its own once it
   * reaches the browser. 0 on a fresh `?live=1` read; null alongside a null
   * `pool_balance`.
   */
  pool_age_seconds: number | null;
  /**
   * True when the newest reading is older than five minutes (the
   * reconciler runs every two, so this means at least two missed ticks) or
   * when there is no reading at all. MUST be shown next to the figure,
   * never silently: an old number displayed as if it were fresh is what let
   * the 2026-09-16 bad pool read stand for seventeen hours, and the same
   * risk applies to a stale reading displayed with no age beside it.
   */
  pool_stale: boolean;
  /** Signed: ledger_total - pool_balance. POSITIVE means the ledger claims
   *  MORE money than exists ("ledger_over", the halting direction);
   *  negative means the pool holds more than the ledger claims
   *  ("pool_over", harmless). null whenever either side above is null. */
  gap: string | null;
  direction: "balanced" | "ledger_over" | "pool_over" | "unknown";
  halt: LedgerHaltInfo | null;
  halt_error: string | null;
  /** null only if CommandRun itself could not be read; see `last_runs_error`. */
  last_runs: Record<string, CommandRunInfo | null> | null;
  last_runs_error: string | null;
  /**
   * The unmatched-DEBIT queue's depth, or null when it could not be read.
   * NEVER coerce the null to 0 for a severity check: `(unmatched_count ?? 0)
   * > 0` is how an unread queue renders as an OK-coloured cell, which is the
   * 2026-09-16 failure expressed as a colour instead of a digit.
   */
  unmatched_count: number | null;
  /**
   * Why `unmatched_count` is null. `0` + `null` = read, and empty. `null` +
   * a string = could not be read. It was a bare `except Exception: unmatched
   * = None` with no sibling until the backend's own fix wave
   * (dashboard/services/position.py:165-175).
   */
  unmatched_error: string | null;
  /** Never a fabricated 0 on a DB failure -- see `stuck_payouts_error`. */
  stuck_payouts: number | null;
  stuck_payouts_error: string | null;
}

/** One leg of a movement -- GET /dashboard/ledger/movements/. */
export interface LedgerLeg {
  entry_id: string;
  account_id: string;
  account_kind: string;
  /**
   * The merchant behind this leg's account, or null -- AND NULL DOES NOT
   * MEAN "HOUSE". `Employer.business_name` is `blank=True, null=True` and
   * this database holds such rows, so a real merchant can arrive here with
   * a null name. Read `is_house_account` for the house question, never this.
   */
  business_name: string | null;
  /**
   * Whose money this account holds, decided on `account.wallet_id is None`
   * (dashboard/views/ledger.py:225-238) -- NOT on the name, NOT on the kind.
   *
   *   true            -> always `business_name: null`. Daraja's own account.
   *   false + string  -> a named merchant.
   *   false + null    -> A MERCHANT WHOSE NAME IS NULL ON FILE. Merchant
   *                      money. It must render as an UNNAMED MERCHANT and
   *                      never as a house account: that misattribution is
   *                      the one thing the screen built to attribute money
   *                      correctly must not do.
   */
  is_house_account: boolean;
  /** Signed decimal string: negative debits the account. */
  amount: string;
}

export interface MovementRow {
  movement_id: string;
  kind: string;
  reference: string;
  created: string;
  legs: LedgerLeg[];
}

export interface LedgerKindsPayload {
  kinds: string[];
}

// WHAT IS DELIBERATELY NOT TYPED HERE, and the gap it records.
//
// `GET /dashboard/ledger/accounts/<id>/entries/` (the spec's account-first
// running statement) and `GET /dashboard/deposits/rows/` (ingested statement
// rows with their outcomes) both exist and are tested on the backend. NO
// SCREEN CALLS EITHER, so the interfaces that described them -- a
// `LedgerEntryRow` and a `StatementRowItem.outcome` -- have been deleted
// rather than left standing.
//
// This is the ruling that deleted dashboard/serializers/ledger.py earlier in
// this plan, applied to its mirror image: a shape that documents a response
// nothing renders is a lie with a shelf life, because nothing fails when the
// two disagree. The ledger screen's row click deep-links to
// /daraja/ledger/movements?account_id=..., which is a FILTER OVER MOVEMENTS
// -- every leg of every matching movement, including the other side's, with
// no running balance for the account. That is not the account-first
// statement, and this file must not imply a screen that does not exist.
//
// The endpoints stay. Typing them belongs with the screen that calls them.

/** One row of the pooled account's Selcom statement -- the shared shape
 *  behind GET /deposits/suspense/ (CREDITS attributed to nobody) and
 *  /deposits/unmatched-debits/ (DEBITS with no recorded payout; see
 *  `UnmatchedDebitsPayload`). The backend also emits `outcome` on these rows,
 *  which no screen renders -- see the note above. */
export interface StatementRowItem {
  transaction_id: string;
  direction: string;
  amount: string;
  transaction_date: string;
  details: string;
  client_name: string;
  payment_type: string;
  bank_number: string;
  movement_id: string | null;
  ingested: string;
}

/**
 * GET /dashboard/deposits/unmatched-debits/ -- Selcom DEBITS that left the
 * pool with no recorded payout behind them. NOT the credit-side suspense
 * queue (unattributed money that arrived, at /deposits/suspense/, which
 * pages as `CursorPaged<StatementRowItem>` like every other deposits list
 * here). This one view builds its own `Response` rather than paginating, so
 * its envelope is `{count, results}`, not `{next, previous, results}` --
 * named `UnmatchedDebitsPayload`, not e.g. `UnmatchedCreditsPayload`, so an
 * operator mid-incident cannot misread which side of the ledger it reports.
 */
export interface UnmatchedDebitsPayload {
  count: number;
  results: StatementRowItem[];
}

/** GET /dashboard/deposits/intents/ -- a merchant's declaration that money
 *  is on its way. Confirmation/UX only; never the matching key. */
export interface DepositIntentRow {
  intent_id: string;
  state: string;
  amount: string;
  description: string;
  source_account_number: string;
  wallet_account_id: string;
  business_name: string | null;
  statement_row_id: string | null;
  registered: string;
}
