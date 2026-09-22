// app/daraja/(ops)/wallets/[accountId]/page.tsx  (URL: /daraja/wallets/<accountId>)
//
// The wallet ops previously could only reach through its merchant's Wallet
// tab -- and even then only if it happened to be that merchant's first
// ACTIVE wallet (see MerchantDetailPage's "no active wallet" card). This is
// the account-first read: the wallet itself, plus its own running statement
// (GET /dashboard/wallets/<id>/statement/), which the spec called out
// specifically and which has been built and unserved since Plan 2.
"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status_badge";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/components/common/DateRangeFilter";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
import { useDarajaResource } from "@/lib/darajaAuth";
import { useCursorPages } from "@/components/daraja/CursorList";
import type { WalletDetail, WalletStatementLine, WalletStatementPage } from "@/types/daraja";

/** `narration`/`debitOrCredit` are nullable columns on
 *  CollectionAccountTransaction and a blank one is ordinary, not a broken
 *  row -- `||`, not `??`, matching WalletTab's Reference column and the
 *  merchant detail page's Field (M3/M6 precedent). */
function orDash(value: string | null | undefined): string {
  return value || "—";
}

/**
 * The statement's fetch path, built from the date-range filter.
 *
 * NEITHER PARAM IS SENT UNTIL THE OPERATOR SETS ONE. `WalletStatement.get`
 * (dashboard/views/wallets.py) defaults an absent `start_date`/`end_date` to
 * the last 30 days ending today itself (`_STATEMENT_WINDOW_DAYS`); hardcoding
 * that default here as well would be a second place for the two to drift
 * apart, exactly the divergence that view's own docstring calls out between
 * itself and wallet_history.py. The actual window in force is always read
 * back off the response's own `window` key below, never assumed from the
 * filter's blank state.
 *
 * Embedded in the path, like `intentsPath` on the deposits screen and
 * `walletsPath` on the list here -- `useCursorPages` only ever adds `cursor`
 * of its own, and a changed path is what resets the accumulated rows for the
 * new window instead of appending the new window's lines under the old
 * one's cursor.
 */
function statementPath(accountId: string, range: DateRange): string {
  const params = new URLSearchParams();
  if (range.after) params.set("start_date", range.after);
  if (range.before) params.set("end_date", range.before);
  const qs = params.toString();
  return `/wallets/${encodeURIComponent(accountId)}/statement/${qs ? `?${qs}` : ""}`;
}

/**
 * The statement lines table's columns.
 *
 * Follows the shape app/daraja/(ops)/deposits/page.tsx's `statementColumns`
 * established for statement-shaped rows (money via formatOpsMoney, a
 * monospace reference column, `||` for blank-but-present text) -- but is not
 * that same function, because `WalletStatementLine` is a different backend
 * shape (CollectionAccountTransaction, via WalletStatement.get's own dict)
 * with different field names than `StatementRowItem` (the pooled account's
 * Selcom rows). Reusing the deposits function directly would either not
 * compile or silently read the wrong fields.
 *
 * `amountCredited`/`amountDebited` are both always-present decimal strings,
 * shown as two separate columns rather than combined into one signed figure
 * -- subtracting them client-side would be arithmetic on money, which this
 * screen's money rules forbid outside the backend that already computed
 * `kind`/the credit-or-debit split.
 */
const statementColumns: Column<WalletStatementLine>[] = [
  { key: "registered", header: "When", render: (l) => formatDateTime(l.registered) },
  {
    key: "narration",
    header: "Narration",
    className: "whitespace-normal",
    render: (l) => orDash(l.narration),
  },
  {
    key: "kind",
    header: "Kind",
    render: (l) => <StatusBadge variant="neutral">{l.kind}</StatusBadge>,
  },
  { key: "amountCredited", header: "Credited", render: (l) => formatOpsMoney(l.amountCredited) },
  { key: "amountDebited", header: "Debited", render: (l) => formatOpsMoney(l.amountDebited) },
  // The running balance AFTER this line -- DecimalField(50,5), same column
  // shape as the wallet's own `balance` above it.
  { key: "balance", header: "Balance", render: (l) => formatOpsMoney(l.balance) },
  {
    key: "transaction_id",
    header: "Ref",
    render: (l) => <span className="font-mono text-xs">{l.transaction_id}</span>,
  },
];

function StatementSection({ accountId }: { accountId: string }) {
  const [range, setRange] = React.useState<DateRange>(EMPTY_RANGE);
  const path = statementPath(accountId, range);
  const { rows, page, loading, error, refetch, nextCursor, loadMore } = useCursorPages<
    WalletStatementLine,
    WalletStatementPage
  >(path);

  // `summary`/`window` ride on EVERY page of the same query (the view
  // recomputes both over the whole selected window on every request, not
  // just the current page -- dashboard/views/wallets.py), so reading them
  // off the latest-fetched page is correct whether this is page one or the
  // result of three "Load more" clicks.
  const summary = page?.summary;
  const window_ = page?.window;

  const showLoadMore = Boolean(nextCursor) || (loading && rows.length > 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DateRangeFilter value={range} onChange={setRange} label="Window" />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {/*
            THE WINDOW THE SUMMARY COVERS, ALWAYS SHOWN ALONGSIDE THE
            FIGURES. The backend attaches `window` precisely because
            "money_out: 4,000" with no dates cannot be told from a truncated
            month -- a summary rendered without it would be lying by
            omission, whether or not the operator touched the date filter.
          */}
          {window_ ? (
            <p className="mb-3 text-xs text-text-muted">
              Covers {formatDate(window_.start_date)} – {formatDate(window_.end_date)}
            </p>
          ) : (
            <p className="mb-3 text-xs text-text-muted">
              {loading ? "Loading the window…" : "Window unavailable."}
            </p>
          )}
          {summary ? (
            <div className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <div className="text-xs text-text-muted">Opening</div>
                <div className="text-text">{formatOpsMoney(summary.opening_balance)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Closing</div>
                <div className="text-text">{formatOpsMoney(summary.closing_balance)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Money in</div>
                <div className="text-text">{formatOpsMoney(summary.money_in)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Money out</div>
                <div className="text-text">{formatOpsMoney(summary.money_out)}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Fees</div>
                <div className="text-text">{formatOpsMoney(summary.total_fees)}</div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Only a failure with nothing to show takes the whole area -- rows
          already read stay on screen with the error above them, the
          convention CursorList set (whole-branch review, M2). */}
      {error && !rows.length ? <ErrorState message={error} onRetry={refetch} /> : null}
      {error && rows.length ? (
        <div className="mb-3">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : null}

      <DataTable
        columns={statementColumns}
        rows={rows}
        loading={loading && !rows.length}
        rowKey={(l) => l.transaction_id}
        emptyMessage="No statement lines in this window."
      />

      {showLoadMore ? (
        <div className="py-3 text-center">
          <Button variant="outline" size="sm" disabled={loading || !nextCursor} onClick={loadMore}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function WalletDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { data: w, loading, error, refetch } = useDarajaResource<WalletDetail>(
    `/wallets/${encodeURIComponent(accountId)}/`,
  );

  if (error) {
    return (
      <>
        <PageHeader title="Wallet" />
        <ErrorState message={error} onRetry={refetch} />
      </>
    );
  }
  if (loading && !w) {
    return (
      <>
        <PageHeader title="Wallet" />
        <LoadingBlock />
      </>
    );
  }
  if (!w) return null;

  return (
    <>
      <PageHeader
        title={w.account_no || "Account number not set"}
        subtitle={`registered ${formatDate(w.registered)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge variant={w.active ? "success" : "neutral"}>
              {w.active ? "active" : "inactive"}
            </StatusBadge>
            {/* Same hazard the list row flags -- shown again here so an
                operator who navigated straight to this URL still sees it. */}
            {w.shares_account_no ? (
              <StatusBadge variant="danger">shares this account #</StatusBadge>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatOpsMoney(w.balance)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Merchant</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {w.employer_id ? (
              <Link
                href={`/daraja/merchants/${w.employer_id}`}
                className="underline-offset-2 hover:underline"
              >
                {w.business_name ?? "—"}
              </Link>
            ) : (
              w.business_name ?? "—"
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Branch</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {/* `branch: null` is the employer's MAIN wallet (Branch.wallet is
                a nullable OneToOne) -- not "no data" and not shown as such. */}
            {w.branch ? (
              <>
                {w.branch.name}
                {w.branch.active ? "" : " (branch inactive)"}
              </>
            ) : (
              "Main wallet (no branch)"
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Account number</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-sm">{w.account_no || "not set"}</CardContent>
        </Card>
      </div>

      <h2 className="mb-3 font-heading text-lg font-semibold text-text">Statement</h2>
      <StatementSection accountId={accountId} />
    </>
  );
}
