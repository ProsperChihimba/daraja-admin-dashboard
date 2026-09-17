// app/daraja/(ops)/deposits/page.tsx  (URL: /daraja/deposits)
//
// The three deposit queues that need a human, side by side: money that left
// the pool unexplained, money that arrived unattributed, and the declarations
// merchants made about money on its way.
//
// THE TWO QUEUES ARE OPPOSITE SIDES OF THE LEDGER AND THE SCREEN SAYS SO.
// "Unmatched debits" are DEBITS: money that went OUT of the pool with no
// recorded payout behind it. "Suspense" is the CREDIT side: money that came IN
// and could not be attributed to anyone. An earlier backend name for the first
// endpoint ("UnmatchedCredits" / `deposits/unmatched/`) described the wrong
// side of the ledger, and was renamed precisely because an operator reading
// "unmatched" under `deposits/` mid-incident would assume incoming money and
// work the wrong queue (dashboard/views/deposits.py). Nothing on this screen
// is allowed to reintroduce that reading: the tab is labelled "Unmatched
// debits", never "Unmatched", and each queue states in words which direction
// the money moved.
//
// READ-ONLY, DELIBERATELY. There is no match, resolve or return control here,
// and no disabled one standing in for a future one -- a control that cannot
// act invites the one support question this screen has no way to answer.
// Those actions are a later plan. The only buttons are Load more and Retry.
//
// THE UNMATCHED COUNT IS FETCHED FOR THE TAB LABEL, NOT FOR THE PANEL. It is
// the number the design says should have surfaced the 2026-09-16 incident, so
// it has to be legible without opening the queue. One page-level request
// serves both the label and the panel; the panel does not fetch again.
"use client";
import * as React from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CursorList } from "@/components/daraja/CursorList";
import { RefreshControl } from "@/components/daraja/RefreshControl";
import { useDarajaResource } from "@/lib/darajaAuth";
import { formatDateTime } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
import type {
  DepositIntentRow,
  StatementRowItem,
  UnmatchedDebitsPayload,
} from "@/types/daraja";

/**
 * The intents endpoint for one state filter.
 *
 * The filter rides in the path's own query string rather than in the hook's
 * params, because `useCursorPages` owns that params object (it puts the cursor
 * there) and takes nothing else -- the same arrangement the movements screen
 * uses, and axios appends its `cursor` with `&` when the url already carries a
 * `?`. An empty filter is OMITTED rather than sent blank: the backend treats a
 * missing and an empty `state` identically (`(request.query_params.get("state")
 * or "").strip()`), but `state=` would still read as a different query to the
 * hook and would throw away loaded pages for a filter nobody set.
 *
 * Exported so the mapping can be asserted directly rather than inferred from
 * rendered output.
 */
export function intentsPath(state: string): string {
  return state ? `/deposits/intents/?state=${encodeURIComponent(state)}` : "/deposits/intents/";
}

/**
 * DepositIntent.OPEN / MATCHED / EXPIRED (wallets/models.py:213). The backend
 * 400s on anything outside this set, so these are its exact vocabulary rather
 * than a likely-looking subset.
 */
const INTENT_STATES = ["open", "matched", "expired"] as const;

const INTENT_VARIANT: Record<string, StatusVariant> = {
  open: "warning",
  matched: "success",
  expired: "neutral",
};

/**
 * A `StatementRow` value that is blank rather than absent.
 *
 * `details`, `client_name`, `transaction_date`, `payment_type` and
 * `bank_number` are all `blank=True, default=""` on the model
 * (wallets/models.py:102-110), so the empty string is LIVE DATA, not a missing
 * field. `||`, never `??`: `??` would pass "" straight through and render a
 * blank cell that reads as a broken screen, which is the same distinction
 * WalletTab's Reference column and the merchant detail page's Field both make.
 */
const orDash = (value: string) => value || "—";

/**
 * The columns shared by the two statement-row queues.
 *
 * `nameHeader` differs between them because the same column means opposite
 * things on the two sides of the ledger: on a credit it is who SENT the money,
 * on a debit it is the counterparty it went to. One header for both would be
 * wrong on one of them.
 *
 * TWO DATES, AND THEY ARE NOT INTERCHANGEABLE. `transaction_date` is a
 * CharField(max_length=40) carrying Selcom's own free text verbatim
 * (wallets/models.py:104) -- it is NOT a timestamp and must not be handed to
 * formatDateTime, which would render "Invalid Date" for anything Selcom
 * formats unexpectedly. `ingested` is the real DateTimeField (auto_now_add),
 * so it is the one that gets formatted. Both are shown: the value date is what
 * the operator matches against a counterparty's records, and the ingested time
 * is the only one this system can vouch for.
 */
function statementColumns(nameHeader: string): Column<StatementRowItem>[] {
  return [
    {
      key: "amount",
      header: "Amount",
      // DecimalField(20,2) serialized by money_str as a decimal STRING, handed
      // to the ops formatter unconverted -- no Number(), no parseFloat, no
      // `|| 0`. formatOpsMoney strips trailing zeros, so "500000.00" renders
      // "TZS 500,000", which is correct.
      render: (r) => formatOpsMoney(r.amount),
    },
    { key: "client_name", header: nameHeader, render: (r) => orDash(r.client_name) },
    {
      key: "details",
      header: "Details",
      className: "whitespace-normal",
      render: (r) => orDash(r.details),
    },
    {
      key: "transaction_id",
      header: "Selcom ref",
      // The primary key IS Selcom's transaction_id (wallets/models.py:91-96) --
      // the identifier an operator quotes when they take this row to Selcom.
      render: (r) => <span className="font-mono text-xs">{r.transaction_id}</span>,
    },
    {
      key: "transaction_date",
      header: "Value date",
      render: (r) => orDash(r.transaction_date),
    },
    { key: "ingested", header: "Ingested", render: (r) => formatDateTime(r.ingested) },
  ];
}

/** A one-line statement of what a queue holds, above its table. */
function QueueNote({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm text-text-muted">{children}</p>;
}

/**
 * Unmatched debits -- an UNPAGINATED `{count, results}` envelope.
 *
 * This one view builds its own `Response` instead of running a paginator
 * (dashboard/views/deposits.py), so there is no `next`, no cursor and no Load
 * more: what arrives is the whole queue. It therefore does NOT go through
 * CursorList, which would look for a `next` that is never there.
 *
 * The payload is fetched by the page (for the tab label) and passed in, rather
 * than fetched again here.
 */
function UnmatchedDebitsQueue({
  payload,
  loading,
  error,
  refetch,
}: {
  payload: UnmatchedDebitsPayload | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}) {
  return (
    <>
      <QueueNote>
        Money that <strong>left</strong> the pool with no recorded payout behind
        it. These are debits, not incoming money — unattributed money that
        arrived is in Suspense.
      </QueueNote>

      {/* Only a failure with nothing to show takes the whole area, the
          convention CursorList set (whole-branch review, M2). */}
      {error && !payload ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {error ? (
            <div className="mb-3">
              <ErrorState message={error} onRetry={refetch} />
            </div>
          ) : null}
          <DataTable
            columns={statementColumns("Counterparty")}
            rows={payload?.results ?? []}
            loading={loading && !payload}
            rowKey={(r) => r.transaction_id}
            emptyMessage="No unmatched debits. Every debit that left the pool has a payout behind it."
          />
          {/* The complete queue, not a page: stated so nobody goes looking for
              a Load more that cannot exist. `count` is the backend's own
              number and is rendered only when a payload actually arrived -- an
              unread or failed count must never render as "0", which is what
              would make a full queue look empty. */}
          {payload ? (
            <p className="py-3 text-center text-xs text-text-muted">
              {payload.count === 1 ? "1 unmatched debit" : `${payload.count} unmatched debits`}
              {" · the complete queue, not a page"}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

/** Money that arrived and could not be attributed to anyone. */
function SuspenseQueue() {
  return (
    <>
      <QueueNote>
        Money that <strong>arrived</strong> in the pool and could not be
        attributed to any merchant. Every row here is a credit sitting in
        suspense.
      </QueueNote>
      <CursorList<StatementRowItem>
        path="/deposits/suspense/"
        rowKey={(r) => r.transaction_id}
        emptyMessage="Nothing in suspense. Every credit that arrived was attributed."
        columns={statementColumns("Sender")}
      />
    </>
  );
}

/**
 * Merchants' declarations that money is on its way.
 *
 * THE STATE FILTER VARIES THE PATH UNDER ONE LIVE LIST, which is the shape
 * that used to corrupt an accumulating cursor (the old cursor sent to the new
 * query, the new response then discarded as already-applied). `useCursorPages`
 * now resets `cursor` and `rows` when `path` changes and `useDarajaResource`
 * keys its held response by path, so no `key` is needed here -- the correctness
 * lives in the hook, where every caller gets it.
 */
function IntentsQueue() {
  const [state, setState] = React.useState("");

  return (
    <>
      <QueueNote>
        A merchant&apos;s declaration that money is on its way. Confirmation and
        UX only — an intent is never the key money is matched on.
      </QueueNote>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={state || "all"}
          onValueChange={(v) => setState(!v || v === "all" ? "" : String(v))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {INTENT_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CursorList<DepositIntentRow>
        path={intentsPath(state)}
        rowKey={(i) => i.intent_id}
        emptyMessage="No deposit intents match this filter."
        columns={[
          { key: "amount", header: "Amount", render: (i) => formatOpsMoney(i.amount) },
          {
            key: "business_name",
            header: "Merchant",
            // Nullable on the serializer: the intent's wallet may have no
            // employer behind it. An em dash, never the string "null".
            render: (i) => i.business_name ?? "—",
          },
          {
            key: "description",
            header: "Description",
            className: "whitespace-normal",
            render: (i) => orDash(i.description),
          },
          {
            key: "source_account_number",
            header: "From account",
            // Defaults to "" rather than NULL for legacy intents
            // (wallets/models.py) -- `||`, not `??`, same as WalletTab's
            // Deposits table (M6).
            render: (i) => (
              <span className="font-mono text-xs">{orDash(i.source_account_number)}</span>
            ),
          },
          {
            key: "state",
            header: "State",
            render: (i) => (
              <StatusBadge variant={INTENT_VARIANT[i.state] ?? "neutral"}>
                {i.state}
              </StatusBadge>
            ),
          },
          {
            key: "registered",
            header: "Declared",
            // auto_now_add DateTimeField -- a real timestamp, unlike
            // StatementRow.transaction_date.
            render: (i) => formatDateTime(i.registered),
          },
        ]}
      />
    </>
  );
}

/**
 * The screen's whole body.
 *
 * Exported, and taking its initial tab as a prop, so a harness can mount the
 * real component and drive it deterministically -- the code under test is then
 * byte-identical to the code that ships, which is the precedent Task 8 set and
 * its review accepted.
 */
export function DepositsScreen({ initialTab = "unmatched" }: { initialTab?: string }) {
  const [tab, setTab] = React.useState(initialTab);

  // Fetched at page level, unconditionally, so the queue's SIZE is visible
  // without opening it -- see the file header.
  const {
    data: unmatched,
    loading: unmatchedLoading,
    error: unmatchedError,
    fetchedAt: unmatchedFetchedAt,
    refetch: refetchUnmatched,
  } = useDarajaResource<UnmatchedDebitsPayload>("/deposits/unmatched-debits/");

  return (
    <>
      <PageHeader
        title="Deposits"
        subtitle="The three queues that need a human: debits nobody owns, credits nobody claimed, and declared deposits."
        /* THE COUNT IN THE TAB LABEL NEVER REFRESHED. It is fetched once per
           mount, and its only `refetch` was wired to ErrorState's Retry --
           reachable only after the request had already failed. So the number
           the design says should have surfaced the 2026-09-16 incident sat
           frozen at whatever it was when the tab was opened, with nothing on
           screen saying how old it was. In the header rather than inside the
           Unmatched-debits panel because the badge it refreshes is legible
           from all three tabs. Manual, not a poll -- see RefreshControl. */
        actions={
          <RefreshControl
            label="Unmatched debits"
            fetchedAt={unmatchedFetchedAt}
            busy={unmatchedLoading}
            onRefresh={() => {
              void refetchUnmatched();
            }}
          />
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="unmatched">
            Unmatched debits
            {/* The count rides in the label, so the queue's size is legible
                from any tab. Rendered only when the payload actually arrived:
                a failed or in-flight read shows NO number rather than "0",
                because a fabricated zero is exactly how a full queue comes to
                look empty. */}
            {unmatched ? (
              <StatusBadge
                variant={unmatched.count > 0 ? "warning" : "neutral"}
                className="ml-2"
              >
                {unmatched.count}
              </StatusBadge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="suspense">Suspense</TabsTrigger>
          <TabsTrigger value="intents">Intents</TabsTrigger>
        </TabsList>

        <TabsContent value="unmatched">
          <UnmatchedDebitsQueue
            payload={unmatched}
            loading={unmatchedLoading}
            error={unmatchedError}
            refetch={refetchUnmatched}
          />
        </TabsContent>
        <TabsContent value="suspense">
          <SuspenseQueue />
        </TabsContent>
        <TabsContent value="intents">
          <IntentsQueue />
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-text-muted">
        Read-only. Matching, resolving and returning money are deliberately not
        on this screen — they arrive with the money-actions plan.
      </p>
    </>
  );
}

export default function DepositsPage() {
  return <DepositsScreen />;
}
