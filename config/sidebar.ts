import {
  LayoutDashboard,
  Building2,
  Users,
  Banknote,
  ArrowLeftRight,
  CreditCard,
  LifeBuoy,
  Activity,
  ScrollText,
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

export const sidebarConfig: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    id: "tenants",
    label: "Tenants",
    items: [{ label: "Organizations", href: "/organizations", icon: Building2 }],
  },
  {
    id: "investigate",
    label: "Investigate",
    items: [
      { label: "Borrowers", href: "/borrowers", icon: Users },
      { label: "Loans", href: "/loans", icon: Banknote },
      { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [{ label: "Subscriptions", href: "/subscriptions", icon: CreditCard }],
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
];
