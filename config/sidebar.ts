import {
  LayoutDashboard,
  Building2,
  CreditCard,
  LifeBuoy,
  Activity,
  ScrollText,
  Users,
  Wallet,
  BookOpen,
  Inbox,
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

/**
 * The Daraja ops console's OWN navigation -- the only links an ops account can
 * actually open.
 *
 * WHY THIS IS A SEPARATE EXPORT. A Daraja ops account is not an Ankara admin:
 * `create_ops_user` never touches Ankara's auth, so it has no Ankara Redux
 * session at all. Every link in the groups below enters `app/(app)/`, whose
 * layout is `RequireAuth`, which redirects to `/login` -- ANKARA's login form,
 * inside the same shell the operator was just using, posting to a different
 * service (NEXT_PUBLIC_API_BASE_URL). Roughly ten of the eleven entries were
 * therefore dead ends for the only user class these ops screens exist for, and
 * the dead end looks like an expired session rather than a wrong link
 * (whole-branch review, I4).
 *
 * `sidebarConfig` below still spreads this group, so the Ankara sidebar is
 * byte-identical to what it rendered before -- an Ankara superuser keeps the
 * entry point into the ops console, which is how they reach it.
 */
export const darajaSidebarConfig: NavGroup[] = [
  {
    id: "daraja",
    label: "Daraja Ops",
    items: [
      { label: "Merchants", href: "/daraja/merchants", icon: Users },
      { label: "Ledger", href: "/daraja/ledger", icon: Wallet },
      { label: "Movements", href: "/daraja/ledger/movements", icon: BookOpen },
      { label: "Deposits", href: "/daraja/deposits", icon: Inbox },
    ],
  },
];

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
  // One definition, spread -- not a second copy that can drift from the list
  // the ops console itself renders.
  ...darajaSidebarConfig,
];
