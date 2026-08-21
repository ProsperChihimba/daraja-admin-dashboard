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
