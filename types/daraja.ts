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
 * the detail endpoint never emits `balance` or `last_activity_at` -- those
 * two are computed on the roster row only, from annotations the detail
 * queryset doesn't carry. Extending MerchantRow would type-check and read
 * `undefined` at runtime on a money field.
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
  /** null when the employer has no active CollectionAccount -- a real,
   *  unexceptional state (a fresh signup, or one never issued a wallet). */
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
  amount: string;
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
  source_account_number: string;
  registered: string;
}

export interface CardRow {
  card_id: string;
  status: string;
  registered: string;
}

export interface PeoplePayload {
  employees: { employee_id: string; full_name: string; phone_number: string }[];
  branches: { branch_id: string; name: string }[];
}
