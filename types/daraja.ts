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
  kyc_status: string;
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
