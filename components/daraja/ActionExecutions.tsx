// components/daraja/ActionExecutions.tsx -- what the RAIL did, for one
// approved action request, and the one form that can close an `unknown`.
//
// Split out of ActionRequestCard rather than added to it: that file is the
// approval control and is already long, and this is a different question
// entirely. `state` on the request answers "was this approved"; it reads
// `executed` the instant the intent row commits, BEFORE the provider has been
// called at all. Only the execution rows below answer "did anything actually
// happen at Nuvion".
//
// WHY `unknown` DOES NOT GET A BADGE. Every other execution state is a fact:
// `failed` means the provider said no, `started` means it said yes, `resolved`
// means a human has since written down what they saw. `unknown` is the absence
// of a fact -- the provider gave no usable answer, so a card may or may not be
// spendable at Nuvion right now and nothing in this system knows which
// (dashboard/actions/cards.py `_call_provider`). Rendered as one more coloured
// pill in a row of coloured pills it gets scanned past, which is precisely the
// failure it exists to prevent. So it renders as a blocking banner above
// everything else on the card, in the operator's own words, carrying the only
// control that can clear it. Nothing automatic ever will: a reconciler reading
// the same silent provider knows no more than the original caller did.
"use client";
import * as React from "react";
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import {
  type ActionExecution,
  type ActionExecutionState,
  extractOpsErrorMessage,
  extractOpsFieldError,
  resolveActionExecution,
} from "@/lib/darajaActions";

/** `unknown` is absent on purpose -- it never renders as a badge. See the
 * header comment; `ExecutionStateLabel` below enforces it. */
const EXECUTION_STATE_VARIANT: Record<
  Exclude<ActionExecutionState, "unknown">,
  StatusVariant
> = {
  intended: "neutral",
  started: "success",
  failed: "danger",
  resolved: "neutral",
};

/** One line of plain English per state, because the stored word alone does
 * not tell an operator what it means for the money. */
const EXECUTION_STATE_MEANING: Record<ActionExecutionState, string> = {
  intended: "recorded, but the provider has not been called yet",
  started: "the provider accepted it",
  failed: "the provider answered, and the answer was no — nothing changed",
  unknown: "the provider gave no usable answer — nobody knows what happened",
  resolved: "a human closed this after checking the provider themselves",
};

function ExecutionStateLabel({ state }: { state: ActionExecutionState }) {
  if (state === "unknown") {
    // Deliberately not a StatusBadge. The banner above is the real signal;
    // this points at it rather than competing with it.
    return (
      <span className="text-xs font-semibold tracking-tight text-danger-fg uppercase">
        unknown — see above
      </span>
    );
  }
  return (
    <StatusBadge variant={EXECUTION_STATE_VARIANT[state]}>{state}</StatusBadge>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      {/* `||`, matching the merchant profile fields: `handle` and
          `provider_reference` are both nullable AND blankable on the model,
          and an empty string is live data that `??` would render as a blank
          cell reading like a broken screen. */}
      <div className="text-text">{value || "—"}</div>
    </div>
  );
}

/**
 * The rail's own current answer, or a visibly degraded row saying it could
 * not be obtained.
 *
 * `unreadable` is NOT a state of the card -- it is this layer failing to read
 * one (a `read_state()` that raised, or an action de-registered since the
 * execution was recorded). Rendered like an ordinary state it would assert
 * something about a card that nobody has actually looked at, so it gets the
 * struck-through, dashed, warning treatment and always shows the exception's
 * own words in `detail`.
 */
function LiveState({ execution }: { execution: ActionExecution }) {
  const live = execution.live_state;
  const unreadable = live.state === "unreadable";
  const gone = live.state === "card_gone";

  if (unreadable || gone) {
    return (
      <div className="rounded-card border border-dashed border-warning-fg/50 bg-warning-bg/20 p-2.5">
        <div className="text-xs font-semibold text-warning-fg">
          {unreadable
            ? "Could not read the current state at all"
            : "The card this acted on no longer exists"}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {unreadable
            ? "This is not the card's state — it is this screen failing to "
              + "obtain one. Treat the card's status below as unknown and "
              + "check the provider directly."
            : "Nothing below describes a live card."}
        </p>
        <p className="mt-1 font-mono text-xs break-words text-text">{live.detail}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-text-muted">The card now reads</div>
      <div className="text-text">{live.state}</div>
      <p className="mt-0.5 text-xs text-text-muted break-words">{live.detail}</p>
    </div>
  );
}

/**
 * The blocking banner. One per `unknown` execution, rendered above the request
 * detail rather than inside the execution list.
 *
 * The note is REQUIRED by the backend and required here, and the submit stays
 * disabled while it is blank rather than letting the operator discover that
 * from a 400. What it asks for is specific -- what you saw on the provider's
 * dashboard -- because a note saying "resolved" records nothing and this row
 * is the only account there will ever be of what happened.
 */
export function UnknownExecutionBanner({
  execution,
  actionLabel,
  targetRef,
  onResolved,
}: {
  execution: ActionExecution;
  actionLabel: string;
  targetRef: string;
  onResolved: () => void | Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const blank = note.trim() === "";

  async function submit() {
    setSubmitting(true);
    setNoteError(null);
    setFormError(null);
    try {
      await resolveActionExecution(execution.execution_id, note.trim());
      setNote("");
      // The banner is cleared by the refreshed detail, never by local state:
      // the only proof this execution left `unknown` is the backend saying
      // so, and a second admin may have closed it from the same queue a
      // moment before us (the write is conditioned on `state='unknown'`).
      await onResolved();
    } catch (e) {
      // A 400 carries `error.fields.note` and its `message` is the useless
      // literal "Invalid request" -- so it is attached to the input rather
      // than printed where nobody is looking. A 409 (not an unknown any
      // more) and a 403 (ops.admin only) both explain themselves in
      // `error.message`.
      const field = extractOpsFieldError(e, "note");
      if (field) setNoteError(field);
      else {
        setFormError(
          extractOpsErrorMessage(e, "Could not resolve this execution."),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-card border-2 border-danger-fg bg-danger-bg/50 p-4">
      <p className="text-sm font-semibold text-danger-fg">
        Nobody knows whether this happened.
      </p>
      <p className="mt-2 text-sm text-text">
        “{actionLabel}” on <span className="font-mono">{targetRef}</span> was
        sent to <span className="font-mono">{execution.rail}</span>, and{" "}
        {execution.rail} gave no usable answer. It may have been applied. It
        may not. Nothing in this system can find out, and nothing will close
        this on its own — no retry, no reconciler, no timeout.
      </p>
      <p className="mt-2 text-sm text-text">
        <span className="font-semibold">Go and look at {execution.rail}’s own
        dashboard</span>
        {execution.handle ? (
          <>
            {" "}
            (it knows this card as{" "}
            <span className="font-mono select-all">{execution.handle}</span>)
          </>
        ) : null}
        , read what the card’s state actually is there, and write down below
        what you saw. That note is the whole record of this.
      </p>

      {execution.error ? (
        <div className="mt-3">
          <div className="text-xs font-semibold text-danger-fg">
            What {execution.rail} said, verbatim
          </div>
          {/* select-all: this gets pasted into a support ticket. Never
              paraphrased, never truncated further than the writer already
              truncated it. */}
          <pre className="mt-1 overflow-x-auto rounded-card border border-danger-fg/40 bg-surface p-2.5 font-mono text-xs break-words whitespace-pre-wrap select-all text-text">
            {execution.error}
          </pre>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-text-muted">
        Resolving records what you saw. It does NOT retry, and it does not
        re-open this request — a fresh attempt is a new request, filed and
        approved by two people afresh.
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor={`resolve-note-${execution.execution_id}`}>
          What you saw on {execution.rail}
        </Label>
        <Textarea
          id={`resolve-note-${execution.execution_id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Nuvion shows this card frozen, hold placed 14:07, reference ABC123."
          disabled={submitting}
          aria-invalid={noteError ? true : undefined}
          className="bg-surface"
        />
        {noteError ? <p className="text-xs text-danger-fg">{noteError}</p> : null}
      </div>

      {formError ? (
        <p className="mt-2 text-xs text-danger-fg">{formError}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={submitting || blank}>
          {submitting ? "Recording…" : "Record what I saw and close this"}
        </Button>
        {blank ? (
          <span className="text-xs text-text-muted">
            A note is required — this is the only account of what happened.
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** One execution row: what was attempted at the rail, what the rail said, and
 * what the rail reads as now. */
function ExecutionRow({ execution }: { execution: ActionExecution }) {
  return (
    <div className="rounded-card border border-border-soft bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ExecutionStateLabel state={execution.state} />
          <span className="text-xs text-text-muted">
            {EXECUTION_STATE_MEANING[execution.state]}
          </span>
        </div>
        <span className="font-mono text-xs text-text-faint">
          {execution.rail}
        </span>
      </div>

      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <Field
          label="Rail handle"
          value={
            execution.handle ? (
              <span className="font-mono text-xs select-all">{execution.handle}</span>
            ) : null
          }
        />
        <Field
          label="Provider reference"
          value={
            execution.provider_reference ? (
              <span className="font-mono text-xs select-all">
                {execution.provider_reference}
              </span>
            ) : null
          }
        />
        <Field label="Attempted" value={formatDateTime(execution.created_at)} />
        <Field label="Last changed" value={formatDateTime(execution.updated_at)} />
      </div>

      {execution.error ? (
        <div className="mt-3">
          <div className="text-xs text-text-muted">
            What the provider said, verbatim
          </div>
          <pre className="mt-1 overflow-x-auto rounded-card border border-border-soft bg-surface p-2.5 font-mono text-xs break-words whitespace-pre-wrap select-all text-text">
            {execution.error}
          </pre>
        </div>
      ) : null}

      <div className="mt-3">
        <LiveState execution={execution} />
      </div>

      {execution.state === "resolved" ? (
        <div className="mt-3 rounded-card border border-border-soft bg-surface p-2.5">
          <div className="text-xs text-text-muted">
            Closed by {execution.resolved_by || "—"}
            {execution.resolved_at
              ? ` on ${formatDateTime(execution.resolved_at)}`
              : ""}
            {" — this was an unknown, and this note is the whole record of it."}
          </div>
          <p className="mt-1 text-sm break-words text-text">
            {execution.resolution_note || "—"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Every execution recorded for one request, newest first (the backend orders
 * them; this does not re-sort).
 *
 * Renders NOTHING for a ledger-only action -- `employer.approve` and the
 * treasury actions have no rail and return `executions: []`, and an empty
 * "What happened at the rail" heading on those cards would invite an operator
 * to wonder what was missing.
 */
export function ExecutionList({ executions }: { executions: ActionExecution[] }) {
  if (executions.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs text-text-muted">
        What happened at the rail
        {executions.length > 1 ? ` (${executions.length} attempts, newest first)` : ""}
      </div>
      <div className="space-y-2">
        {executions.map((ex) => (
          <ExecutionRow key={ex.execution_id} execution={ex} />
        ))}
      </div>
    </div>
  );
}
