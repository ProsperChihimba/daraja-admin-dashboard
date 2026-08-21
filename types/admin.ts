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
