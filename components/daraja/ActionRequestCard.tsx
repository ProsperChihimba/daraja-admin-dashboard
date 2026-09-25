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
import { formatOpsMoney, formatOpsMoneyAs } from "@/lib/darajaMoney";
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
  // Named for what they DO to a merchant's money, not for the rail. "Reverse"
  // alone reads as an undo; these hand shillings back on the strength of a
  // human's word that a provider holds no payment.
  if (actionType === "lipa.reverse") return "Return a Lipa Namba payment's shillings";
  if (actionType === "cardtopup.reverse") return "Return a card top-up's shillings";
  return actionType.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Money keys this system's previews actually use today -- see
 * dashboard/actions/employer.py's approve_preview (`wallet.opens_at`),
 * dashboard/actions/reversals.py (`returning`/`returned`, the figure the
 * merchant gets back) and types/daraja.ts's MerchantDetail
 * (`monthly_cap_tzs`). Anything else is plain data, not money, and is never
 * pushed through a money formatter.
 *
 * `delta` is DELIBERATELY ABSENT. The reversal previews spell a leg's delta
 * with an explicit sign ("+1000.00"), which is not the decimal text
 * lib/darajaMoney.ts accepts -- pushed through it, a real amount would render
 * as the em dash that means "could not be read". Shown as the string the
 * backend wrote instead, which already says what it means. */
const MONEY_KEY =
  /(^|_)(amount|balance|opens_at|cap|tzs|fee|price|returning|returned)($|_)/i;

/** USD, NOT TZS. `cardtopup.reverse`'s preview and outcome both carry
 * `usd_amount` -- the dollars Nuvion was asked to deliver -- and it matches
 * MONEY_KEY. Pushed through `formatOpsMoney` it would print "TZS 50.00" beside
 * a merchant's shillings: the two-order-of-magnitude misread lib/darajaMoney.ts
 * keeps `formatOpsMoneyAs` separate to prevent. Tested first, for that reason. */
const USD_KEY = /(^|_)usd($|_)/i;

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
  if (typeof value === "string" && USD_KEY.test(k)) {
    return <>{formatOpsMoneyAs("USD", value)}</>;
  }
  if (typeof value === "string" && MONEY_KEY.test(k)) {
    return <>{formatOpsMoney(value)}</>;
  }
  return <>{String(value)}</>;
}

/**
 * A boolean the backend actually set, read off an untyped bag.
 *
 * `preview` and `outcome` are `Record<string, unknown>` -- whatever the
 * handler put there -- so a strict `=== true` is the only honest test: a
 * missing key, a string "false", or a backend deployed before these flags
 * existed must all read as "no flag", never as truthy.
 */
function flagged(bag: Record<string, unknown> | undefined, key: string): boolean {
  return bag?.[key] === true;
}

/** A string the backend actually sent, or null. Never `String(undefined)`. */
function textOf(bag: Record<string, unknown> | undefined, key: string): string | null {
  const value = bag?.[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * The attestation, verbatim, labelled as what it is.
 *
 * KEYED OFF THE BOOLEAN, NEVER THE PROSE. `evidence_is_an_unverifiable_claim`
 * is on the preview precisely so a console can render the claim differently
 * without pattern-matching warning text that will be reworded
 * (dashboard/actions/reversals.py says so in as many words). Nothing here
 * greps the warnings.
 *
 * WHY IT IS ALSO SHOWN SEPARATELY WHEN THE PREVIEW ALREADY CARRIES IT. The
 * generic preview dump below renders every key the handler sent, `evidence`
 * included, as one row among fifteen. This is not one row among fifteen: it is
 * the only thing standing behind returning a merchant's money, and nothing in
 * this system can check it. The dump is not replaced or filtered -- both are
 * rendered, so no warning can be lost by a hand-picked subset going stale.
 */
function UnverifiableClaim({ evidence }: { evidence: string | null }) {
  return (
    <div className="rounded-card border-2 border-danger-fg bg-danger-bg/40 p-3">
      <p className="text-sm font-semibold text-danger-fg">
        This is a person&rsquo;s claim. This system cannot verify it.
      </p>
      <p className="mt-1 text-xs text-text">
        Nothing on our side can prove the provider holds no payment for this id
        &mdash; a timeout is exactly the case where it may have paid. Approving
        accepts the requester&rsquo;s word for what they saw. Read it, and if it
        does not say what was searched, where and when, refuse it.
      </p>
      {evidence ? (
        <blockquote className="mt-2 border-l-4 border-danger-fg pl-3 text-sm whitespace-pre-wrap text-text select-all">
          {evidence}
        </blockquote>
      ) : (
        <p className="mt-2 text-sm font-semibold text-danger-fg">
          The request carries no statement to read. Refuse it.
        </p>
      )}
    </div>
  );
}

/**
 * What is STILL NOT DONE, after the money has already moved.
 *
 * `cardtopup.reverse` deliberately does not close the top-up: CardTopUp has no
 * reversed state and FAILED is the saga's promise that nothing ever left the
 * merchant's wallet, which stops being true the moment the reversal runs. The
 * shell command PRINTS the `reconcile_topup` follow-up; a dashboard user has
 * no terminal to read that in, so the handler carries it in the outcome and
 * this renders it at the top of the card, red, with the command selectable.
 * Until it runs the row is not closed and any cards the top-up froze stay
 * frozen.
 */
function FollowUpBanner({ nextStep }: { nextStep: string | null }) {
  return (
    <div className="rounded-card border-2 border-warning-fg bg-warning-bg/50 p-4">
      <p className="text-sm font-semibold text-warning-fg">
        The money moved. This is not finished.
      </p>
      <p className="mt-2 text-sm whitespace-pre-wrap text-text select-all">
        {nextStep
          ?? "This action left a required follow-up behind and did not say "
            + "which. Do not treat this row as closed -- check "
            + "dashboard/actions/reversals.py before walking away."}
      </p>
    </div>
  );
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

  // The two destructive actions' own flags, read off the untyped bags rather
  // than off `action_type`: any future handler that says its evidence cannot
  // be verified gets the same treatment without this file learning its name.
  const unverifiable = flagged(request.preview, "evidence_is_an_unverifiable_claim");
  const evidence = textOf(request.preview, "evidence");
  // The PREVIEW's follow-up warns the approver before they click; the
  // OUTCOME's is the one that matters, because by then the shillings have
  // moved and the row is still open.
  const previewFollowUp = flagged(request.preview, "follow_up_required")
    ? textOf(request.preview, "next_step")
    : null;
  const outcomeFollowUp = flagged(request.outcome, "follow_up_required");

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
    <Card
      className={
        unknownExecutions.length > 0
          ? "ring-2 ring-danger-fg"
          : outcomeFollowUp
            ? "ring-2 ring-warning-fg"
            : undefined
      }
    >
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

      {/* Also above the header, and for the same reason: the shillings have
          already gone back, the row is NOT closed, and this is the only place
          a dashboard user can be told so -- the shell prints it to a terminal
          nobody here is looking at. The ring turns the whole card amber so it
          is not scrolled past in a queue of fifty. */}
      {outcomeFollowUp ? (
        <div className="px-4">
          <FollowUpBanner nextStep={textOf(request.outcome, "next_step")} />
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
        {/* FIRST in the body, above the requester and the reason. On these two
            actions the requester's statement IS the case for returning the
            money; everything else on the card is context for it. */}
        {unverifiable ? <UnverifiableClaim evidence={evidence} /> : null}

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
          <div className="flex flex-col gap-3">
            {/* The statement again, in the last dialog before the money moves.
                The card behind this one is scrollable and this is not: an
                approver who never read the attestation cannot get past here
                without it in front of them. */}
            {unverifiable ? <UnverifiableClaim evidence={evidence} /> : null}
            {previewFollowUp ? (
              <div className="rounded-card border border-warning-fg/60 bg-warning-bg/40 p-3">
                <p className="text-xs font-semibold text-warning-fg">
                  This does not finish the job:
                </p>
                <p className="mt-1 text-xs whitespace-pre-wrap text-text select-all">
                  {previewFollowUp}
                </p>
              </div>
            ) : null}
            <p>
              This executes the action against {request.target_ref} immediately
              on confirm -- there is no further review after this. Requested by{" "}
              {request.requested_by}, reason: “{request.reason}”.
            </p>
          </div>
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
