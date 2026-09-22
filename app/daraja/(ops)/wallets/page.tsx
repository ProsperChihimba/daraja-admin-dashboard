// app/daraja/(ops)/wallets/page.tsx  (URL: /daraja/wallets)
//
// C3: the wallet screens. Before this, an operator could only reach a wallet
// through its merchant's Wallet tab -- and only the merchant's first ACTIVE
// wallet at that (MerchantDetailPage's `wallet` card) -- so an inactive or
// branch wallet, or a wallet whose employer link nobody clicked through,
// could not be opened at all. GET /dashboard/wallets/, .../<id>/ and
// .../<id>/statement/ have existed and been tested since Plan 2 with no
// screen calling them; this is that screen.
//
// CURSOR-PAGINATED, NOT PAGE-NUMBER. `WalletViewSet.pagination_class` is
// `WalletPagination(DashboardPagination)` (dashboard/views/wallets.py) --
// the same CursorPagination every ledger/deposits list rides, not the
// page-number paginator behind the merchants roster (app/daraja/(ops)/merchants/page.tsx).
// So this follows the deposits/movements shape (`useCursorPages` + a
// "Load more" button), not merchants' `Pagination` component -- using the
// numbered component here would silently mismatch the wire format DRF's
// CursorPagination actually returns (`next`/`previous`, no `count`).
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatDate } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
import { useCursorPages } from "@/components/daraja/CursorList";
import type { WalletRow } from "@/types/daraja";

/**
 * `q` is a real, checked filter: `WalletViewSet.get_queryset` (dashboard/views/wallets.py)
 * applies it as `icontains` over `account_no`, `employer.business_name` and
 * `employer.phone_number`. No other query parameter is invented here.
 *
 * Embedded in the PATH, not in `useCursorPages`' own params -- that hook
 * only ever adds `cursor` (see CursorList.tsx), and a changed path is what
 * makes it drop the stale cursor and any loaded rows for the previous
 * search, exactly like `intentsPath` on the deposits screen.
 */
function walletsPath(q: string): string {
  return q ? `/wallets/?q=${encodeURIComponent(q)}` : "/wallets/";
}

export default function WalletsPage() {
  const router = useRouter();
  const [qInput, setQInput] = React.useState("");
  const [q, setQ] = React.useState("");

  // Debounced like the merchants search box (400ms): every committed
  // keystroke is a new path, and a new path resets the accumulated rows.
  React.useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const path = walletsPath(q);
  const { rows, loading, error, refetch, nextCursor, loadMore } =
    useCursorPages<WalletRow>(path);

  // "Still loading" and "that was the last page" are different facts --
  // `nextCursor` is null while a page is in flight, so the button stays
  // mounted on `loading` too (the same guard CursorList itself applies).
  const showLoadMore = Boolean(nextCursor) || (loading && rows.length > 0);

  const columns: Column<WalletRow>[] = [
    {
      key: "account_no",
      header: "Account number",
      render: (w) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{w.account_no || "—"}</span>
          {/*
            `shares_account_no`: more than one wallet carries this account
            number. Shown here, on the row, not only in the detail screen --
            this is exactly the situation where an operator acting on the
            wrong row moves real money to the wrong place
            (expense_payout debits `client_wallet_no`). A strong variant on
            purpose: this is a routing hazard, not a neutral fact.
          */}
          {w.shares_account_no ? (
            <StatusBadge variant="danger">shared #</StatusBadge>
          ) : null}
        </div>
      ),
    },
    {
      key: "business_name",
      header: "Merchant",
      render: (w) => w.business_name ?? "—",
    },
    {
      key: "balance",
      header: "Balance",
      // DecimalField(50,5) as a string, e.g. "51738.43000" -- handed to the
      // ops formatter untouched. Never Number()/parseFloat()/toFixed().
      render: (w) => formatOpsMoney(w.balance),
    },
    {
      key: "active",
      header: "State",
      render: (w) => (
        <StatusBadge variant={w.active ? "success" : "neutral"}>
          {w.active ? "active" : "inactive"}
        </StatusBadge>
      ),
    },
    {
      key: "registered",
      header: "Registered",
      render: (w) => formatDate(w.registered),
    },
  ];

  return (
    <>
      <PageHeader
        title="Wallets"
        subtitle="Every collection account -- reachable here whether or not it is a merchant's active wallet."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search account number, merchant or phone"
          className="max-w-xs"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
      </div>

      {/* Only a failure with nothing to show takes the whole area -- the
          convention CursorList set (whole-branch review, M2): rows already
          read stay on screen, with the error and Retry above them. */}
      {error && !rows.length ? <ErrorState message={error} onRetry={refetch} /> : null}
      {error && rows.length ? (
        <div className="mb-3">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !rows.length}
        rowKey={(w) => w.account_id}
        emptyMessage="No wallets match this search."
        onRowClick={(w) => router.push(`/daraja/wallets/${encodeURIComponent(w.account_id)}`)}
      />

      {showLoadMore ? (
        <div className="py-3 text-center">
          <Button variant="outline" size="sm" disabled={loading || !nextCursor} onClick={loadMore}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}
