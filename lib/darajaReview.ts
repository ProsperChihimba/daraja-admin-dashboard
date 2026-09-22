// Sole-prop auto-approval review -- the endpoints under
// /dashboard/employers/auto-approved/ and /dashboard/employers/<id>/mark-sampled/
// (dashboard/views/employers.py::AutoApproved, MarkSampled).
//
// Sole-prop signup approves with no reviewer, by product decision, and writes
// an `employer.auto_approve` audit row. A merchant stays on this list until a
// reviewer or admin marks it sampled; "sampled" is that audit row, not a
// column. Marking sampled changes nothing about the merchant -- one found
// wanting is suspended through the dual-approval flow like any other.
import darajaApi from "@/lib/darajaApi";
import type { Paginated } from "@/types/daraja";

export type AutoApprovedRow = {
  employer_id: string;
  business_name: string | null;
  phone_number: string | null;
  active: boolean | null;
  kyc_status: string | null;
  owner_nida_present: boolean | null;
  auto_approved_at: string;
  audit_id: string;
};

export type SampledResult = {
  employer_id: string;
  sampled_by: string;
  sampled_at: string;
  note: string;
};

export const AUTO_APPROVED_PATH = "/employers/auto-approved/";

/** POST /dashboard/employers/<id>/mark-sampled/ -- idempotent; needs a note. */
export async function markSampled(
  employerId: string,
  note: string,
): Promise<SampledResult> {
  const { data } = await darajaApi.post<SampledResult>(
    `/employers/${employerId}/mark-sampled/`,
    { note },
  );
  return data;
}

export type { Paginated };
