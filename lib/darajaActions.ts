// lib/darajaActions.ts -- typed client for the six money-action endpoints
// under /dashboard/actions/ (dashboard/views/actions.py, dashboard/urls.py).
//
// Uses `darajaApi` (lib/darajaApi.ts), the Daraja ops axios instance --
// NEVER lib/axiosInstance.ts. That instance points at a different service
// with its own token store and its own `RequireAuth` guard, which gates on
// an Ankara superuser Redux session a Daraja ops account does not have
// (create_ops_user never touches Ankara's auth at all). Using it here would
// bounce every ops account that opens this screen to the wrong login.
import darajaApi from "@/lib/darajaApi";
import type { Paginated } from "@/types/daraja";

export type ActionState = "pending" | "executed" | "refused" | "expired" | "failed";

/**
 * What the rail did, as the execution row itself records it
 * (`ActionExecutionSerializer`, dashboard/serializers/actions.py).
 *
 * `unknown` IS NOT A STATUS LIKE THE OTHERS. It is written when the provider
 * gave no usable answer at all -- a timeout, a 429, a 401 -- so nobody knows
 * whether the card was actually frozen at Nuvion. It is deliberately NOT
 * `failed`: recording "this did not happen" when it may well have is the more
 * expensive mistake (dashboard/actions/cards.py `_call_provider`). Nothing in
 * the system closes an `unknown`; the only exit is a human who has looked at
 * the provider's own dashboard calling `resolveActionExecution`. Anything
 * rendering this type must therefore give `unknown` its own treatment, never
 * another coloured pill in a row of coloured pills.
 */
export type ActionExecutionState =
  | "intended"
  | "started"
  | "failed"
  | "unknown"
  | "resolved";

/**
 * The rail's own current opinion, added alongside the stored row by the detail
 * view (`_live_state`, dashboard/views/actions.py).
 *
 * `state` is NOT a closed set and is not typed as one: for a card action it is
 * whatever `Card.status` holds ("frozen", "active", …), plus this layer's own
 * two answers -- `card_gone` when the card row has since been deleted, and
 * `unreadable` when `read_state()` raised or the action has been de-registered
 * since the execution was recorded. `unreadable` is the one value a caller must
 * branch on: it means the live column below is not an answer, and `detail`
 * carries the exception's own words explaining why.
 */
export type ActionExecutionLiveState = {
  state: string;
  detail: string;
};

/**
 * Exactly `ActionExecutionSerializer.Meta.fields` and nothing more -- the
 * stored row, with NO live rail read folded in. That serializer is
 * deliberately free of provider round trips, so this is also the shape the
 * resolve endpoint hands back on its own.
 */
export type ActionExecutionRow = {
  execution_id: string;
  rail: string;
  state: ActionExecutionState;
  handle: string | null;
  provider_reference: string | null;
  /** The provider's own words, truncated by the writer and never paraphrased.
   * Render it verbatim and selectable: an operator pastes this into a support
   * ticket. */
  error: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

/** The stored row plus the rail's own current answer, which ONLY the request
 * detail view attaches (`_executions_with_live_state`). */
export type ActionExecution = ActionExecutionRow & {
  live_state: ActionExecutionLiveState;
};

/** One row of `OpsActionRequestSerializer` -- what the list and create
 * endpoints return. */
export type ActionRequest = {
  request_id: string;
  action_type: string;
  risk_class: string;
  target_ref: string;
  params: Record<string, unknown>;
  preview: Record<string, unknown>;
  reason: string;
  requested_by: string;
  requested_at: string;
  expires_at: string;
  state: ActionState;
  approved_by: string | null;
  decided_at: string | null;
  outcome: Record<string, unknown>;
  expired: boolean;
  /**
   * How many of this row's executions are in `unknown` and still open --
   * annotated on the queue queryset as one COUNT for the whole page
   * (dashboard/views/actions.py, ActionRequests.get). `resolved` does not
   * count, so the badge clears the moment a human closes the question.
   *
   * It exists so the queue can tell which rows are worth opening WITHOUT
   * fetching each one's detail. Optional on the type because the single-row
   * create/detail responses use the fuller serializer, which has no reason
   * to carry it.
   */
  unknown_executions?: number;
};

/**
 * The detail endpoint's own shape: the same row plus a live staleness diff,
 * recomputed against the world as it is right now (dashboard/views/actions.py
 * `diff_against`). `diff` and `stale` are only ever non-empty/true for a
 * still-PENDING row -- a terminal request always reports `{}`/`false`.
 */
export type ActionRequestDetail = ActionRequest & {
  diff: Record<string, [unknown, unknown]>;
  stale: boolean;
  /**
   * SENT BY THE BACKEND ON EVERY DETAIL RESPONSE. Approving requires an
   * `Idempotency-Key` header equal to the row's own `idempotency_key`
   * (ApproveActionRequest.post, dashboard/views/actions.py), and
   * `idempotency_key` is one of `ActionRequestSerializer.Meta.fields`
   * (dashboard/serializers/actions.py:44) -- so the single-row shape that
   * create, detail, approve and refuse all return carries it. Only the QUEUE
   * strips it: `ActionRequestListSerializer` removes the field rather than
   * handing out every pending row's concurrency token to someone who is just
   * scanning the page. Approving from the browser works; it was done against
   * production on 2026-09-24.
   *
   * (An earlier revision of this comment claimed the field was never
   * serialized anywhere and was "always `undefined` at runtime". That was
   * true of the backend as it stood then and is not true now.)
   *
   * STILL TYPED OPTIONAL, AND THE GUARD IN `ActionRequestCard` STAYS. The
   * field is absent from every list row by design, so any code holding an
   * `ActionRequest` rather than a detail genuinely does not have it, and a
   * detail request that failed leaves the card with no detail at all.
   * Disabling Approve with an explicit reason when the key is missing is
   * still the honest behaviour -- sending a guessed header would either 409
   * every time or, worse, approve the wrong thing silently.
   */
  idempotency_key?: string;
  /**
   * Every `ActionExecution` recorded for this request, NEWEST FIRST.
   *
   * Empty for a ledger-only action (`employer.approve`, `treasury.*`): those
   * have no rail, so no execution row is ever written and this is `[]`, not a
   * missing key. It is also the ONLY place an operator learns whether the rail
   * did anything, because `state` on the request itself reads `executed` the
   * moment the intent commits -- before the provider has even been called.
   */
  executions: ActionExecution[];
};

export type ActionCatalogueEntry = {
  action_type: string;
  risk: string;
  may_request: boolean;
};

export type CreateActionRequestInput = {
  action_type: string;
  target_ref: string;
  params?: Record<string, unknown>;
  reason: string;
};

type OpsErrorEnvelope = {
  error?: { code?: string; message?: string; fields?: Record<string, unknown> };
};

/**
 * Undoes one leaky corner of the backend's error envelope.
 *
 * A handler that refuses a request raises a bare `ValueError`, which
 * `ActionRequests.post` converts with `ValidationError({"detail": str(exc)})`.
 * DRF normalises that to `{"detail": [ErrorDetail("…", code="invalid")]}`, and
 * `dashboard_exception_handler` takes the `"detail" in detail` branch and sets
 * `message = str(detail["detail"])` -- `str()` of a LIST, which renders Python
 * reprs. So the reason a reversal was refused arrives on the wire as
 * `[ErrorDetail(string='payment X was touched 2 minutes ago …', code='invalid')]`.
 *
 * That message is the whole point of the refusal: it names the recovery
 * command, or says how much longer to wait. Printing a Python repr at an
 * operator is how a clear instruction gets read as a crash. This pulls the
 * sentence back out and leaves anything that does not match untouched -- the
 * envelope is not "fixed" here by guessing at shapes, only this one exact
 * spelling is unwrapped.
 */
function unwrapErrorDetailRepr(message: string): string {
  const parts = [...message.matchAll(/ErrorDetail\(string='((?:[^'\\]|\\.)*)'/g)]
    .map((m) => m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\"));
  return parts.length > 0 ? parts.join(" ") : message;
}

/**
 * Pulls a human message out of this app's error envelope --
 * `{"error": {"code", "message", "fields"}}`, NOT `{"message": ...}` (that is
 * the mobile API's convention, asserted against this one by
 * tests/test_dashboard_conventions.py). A 409 from a stale, expired or
 * already-decided request carries its explanation in `error.message`.
 */
export function extractOpsErrorMessage(
  e: unknown,
  fallback = "Something went wrong.",
): string {
  const body = (e as { response?: { data?: OpsErrorEnvelope } })?.response?.data;
  const message = body?.error?.message;
  if (typeof message === "string") return unwrapErrorDetailRepr(message);
  return e instanceof Error ? e.message : fallback;
}

/**
 * The per-field complaint for one input, or null.
 *
 * A DRF `ValidationError({"note": "..."})` reaches the client as
 * `error.fields.note` (dashboard/api.py's handler puts the whole serializer
 * dict in `fields` and sets `message` to the useless literal "Invalid
 * request"), and DRF normalises the value to a LIST of ErrorDetail strings --
 * but a hand-built dict can still carry a bare string, so both are read. This
 * is what lets a 400 point at the input the operator left empty instead of
 * printing "Invalid request" somewhere they are not looking.
 */
export function extractOpsFieldError(e: unknown, field: string): string | null {
  const body = (e as { response?: { data?: OpsErrorEnvelope } })?.response?.data;
  const value = body?.error?.fields?.[field];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    return value.map((v) => String(v)).join(" ");
  }
  return null;
}

/** GET /dashboard/actions/requests/ -- the queue, pending first, paginated. */
export async function listActionRequests(params?: {
  page?: number;
  page_size?: number;
}): Promise<Paginated<ActionRequest>> {
  const { data } = await darajaApi.get<Paginated<ActionRequest>>(
    "/actions/requests/",
    { params },
  );
  return data;
}

/** POST /dashboard/actions/requests/ -- create a request. Does NOT execute. */
export async function createActionRequest(
  input: CreateActionRequestInput,
): Promise<ActionRequest> {
  const { data } = await darajaApi.post<ActionRequest>(
    "/actions/requests/",
    input,
  );
  return data;
}

/** GET /dashboard/actions/requests/<id>/ -- detail + live staleness diff. */
export async function getActionRequestDetail(
  requestId: string,
): Promise<ActionRequestDetail> {
  const { data } = await darajaApi.get<ActionRequestDetail>(
    `/actions/requests/${requestId}/`,
  );
  return data;
}

/**
 * POST /dashboard/actions/requests/<id>/approve/ -- the second pair of eyes.
 * `idempotencyKey` MUST be the row's own `idempotency_key`, which arrives on
 * the DETAIL response (`getActionRequestDetail`) and never on a queue row --
 * see `ActionRequestDetail.idempotency_key`. A caller with no key should not
 * call this at all rather than guess a header.
 */
export async function approveActionRequest(
  requestId: string,
  idempotencyKey: string,
): Promise<ActionRequest> {
  const { data } = await darajaApi.post<ActionRequest>(
    `/actions/requests/${requestId}/approve/`,
    {},
    { headers: { "Idempotency-Key": idempotencyKey } },
  );
  return data;
}

/** POST /dashboard/actions/requests/<id>/refuse/ -- the other decision. */
export async function refuseActionRequest(
  requestId: string,
  reason: string,
): Promise<ActionRequest> {
  const { data } = await darajaApi.post<ActionRequest>(
    `/actions/requests/${requestId}/refuse/`,
    { reason },
  );
  return data;
}

/**
 * POST /dashboard/actions/executions/<execution_id>/resolve/ -- a human
 * closes an `unknown` with a note saying what they saw.
 *
 * THE NOTE IS THE WHOLE POINT and the backend requires it non-blank: an
 * unknown closed without one is a shrug with an audit row attached
 * (ResolveActionExecution, dashboard/views/actions.py). The only evidence
 * there can be is what a person read on the provider's own dashboard.
 *
 * This does NOT re-act at the rail and does not re-open the request -- it
 * records a judgement about what already happened. A fresh attempt is a NEW
 * request, filed and approved by two people afresh.
 *
 * Failure modes a caller must surface rather than swallow:
 *   409 the execution is not (or is no longer) `unknown` -- a second admin
 *       reading the same queue may have closed it a moment ago;
 *   400 `error.fields.note`, the note was missing or blank;
 *   403 ops.admin only, deliberately narrower than the ops.finance who may
 *       REQUEST a money action -- this closes a money question.
 *
 * Resolves to an `ActionExecutionRow`, NOT an `ActionExecution`: the view
 * returns the bare serializer and there is no `live_state` on it. A caller
 * that needs the rail's opinion back must re-read the request detail, which
 * is what a caller should do anyway -- the point of resolving is to make a
 * blocking banner go away, and only the detail response can say it has.
 */
export async function resolveActionExecution(
  executionId: string,
  note: string,
): Promise<ActionExecutionRow> {
  const { data } = await darajaApi.post<ActionExecutionRow>(
    `/actions/executions/${executionId}/resolve/`,
    { note },
  );
  return data;
}

/** GET /dashboard/actions/catalogue/ -- what this user may request. */
export async function getActionCatalogue(): Promise<ActionCatalogueEntry[]> {
  const { data } = await darajaApi.get<ActionCatalogueEntry[]>(
    "/actions/catalogue/",
  );
  return data;
}
