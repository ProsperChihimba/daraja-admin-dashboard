// Shared KYC status presentation for the Daraja ops screens.
//
// These two helpers were copied verbatim into three files (the roster, the
// merchant detail page and KycTab) -- two of those copies added in a single
// commit. Display-only, so divergence is cosmetic rather than a money risk,
// but three copies of "what does this status look like" is three places to
// forget when Employer.KYC_STATUSES gains a value (whole-branch review, M2).
import type { StatusVariant } from "@/components/ui/status_badge";

/**
 * Employer.kyc_status is NULL on historical rows even though the roster's
 * MerchantRow types it as a plain string (employer/models.py:65 --
 * `null=True`). Both helpers therefore take the WIDER type on purpose: an
 * unset status is "Unknown" and neutral, never the literal string "null" and
 * never a false "warning" that reads as a merchant awaiting review.
 */
export const kycVariant = (s: string | null | undefined): StatusVariant =>
  s === "approved" ? "success" : s === "rejected" ? "danger" : s ? "warning" : "neutral";

export const kycLabel = (s: string | null | undefined): string => {
  if (!s) return "Unknown";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};
