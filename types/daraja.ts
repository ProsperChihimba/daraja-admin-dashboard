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
}

export interface OpsAccountsPayload {
  accounts: OpsAccountRow[];
  total: string;
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
  note: string;
  age_seconds: number;
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
  /** null when the LIVE Selcom read failed. NEVER render this as 0. */
  pool_balance: string | null;
  pool_error: string | null;
  /** A genuine zero pool -- shown, but flagged: it is the shape of a bad
   *  read (the 2026-09-16 incident). */
  pool_suspect: boolean;
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
  unmatched_count: number | null;
  /** Never a fabricated 0 on a DB failure -- see `stuck_payouts_error`. */
  stuck_payouts: number | null;
  stuck_payouts_error: string | null;
}

/** One leg of a movement -- GET /dashboard/ledger/movements/. */
export interface LedgerLeg {
  entry_id: string;
  account_id: string;
  account_kind: string;
  business_name: string | null;
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

/**
 * GET /dashboard/ledger/accounts/<id>/entries/ -- one account's running
 * statement FROM THE LEDGER (Entry), distinct from the existing `EntryRow`
 * above, which is the legacy CollectionAccountTransaction mirror behind the
 * wallet statement screen. Named `LedgerEntryRow`, not `EntryRow`, because
 * `EntryRow` already exists for that other screen and redefining it would
 * either fail to compile or silently change its contract.
 */
export interface LedgerEntryRow {
  entry_id: string;
  amount: string;
  created: string;
  movement_id: string;
  movement_kind: string;
  reference: string;
}

/** One row of the pooled account's Selcom statement -- shared shape behind
 *  GET /dashboard/deposits/rows/, /deposits/suspense/ (CREDITS attributed to
 *  nobody) and /deposits/unmatched-debits/ (DEBITS with no recorded payout;
 *  see `UnmatchedDebitsPayload`). */
export interface StatementRowItem {
  transaction_id: string;
  direction: string;
  amount: string;
  transaction_date: string;
  details: string;
  client_name: string;
  payment_type: string;
  bank_number: string;
  outcome: string;
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
