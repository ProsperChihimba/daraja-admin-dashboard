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
   * NOT ACTUALLY SENT BY THE BACKEND TODAY. Approving requires an
   * `Idempotency-Key` header equal to the row's own `idempotency_key`
   * (ApproveActionRequest.post, dashboard/views/actions.py:219) -- but
   * `idempotency_key` is on the OpsActionRequest model (dashboard/models.py:159)
   * and is NOT one of ActionRequestSerializer's Meta.fields
   * (dashboard/serializers/actions.py), and neither the create view nor the
   * detail view (ActionRequestDetail.get) adds it to the response body it
   * builds. Confirmed against the test suite too:
   * tests/test_dashboard_action_requests.py and
   * tests/test_dashboard_action_approval.py reach the key only via
   * `row.idempotency_key` on the Python object, in-process -- never through
   * `response.data`. So this field is typed optional, and as of this
   * commit it is always `undefined` at runtime. `ActionRequestCard` is
   * built to use it if a future backend change starts sending it, and
   * disables Approve with an explicit reason whenever it is absent --
   * rather than sending a header this screen cannot actually get right,
   * which would either 409 every time or, worse, silently approve the
   * wrong thing if some other value were guessed at. See task-10-report.md.
   */
  idempotency_key?: string;
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
  return body?.error?.message ?? (e instanceof Error ? e.message : fallback);
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
 * `idempotencyKey` MUST be the row's own `idempotency_key` (see
 * `ActionRequestDetail.idempotency_key` above for why that is often not
 * obtainable today); a caller with no key should not call this at all.
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

/** GET /dashboard/actions/catalogue/ -- what this user may request. */
export async function getActionCatalogue(): Promise<ActionCatalogueEntry[]> {
  const { data } = await darajaApi.get<ActionCatalogueEntry[]>(
    "/actions/catalogue/",
  );
  return data;
}
