import {
  LayoutDashboard,
  Building2,
  CreditCard,
  LifeBuoy,
  Activity,
  ScrollText,
  Wallet,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Top-level nav is Ankara's *business*, not per-MFI operations. Loans,
// borrowers, repayments, and transactions live inside an organization's
// detail view, never as cross-MFI top-level screens.
export const sidebarConfig: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    id: "business",
    label: "Business",
    items: [
      { label: "Organizations", href: "/organizations", icon: Building2 },
      { label: "Subscriptions", href: "/subscriptions", icon: CreditCard },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { label: "Support", href: "/support", icon: LifeBuoy },
      { label: "System", href: "/system", icon: Activity },
      { label: "Audit Log", href: "/audit", icon: ScrollText },
    ],
  },
  {
    id: "daraja",
    label: "Daraja Ops",
    items: [{ label: "Merchants", href: "/daraja/merchants", icon: Users }],
  },
];
