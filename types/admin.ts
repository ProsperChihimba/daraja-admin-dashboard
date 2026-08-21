export type OrgStatus = "active" | "suspended";

export interface AdminUser {
  id: string;
  /** Derived client-side from first_name + last_name (backend has no `name` field). */
  name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email: string;
  is_superuser: boolean;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type OverviewAlertLevel = "warn" | "info" | "danger";

export interface OverviewAlert {
  level: OverviewAlertLevel;
  code: string;
  count: number;
  message: string;
}

// ---- Organizations ----------------------------------------------------

/** Loose — render defensively; extra fields from the backend are allowed. */
export interface SubscriptionPackage {
  id?: string;
  name?: string;
  description?: string;
  price?: string | number;
  duration_days?: number;
  is_active?: boolean;
  [key: string]: unknown;
}

/** Loose — render defensively; extra fields from the backend are allowed. */
export interface SubscriptionInfo {
  id?: string;
  status?: string;
  expired?: boolean;
  days_left?: number;
  current_period_end?: string | null;
  package?: SubscriptionPackage | null;
  created_at?: string;
  [key: string]: unknown;
}

/** Loose — render defensively; extra fields from the backend are allowed. */
export interface SubscriptionPayment {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: string | number;
  method?: string;
  package?: string;
  package_name?: string;
  phone_number?: string;
  paid_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface OrganizationAdmin {
  id: string;
  name: string;
  region: string | null;
  district: string | null;
  support_phone: string | null;
  has_staff: boolean;
  status: OrgStatus;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
}

export interface OrganizationStats {
  borrowers: number;
  loans_total: number;
  loans_active: number;
  outstanding: string;
  staff: number;
}

export interface OrganizationRow extends OrganizationAdmin {
  subscription: SubscriptionInfo | null;
  stats: OrganizationStats;
}

export interface OrganizationPortfolio {
  borrowers: number;
  loans_total: number;
  loans_active: number;
  loans_overdue: number;
  disbursed: string;
  collected: string;
  outstanding: string;
  collected_today: string;
}

export interface OrganizationStaffMember {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  status: string;
  has_login: boolean;
}

export interface OrganizationUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  staff_role: string;
}

export interface OrganizationDetail extends OrganizationAdmin {
  subscription: SubscriptionInfo | null;
  portfolio: OrganizationPortfolio;
  staff: OrganizationStaffMember[];
  users: OrganizationUser[];
  recent_payments: SubscriptionPayment[];
}

// ---- Borrowers ----------------------------------------------------

export type BorrowerStatus = "no_debt" | "has_debt" | "overdue";

export interface BorrowerRow {
  id: string;
  system_id: string;
  full_name: string;
  phone: string;
  status: BorrowerStatus;
  outstanding_debt: string;
  org: string;
  org_id: string;
}

export interface BorrowerDocument {
  id: string;
  name: string;
  url: string;
}

/** Loose — render defensively; extra fields from the backend are allowed. */
export interface Guarantor {
  full_name?: string;
  phone?: string;
  relationship?: string;
  national_id?: string;
  address?: string;
  id_document_url?: string;
  [key: string]: unknown;
}

export interface LoanFee {
  id?: string;
  name: string;
  amount: string | number;
}

/** Loose — render defensively; extra fields from the backend are allowed. */
export interface CollateralEmbedded {
  id?: string;
  asset_name?: string;
  asset_value?: string | number;
  guarantor_name?: string;
  guarantor_phone?: string;
  guarantor_national_id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface BorrowerSummary {
  id: string;
  system_id: string;
  full_name: string;
  phone: string;
}

export type LoanStatus = "owed" | "paid" | "overdue";

/**
 * Full LoanSerializer shape as embedded in `BorrowerDetail.loans`.
 * Type the fields we render explicitly; allow the rest loosely.
 */
export interface LoanRowLike {
  id: string;
  loan_id: string;
  borrower?: BorrowerSummary;
  borrower_name?: string;
  borrower_phone?: string;
  status: LoanStatus;
  principal: string;
  outstanding: string;
  start_date: string;
  end_date: string;
  [key: string]: unknown;
}

export interface BorrowerDetail {
  id: string;
  system_id: string;
  nature: string;
  full_name: string;
  phone: string;
  gender: string | null;
  national_id: string;
  profession: string;
  region: string;
  district: string;
  street: string;
  house_number: string;
  profile_photo_url: string | null;
  documents: BorrowerDocument[];
  guarantor: Guarantor | null;
  status: BorrowerStatus;
  active_loan_amount: string;
  outstanding_debt: string;
  registered_at: string | null;
  created_at: string;
  updated_at: string;
  organization: { id: string; name: string };
  loans: LoanRowLike[];
  [key: string]: unknown;
}

// ---- Loans ----------------------------------------------------

export interface LoanRow {
  id: string;
  loan_id: string;
  borrower_name: string;
  status: LoanStatus;
  principal: string;
  outstanding: string;
  start_date: string;
  end_date: string;
  org: string;
  org_id: string;
}

/** Loose — render defensively; RepaymentSerializer fields, extras allowed. */
export interface RepaymentLike {
  id: string;
  repayment_id?: string;
  payment_no?: number;
  payment_total?: number;
  scheduled_date?: string;
  paid_date?: string | null;
  amount?: string | number;
  amount_paid?: string | number;
  status?: string;
  payment_method?: string;
  days_late?: number;
  transaction_reference?: string;
  notes?: string | null;
  [key: string]: unknown;
}

export interface LoanDetail {
  id: string;
  loan_id: string;
  borrower?: BorrowerSummary;
  borrower_name: string;
  borrower_phone: string;
  status: LoanStatus;
  payment_method: string;
  principal: string;
  interest_kind: string;
  interest_rate: string | number | null;
  interest_rate_unit: string | null;
  interest_amount: string;
  loan_duration: number;
  loan_duration_unit: string;
  repayment_frequency: string;
  repayment_count: number;
  repayment_per_period: string;
  fees: LoanFee[];
  fees_total: string;
  total_payable: string;
  amount_paid: string;
  outstanding: string;
  collateral: CollateralEmbedded | null;
  start_date: string;
  end_date: string;
  organization: { id: string; name: string };
  repayments: RepaymentLike[];
  [key: string]: unknown;
}

// ---- Transactions ----------------------------------------------------

export type TransactionKind = "mkopo" | "rejesho" | "matumizi" | "mtaji" | "adjustment";

export interface TransactionRow {
  id: string;
  name: string;
  type: string;
  date: string;
  time: string;
  amount: string;
  mtaji_before: string;
  mtaji_after: string;
  payment: string;
  payment_method: string;
  changes_mtaji: boolean;
  kind: string;
  direction: string;
  account_kind: string;
  reference_type: string;
  reference_id: string;
  note: string;
  created_at: string;
  org: string;
  org_id: string;
}

// ---- Search ----------------------------------------------------

export type SearchResultType = "organization" | "borrower" | "loan" | "repayment" | "payment";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  org: string;
  loan_id?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

// ---- Billing ----------------------------------------------------

export interface Package {
  id: string;
  name: string;
  description: string;
  price: string;
  duration_days: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  description: string;
  percent_off: string | null;
  amount_off: string | null;
  is_active: boolean;
  valid_until: string | null;
  max_uses: number | null;
  used_count: number;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus = "pending" | "paid" | "failed";

export interface PaymentRow {
  id: string;
  order_id: string;
  status: PaymentStatus;
  amount: string;
  method: string;
  package: string;
  package_name: string;
  phone_number: string;
  discount_amount: string;
  swahilies_reference: string;
  note: string;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  org: string;
  org_id: string;
}

// ---- Support ----------------------------------------------------

export type IssueCategory = "loan" | "payment" | "account" | "data" | "technical" | "other";
export type IssuePriority = "low" | "medium" | "high" | "urgent";
export type IssueStatus = "open" | "investigating" | "waiting" | "resolved" | "closed";

export interface SupportIssue {
  id: string;
  reference: string;
  title: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  organization: string | null;
  organization_name: string | null;
  subject_type: string | null;
  subject_id: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  assignee: string | null;
  assignee_name: string | null;
  notes_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface IssueNote {
  id: string;
  author: string;
  author_phone: string | null;
  body: string;
  created_at: string;
}

export interface SupportIssueDetail extends SupportIssue {
  description: string;
  resolution: string;
  notes: IssueNote[];
}

// ---- System ----------------------------------------------------

export interface ActivityRow {
  id: number | string;
  method: string;
  path: string;
  feature: string;
  status_code: number;
  duration_ms: number;
  user: string;
  org: string;
  created_at: string;
}

export interface SystemHealth {
  counts: {
    organizations: number;
    organizations_suspended: number;
    users: number;
    borrowers: number;
    loans: number;
    repayments: number;
    transactions: number;
    open_issues: number;
    failed_payments: number;
    audit_events: number;
  };
  recent_activity: ActivityRow[];
  recent_errors: ActivityRow[];
  flags: {
    email_verification_enabled: boolean;
  };
}

// ---- Audit ----------------------------------------------------

export interface AuditEntry {
  id: string;
  actor: string | null;
  actor_phone: string;
  action: string;
  entity_type: string;
  entity_id: string;
  organization: string | null;
  organization_name: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string;
  ip: string;
  result: string;
  error: string;
  created_at: string;
}

export interface OverviewStats {
  generated_at: string;
  organizations: {
    total: number;
    active: number;
    suspended: number;
    new_this_month: number;
  };
  subscriptions: {
    total: number;
    trial: number;
    active: number;
    expired: number;
    expiring_soon: number;
  };
  borrowers: {
    total: number;
    with_debt: number;
    overdue: number;
  };
  loans: {
    total: number;
    active: number;
    overdue: number;
    disbursed: string;
    collected: string;
    outstanding: string;
  };
  overdue: {
    loans: number;
    amount: string;
  };
  today: {
    collections: string;
    collections_count: number;
    disbursements: string;
    disbursements_count: number;
  };
  revenue: {
    total: string;
    this_month: string;
    pending_payments: number;
    failed_payments: number;
  };
  alerts: OverviewAlert[];
}
