export type OrgStatus = "active" | "suspended";

export interface AdminUser {
  id: string;
  name: string;
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
