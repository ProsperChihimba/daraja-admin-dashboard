// components/daraja/ActionRequestCard.tsx -- one money-action request.
//
// This card is the one place in the console where a real approval can
// happen, so its bar is not "looks right" but "cannot be wrong": Approve is
// disabled the instant the live detail says the world has moved (`stale`),
// the instant the request has aged out (`expired`), or the instant this
// screen has no proven way to send the exact key the backend requires (see
// `ActionRequestDetail.idempotency_key` in lib/darajaActions.ts). A disabled
// button with a reason underneath it is the honest state; a button that
// sends a best-guess header is not.
//
// (The key itself IS sent by the backend now -- it is in
// `ActionRequestSerializer.Meta.fields`, so every detail response carries it
// and approving from this screen works; it was done against production on
// 2026-09-24. An earlier version of this comment said the backend never sent
// it. The `hasKey` guard below is not about that: the QUEUE serializer still
// strips the field by design, and a detail fetch can fail, so "we do not hold
// the key" remains a state this card can genuinely be in.)
//
// The card also carries the other half of the money question. `state` on the
// request says whether it was APPROVED; it reads `executed` the moment the
// intent commits, before any provider is called. Whether the rail did
// anything is in `detail.executions` -- rendered below by
// components/daraja/ActionExecutions.tsx, and, for an `unknown`, as a blocking
// banner above everything else on this card.
"use client";
import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import { Button } from "@/components/ui/button";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import {
  ExecutionList,
  UnknownExecutionBanner,
} from "@/components/daraja/ActionExecutions";
import { formatDateTime } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
import {
  type ActionRequest,
  type ActionRequestDetail,
  approveActionRequest,
  extractOpsErrorMessage,
  getActionRequestDetail,
  refuseActionRequest,
} from "@/lib/darajaActions";

const STATE_VARIANT: Record<ActionRequest["state"], StatusVariant> = {
  pending: "warning",
  executed: "success",
  refused: "neutral",
  expired: "neutral",
  failed: "danger",
};

/** "employer.approve" -> "Activate merchant". Named for the actions this
 * console ships; anything else falls back to a mechanical de-slug so a future
 * action_type never renders blank. */
function actionLabel(actionType: string): string {
  if (actionType === "employer.approve") return "Activate merchant";
  if (actionType === "employer.suspend") return "Suspend merchant";
  if (actionType === "card.freeze") return "Freeze card (ops hold)";
  if (actionType === "card.unfreeze") return "Unfreeze card";
  return actionType.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Money keys this system's previews actually use today -- see
 * dashboard/actions/employer.py's approve_preview (`wallet.opens_at`) and
 * types/daraja.ts's MerchantDetail (`monthly_cap_tzs`). Anything else is
 * plain data, not money, and is never pushed through a money formatter. */
const MONEY_KEY = /(^|_)(amount|balance|opens_at|cap|tzs|fee|price)($|_)/i;

/** Renders one preview value. Recurses into plain objects/arrays; a value
 * under a money-shaped key is rendered as TEXT through formatOpsMoney --
 * never Number(), never arithmetic -- exactly like every other money cell in
 * this console (lib/darajaMoney.ts). A `[was, is]` pair (the shape
 * `preview.changes` and `diff` both use) renders as "was -> is". */
function PreviewValue({ k, value }: { k: string; value: unknown }): React.ReactElement {
  if (value === null || value === undefined) return <>—</>;
  if (Array.isArray(value) && value.length === 2 && !Array.isArray(value[0]) &&
      typeof value[0] !== "object") {
    return (
      <>
        {String(value[0] ?? "—")} <span className="text-text-faint">→</span>{" "}
        {String(value[1] ?? "—")}
      </>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-muted">none</span>;
    return (
      <ul className="list-disc space-y-0.5 pl-4">
        {value.map((v, i) => (
          <li key={i}><PreviewValue k={k} value={v} /></li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-text-muted">none</span>;
    return (
      <dl className="space-y-1 border-l border-border-soft pl-3">
        {entries.map(([ck, cv]) => (
          <div key={ck}>
            <dt className="text-xs text-text-muted">{ck.replace(/_/g, " ")}</dt>
            <dd className="text-sm"><PreviewValue k={ck} value={cv} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  if (typeof value === "string" && MONEY_KEY.test(k)) {
    return <>{formatOpsMoney(value)}</>;
  }
  return <>{String(value)}</>;
}

/** "expires in 42m 10s" -- ticks every second while the request is still
 * live, so the operator never has to refresh to see a deadline pass. */
function Countdown({ expiresAt, expired }: { expiresAt: string; expired: boolean }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (expired) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expired]);

  const remainingMs = new Date(expiresAt).getTime() - now;
  if (expired || remainingMs <= 0) {
    return <span className="text-danger-fg">expired</span>;
  }
  const totalSecs = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return (
    <span className={mins < 5 ? "text-danger-fg" : "text-text-muted"}>
      expires in {mins}m {secs.toString().padStart(2, "0")}s
    </span>
  );
}

export function ActionRequestCard({
  request,
  onDecided,
}: {
  request: ActionRequest;
  onDecided: () => void;
}) {
  const [detail, setDetail] = React.useState<ActionRequestDetail | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [refuseOpen, setRefuseOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const isPending = request.state === "pending";

  // WHICH ROWS ARE WORTH A DETAIL FETCH, AND WHY IT IS NO LONGER ONLY THE
  // PENDING ONES. This used to fetch for `pending` alone, because the only
  // thing the detail added was the staleness diff. It now also carries
  // `executions` -- and an execution stuck in `unknown` sits on a request
  // whose own state reads `executed`, because the request goes to `executed`
  // when the intent commits, before the provider is even called. Fetching
  // only for pending rows would mean the banner that says "a card may or may
  // not be spendable right now" could never appear.
  //
  // `refused` and `expired` are still skipped, and that is not a guess: an
  // execution row is written by the APPROVE path, so a request nobody
  // approved has none, and a terminal request reports `diff: {}` / `stale:
  // false` anyway. This is a page of up to 50 cards, so the rows that cannot
  // carry anything new do not each cost a request.
  // A PENDING row needs detail for two things it cannot get from the list:
  // the live staleness diff, and the idempotency_key the approve call must
  // send. A terminal row needs it only to show executions -- and the list now
  // says outright how many OPEN unknowns each row holds
  // (ActionRequestListSerializer.unknown_executions, one annotated COUNT for
  // the whole page), so a settled row costs nothing until there is genuinely
  // something on it to see.
  //
  // The earlier version fetched detail for every executed and failed row,
  // which on a page of 50 was up to 50 round trips, each of them also running
  // read_state() once per execution. A queue that slow is a queue people stop
  // opening, and this is the queue where an operator finds out a card may or
  // may not be spendable.
  const hasOpenUnknown = (request.unknown_executions ?? 0) > 0;
  const wantsDetail = isPending || hasOpenUnknown;

  const loadDetail = React.useCallback(async () => {
    if (!wantsDetail) return;
    try {
      const d = await getActionRequestDetail(request.request_id);
      setDetail(d);
      setDetailError(null);
    } catch (e) {
      setDetailError(extractOpsErrorMessage(e, "Could not load the current status."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.request_id, wantsDetail]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const expired = detail ? detail.expired : request.expired;
  const stale = detail?.stale ?? false;
  const hasKey = Boolean(detail?.idempotency_key);
  const noKeyReason =
    "This request's approval key (idempotency_key) was not present in the "
    + "detail response -- reload this request, or approve from a client "
    + "that has it.";

  const approveDisabled = !isPending || expired || stale || !hasKey;
  const approveDisabledReason = !isPending
    ? "This request is no longer pending."
    : expired
      ? "This request expired. A new request is needed."
      : stale
        ? "The facts changed since this was requested. Refresh and re-check before approving."
        : !hasKey
          ? noKeyReason
          : null;

  // Every `unknown` execution on this request, newest first as the backend
  // ordered them. Normally at most one -- there is one execution per request
  // (ActionExecution's own docstring) -- but this does not assume that, and a
  // second unknown would be a second banner rather than one silently hidden.
  const unknownExecutions =
    detail?.executions?.filter((ex) => ex.state === "unknown") ?? [];

  // `target_ref` is NOT always a merchant. It is an employer_id for
  // `employer.*`, a card_id for `card.*` and a treasury wallet key for
  // `treasury.*` (lib/darajaTreasury.ts `TreasuryWallet.key`), so linking it
  // to /daraja/merchants/<target_ref> unconditionally -- as this card used to
  // -- produces a confident link to a merchant page that cannot exist.
  const targetIsMerchant = request.action_type.startsWith("employer.");

  async function handleApprove() {
    if (!detail?.idempotency_key) {
      setActionError(noKeyReason);
      throw new Error(noKeyReason);
    }
    try {
      await approveActionRequest(request.request_id, detail.idempotency_key);
      setActionError(null);
      onDecided();
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not approve this request.");
      setActionError(msg);
      await loadDetail(); // a 409 usually means something moved -- refresh what we show
      throw e; // keeps DangerousActionModal open so the operator sees the error
    }
  }

  async function handleRefuse(reason: string) {
    try {
      await refuseActionRequest(request.request_id, reason);
      setActionError(null);
      onDecided();
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not refuse this request.");
      setActionError(msg);
      throw e;
    }
  }

  return (
    // The ring turns the WHOLE card red when an execution is unknown. In a
    // queue of fifty cards the banner alone is not enough -- an operator
    // scrolling past has to be stopped by the card, not find the banner once
    // they have already opened it.
    <Card className={unknownExecutions.length > 0 ? "ring-2 ring-danger-fg" : undefined}>
      {/* ABOVE EVERYTHING, including the header. This is the one thing on
          this screen that means a card may or may not be spendable at Nuvion
          right now; it does not sit below a preview, and it is not a pill. */}
      {unknownExecutions.length > 0 ? (
        <div className="space-y-3 px-4">
          {unknownExecutions.map((ex) => (
            <UnknownExecutionBanner
              key={ex.execution_id}
              execution={ex}
              actionLabel={actionLabel(request.action_type)}
              targetRef={request.target_ref}
              onResolved={loadDetail}
            />
          ))}
        </div>
      ) : null}

      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{actionLabel(request.action_type)}</CardTitle>
          <div className="mt-1 text-sm text-text-muted">
            {targetIsMerchant ? (
              <Link href={`/daraja/merchants/${request.target_ref}`} className="underline">
                {request.target_ref}
              </Link>
            ) : (
              <span className="font-mono text-xs select-all">{request.target_ref}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge variant={STATE_VARIANT[request.state]}>{request.state}</StatusBadge>
          {isPending ? <Countdown expiresAt={request.expires_at} expired={expired} /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs text-text-muted">Requested by</div>
            <div>{request.requested_by}</div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Requested at</div>
            <div>{formatDateTime(request.requested_at)}</div>
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Reason</div>
          <div>{request.reason || "—"}</div>
        </div>

        {Object.keys(request.preview).length > 0 ? (
          <div>
            <div className="mb-1 text-xs text-text-muted">Preview</div>
            <PreviewValue k="preview" value={request.preview} />
          </div>
        ) : null}

        {request.state !== "pending" ? (
          <div className="text-xs text-text-muted">
            Decided {request.decided_at ? formatDateTime(request.decided_at) : "—"}
            {request.approved_by ? ` by ${request.approved_by}` : ""}
          </div>
        ) : null}

        {/* `?? []` rather than trusting the type: this field arrived with the
            two-phase execute work, and a console deployed ahead of the
            backend would otherwise crash the whole queue on `.length` of
            undefined. An older backend simply shows no rail section. */}
        {detail ? <ExecutionList executions={detail.executions ?? []} /> : null}

        {detailError ? (
          <p className="text-xs text-danger-fg">
            {detailError}
            {wantsDetail
              ? " Nothing below says what happened at the rail, and an"
                + " unresolved unknown would not be shown — retry before"
                + " assuming there is none."
              : ""}
          </p>
        ) : null}

        {isPending && stale && detail ? (
          <div className="rounded-card border border-warning-fg/40 bg-warning-bg/40 p-3">
            <p className="mb-1 text-xs font-semibold text-warning-fg">
              The facts changed since this was requested:
            </p>
            <dl className="space-y-1">
              {Object.entries(detail.diff).map(([field, [was, is]]) => (
                <div key={field} className="text-xs">
                  <span className="font-medium">{field.replace(/_/g, " ")}</span>:{" "}
                  {String(was ?? "—")} <span className="text-text-faint">→</span>{" "}
                  {String(is ?? "—")}
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {actionError ? <p className="text-xs text-danger-fg">{actionError}</p> : null}

        {isPending ? (
          <div className="flex items-center gap-2 pt-1">
            <div title={approveDisabledReason ?? undefined}>
              <Button size="sm" disabled={approveDisabled} onClick={() => setApproveOpen(true)}>
                Approve
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setRefuseOpen(true)}>
              Refuse
            </Button>
            {approveDisabledReason ? (
              <span className="text-xs text-text-muted">{approveDisabledReason}</span>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <DangerousActionModal
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={`Approve: ${actionLabel(request.action_type)}`}
        impact={
          <>
            This executes the action against {request.target_ref} immediately
            on confirm -- there is no further review after this. Requested by{" "}
            {request.requested_by}, reason: “{request.reason}”.
          </>
        }
        confirmLabel="Approve and execute"
        requireReason={false}
        onConfirm={handleApprove}
      />
      <DangerousActionModal
        open={refuseOpen}
        onOpenChange={setRefuseOpen}
        title={`Refuse: ${actionLabel(request.action_type)}`}
        impact={<>The request is closed with no action taken against {request.target_ref}.</>}
        confirmLabel="Refuse"
        requireReason
        onConfirm={handleRefuse}
      />
    </Card>
  );
}
