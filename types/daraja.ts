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
  kyc_status: string;
  active: boolean;
  registered: string;
  balance: string;
  last_activity_at: string | null;
}

export interface MerchantDetail extends MerchantRow {
  wallet: { account_id: string; account_no: string; balance: string } | null;
  documents: Record<string, string | null>;
}

/**
 * A row from GET /employers/<id>/activity/. The service may return more
 * rows than the requested `limit`: a page boundary that would split rows
 * tied on `occurred_at` is extended to include all of them, rather than
 * silently dropping the tied row that fell on the cut line. Do not treat
 * this as a fixed page size, and do not truncate the result client-side.
 */
export interface TimelineRow {
  occurred_at: string;
  kind: "expense" | "payout" | "deposit" | "card_load" | "admin";
  summary: string;
  amount: string | null;
  reference: string;
  link_type: string;
  link_id: string;
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
