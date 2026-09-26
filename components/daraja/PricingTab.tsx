// components/daraja/PricingTab.tsx -- what this merchant is charged for
// dollars, why, and the two requests that change it.
//
// NOTHING HERE CHANGES A PRICE. Both buttons only ever POST
// /dashboard/actions/requests/, which per that view's own docstring "does NOT
// execute": they store a row a DIFFERENT ops.admin must approve from the
// Actions queue within the hour, or it expires and nothing happens at all.
// Same shape, and the same reason, as CardsTab's freeze buttons and the
// merchant Activate/Suspend pair.
//
// THE ONE FACT THIS SCREEN EXISTS TO STOP PEOPLE ASSUMING. A client rate does
// NOT expire and does NOT track the universal rate: once granted it is the
// price of every later top-up, expense and payout quote for that merchant
// until a human grants another one or clears it
// (dashboard/actions/pricing.py, treasury/services/rates.py). So when the
// universal rate moves up, a merchant left on an older, lower override is
// being sold dollars below the standard price, indefinitely, and nothing in
// the ordinary flow of the system says so -- which is why
// `dashboard.alerts.detectors.client_rate_below_universal` pages ops as an
// IMPORTANT alert, and why `below_universal` gets a red banner with a heading
// here rather than a coloured tint someone can scan past. The banner is also
// rendered ABOVE the tabs (see `ClientRateUnderwaterBanner`, used by the
// merchant detail page) so it is seen by someone who came to this merchant for
// an unrelated reason and never opens this tab.
//
// NO ARITHMETIC ON RATES. Every figure is text through `formatOpsMoney`: a
// rate is DecimalField(20,6) and a browser must not round it, so this screen
// shows the two numbers side by side and never computes a difference between
// them. The priced $100 comparison an approver needs is computed in Decimal by
// the action's own preview and shown on the request itself.
"use client";
import * as React from "react";
import Link from "next/link";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatDateTime } from "@/lib/format";
// `formatOpsRate` used to be a local `rateText` here. The Treasury screen now
// renders the same universal rate (its `rate.universal` comes from the same
// backend `_rate()`), so the formatter moved to lib/darajaMoney.ts rather than
// being spelled a second time -- two spellings of one number is how the two
// screens end up disagreeing. Imported under the old local name so every call
// site below reads exactly as it did.
import { formatOpsRate as rateText } from "@/lib/darajaMoney";
import {
  createActionRequest,
  extractOpsErrorMessage,
  getActionCatalogue,
  type ActionCatalogueEntry,
} from "@/lib/darajaActions";
import type { MerchantDetail, MerchantRate } from "@/types/daraja";

const SET = "pricing.set_client_rate";
const CLEAR = "pricing.clear_client_rate";

/** The sentence this whole feature turns on. One copy, used by the tab body
 *  and by the grant modal, so the two cannot drift apart. */
const NO_EXPIRY =
  "A client rate runs until a human changes it. It does not expire on its "
  + "own and it does not track the universal rate: if the universal rate "
  + "moves later, this merchant stays on this number, on every top-up, "
  + "expense and payout quote, until someone grants them another rate or "
  + "clears them back to universal.";

/**
 * The underwater flag, on its own, for the merchant detail page to render
 * ABOVE the tabs.
 *
 * Deliberately not a tint on a row inside the Pricing tab: the condition is
 * "Daraja is selling this merchant dollars below the standard price, on every
 * top-up, indefinitely", and the person who needs to notice it is usually
 * looking at this merchant for some other reason entirely.
 *
 * Renders nothing unless the backend itself said `below_universal` -- the
 * comparison is never recomputed here (see `MerchantRate.below_universal`).
 */
export function ClientRateUnderwaterBanner({
  merchant,
}: {
  merchant: MerchantDetail;
}) {
  const rate = merchant.rate as MerchantRate | undefined;
  if (!rate?.below_universal) return null;
  return (
    <Card className="mb-4 border-2 border-danger-fg">
      <CardHeader className="flex flex-row items-center gap-3">
        <StatusBadge variant="danger">BELOW UNIVERSAL</StatusBadge>
        <CardTitle className="text-danger-fg">
          This merchant is being sold dollars below the standard price
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          Their client rate is{" "}
          <span className="font-mono font-semibold">
            {rateText(rate.override?.tzs_per_usdc ?? rate.effective)}
          </span>{" "}
          while everyone else pays{" "}
          <span className="font-mono font-semibold">
            {rateText(rate.universal)}
          </span>
          . Daraja loses the difference on every top-up, expense and payout
          quote this merchant makes.
        </p>
        <p>{NO_EXPIRY}</p>
        <p className="text-text-muted">
          This is the same condition the ops alert{" "}
          <code className="font-mono">client_rate_below_universal</code> pages
          on. See the Pricing tab to read who granted it, or to request a new
          rate or a clear back to universal.
        </p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      {/* `||`, not `??`: `note` is `blank=True` on EmployerConversionRate and
          an empty string is live data, which `??` renders as a blank cell
          that reads as a broken screen. Same treatment as the merchant
          profile fields. */}
      <div className="text-text">{value || "—"}</div>
    </div>
  );
}

/** Requesting a client rate -- a grant, or a change to an existing one. */
function GrantRateModal({
  merchant,
  rate,
  open,
  onOpenChange,
  onRequested,
}: {
  merchant: MerchantDetail;
  rate: MerchantRate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: (message: string) => void;
}) {
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setValue("");
      setError(null);
    }
  }, [open]);

  async function submit(reason: string) {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      // The only check made here. Everything else -- a non-number, a
      // non-positive figure, a rate outside the 0.5x-2.0x sanity band that
      // catches a dropped or doubled digit -- is refused by the action's own
      // snapshot() and arrives as a 409 whose message names the band. This
      // screen does not duplicate that validation, so there is one place the
      // rule lives.
      const msg = "Enter the rate to grant, in TZS per USD.";
      setError(msg);
      throw new Error(msg); // keeps the modal open so the error is visible
    }
    try {
      await createActionRequest({
        action_type: SET,
        // The EMPLOYER's id: `pricing.set_client_rate` is target_type
        // "Employer" and its target_ref is an employer_id
        // (dashboard/actions/pricing.py `_employer`).
        target_ref: merchant.employer_id,
        // Sent as the STRING the operator typed, never parsed here. The
        // action parses it with Decimal; a Number() round trip on the way out
        // is how 2700.1 becomes something else.
        params: { tzs_per_usdc: trimmed },
        reason,
      });
      onRequested(
        `Request created. NOTHING HAS CHANGED YET -- this merchant is still `
        + `charged ${rateText(rate.effective)} (the ${rate.source} rate). A `
        + `different ops.admin must approve it from the Actions queue within `
        + `the hour, or it expires and nothing happens at all.`,
      );
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not create the request.");
      setError(msg);
      throw new Error(msg); // keeps the modal open so the error is visible
    }
  }

  return (
    <DangerousActionModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Request client rate: ${merchant.business_name || merchant.employer_id}`}
      confirmLabel="Create request"
      requireReason
      onConfirm={submit}
      impact={
        <div className="flex flex-col gap-3">
          <p>
            This only CREATES a request -- it does not change what this
            merchant pays. A different ops.admin must review and approve it
            (from the Actions queue) within one hour, or it expires and
            nothing happens.
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-text-muted">Charged today</dt>
            <dd className="text-right font-mono font-medium text-text">
              {rateText(rate.effective)}{" "}
              <span className="font-sans text-text-muted">({rate.source})</span>
            </dd>
            <dt className="text-text-muted">Universal rate</dt>
            <dd className="text-right font-mono font-medium text-text">
              {rateText(rate.universal)}
            </dd>
          </dl>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-rate-value">
              New rate for this merchant (TZS per USD)
            </Label>
            <Input
              id="client-rate-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={rate.universal ?? "e.g. 2700.000000"}
            />
            <p className="text-xs text-text-muted">
              Up to six decimal places, as typed. A figure far from the
              universal rate is refused on approval as a probable dropped or
              doubled digit.
            </p>
          </div>
          {/* Requirement, in words, where the person granting one reads it. */}
          <p className="font-semibold text-danger-fg">{NO_EXPIRY}</p>
          {rate.override ? (
            <p>
              This merchant already has a client rate of{" "}
              <span className="font-mono">
                {rateText(rate.override.tzs_per_usdc)}
              </span>
              . Granting supersedes it by being newer -- the existing row is
              not edited and not deleted, and stays readable as the record of
              what they were charged until now.
            </p>
          ) : null}
          <p className="text-xs text-text-muted">
            The approver sees the exact before/after, a priced $100 top-up
            under both rates, and every warning, on the request itself.
          </p>
          {error ? <p className="text-danger-fg">{error}</p> : null}
        </div>
      }
    />
  );
}

/** Requesting a clear -- back onto the universal rate, and tracking it again. */
function ClearRateModal({
  merchant,
  rate,
  open,
  onOpenChange,
  onRequested,
}: {
  merchant: MerchantDetail;
  rate: MerchantRate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: (message: string) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  async function submit(reason: string) {
    setError(null);
    try {
      await createActionRequest({
        action_type: CLEAR,
        target_ref: merchant.employer_id,
        reason,
      });
      onRequested(
        `Request created. NOTHING HAS CHANGED YET -- this merchant is still `
        + `on their client rate of ${rateText(rate.effective)}. A different `
        + `ops.admin must approve it from the Actions queue within the hour, `
        + `or it expires and nothing happens at all.`,
      );
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not create the request.");
      setError(msg);
      throw new Error(msg); // keeps the modal open so the error is visible
    }
  }

  return (
    <DangerousActionModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Request clear: back to the universal rate`}
      confirmLabel="Create request"
      requireReason
      onConfirm={submit}
      impact={
        <div className="flex flex-col gap-3">
          <p>
            This only CREATES a request -- it does not change what this
            merchant pays. A different ops.admin must review and approve it
            (from the Actions queue) within one hour, or it expires and
            nothing happens.
          </p>
          <p>
            Once approved,{" "}
            {merchant.business_name || merchant.employer_id} goes from{" "}
            <span className="font-mono">{rateText(rate.effective)}</span> back
            onto the universal rate --{" "}
            <span className="font-mono">{rateText(rate.universal)}</span>{" "}
            today, and whatever it moves to afterwards. They track it again
            instead of sitting on a bespoke number.
          </p>
          <p>
            Nothing is deleted: the override period is closed with an end date
            and stays readable as the record of what they were charged and
            between which dates. A future-dated override, if one exists, is
            NOT cancelled by this -- the approver's preview names it.
          </p>
          <p className="text-xs text-text-muted">
            Refused outright if this merchant has no live client rate by the
            time it is approved.
          </p>
          {error ? <p className="text-danger-fg">{error}</p> : null}
        </div>
      }
    />
  );
}

export function PricingTab({ merchant }: { merchant: MerchantDetail }) {
  const [catalogue, setCatalogue] = React.useState<ActionCatalogueEntry[] | null>(null);
  const [open, setOpen] = React.useState<"grant" | "clear" | null>(null);
  const [requested, setRequested] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    // "So the UI never renders a button that would 403" -- ActionCatalogue's
    // own docstring. `may_request` is computed with the same _may() the
    // create endpoint checks, so a button hidden here truly could not have
    // been used. A failed catalogue read shows no buttons rather than
    // guessing that this account may act.
    getActionCatalogue()
      .then((rows) => { if (!cancelled) setCatalogue(rows); })
      .catch(() => { if (!cancelled) setCatalogue([]); });
    return () => { cancelled = true; };
  }, []);

  const may = (actionType: string) =>
    catalogue?.some((c) => c.action_type === actionType && c.may_request) ?? false;

  // See `MerchantDetail.rate`: typed non-optional, read as though it might be
  // absent. A console deployed ahead of the backend that added the key must
  // say it cannot read the rate -- not draw the screen of a merchant on the
  // universal rate, which is a claim about somebody's pricing.
  const rate = merchant.rate as MerchantRate | undefined;
  if (!rate) {
    return (
      <Card className="border border-danger-fg">
        <CardHeader><CardTitle>Rate not reported</CardTitle></CardHeader>
        <CardContent className="text-sm">
          This backend did not send a <code className="font-mono">rate</code>{" "}
          for this merchant, so what they are charged cannot be shown here.
          This is a version mismatch, not a merchant on the universal rate --
          do not read it as one. Check the deployed backend before granting or
          clearing anything.
        </CardContent>
      </Card>
    );
  }

  const override = rate.override;

  return (
    <div className="space-y-4">
      {requested ? (
        <Card className="border border-brand">
          <CardContent className="flex items-start justify-between gap-4 text-sm">
            <p>
              {requested} See the{" "}
              <Link href="/daraja/actions" className="underline">Actions queue</Link>.
            </p>
            <Button size="sm" variant="outline" onClick={() => setRequested(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* The flag, repeated inside the tab: someone who opened Pricing
          BECAUSE of the banner above must still see it beside the numbers
          it is about. */}
      <ClientRateUnderwaterBanner merchant={merchant} />

      {rate.effective === null ? (
        <Card className="border border-danger-fg">
          <CardHeader><CardTitle>No rate configured at all</CardTitle></CardHeader>
          <CardContent className="text-sm">
            There is neither a client rate for this merchant nor a universal
            rate in the system, so nothing can price a top-up, expense or
            payout quote for them -- those lookups fail rather than guess. A
            client rate cannot be granted either: the grant is sanity-checked
            against the universal rate, and with none configured it is
            refused. Set the universal rate first.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Charged to this merchant</CardTitle>
            <StatusBadge variant={rate.source === "override" ? "warning" : "neutral"}>
              {rate.source === "override" ? "client rate" : "universal rate"}
            </StatusBadge>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="font-mono text-2xl font-semibold">
              {rateText(rate.effective)}
            </div>
            <p className="text-xs text-text-muted">
              {rate.source === "override"
                ? "A rate granted to this merchant alone. It applies to every "
                  + "top-up, expense and payout quote they make."
                : "This merchant has no client rate, so they pay the universal "
                  + "rate and move with it."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Universal rate</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="font-mono text-2xl font-semibold">
              {rateText(rate.universal)}
            </div>
            <p className="text-xs text-text-muted">
              What every merchant without a client rate pays today. Shown
              beside the charged rate, never subtracted from it -- a rate has
              six decimal places and this screen does no arithmetic on one.
            </p>
          </CardContent>
        </Card>
      </div>

      {override ? (
        <Card>
          <CardHeader><CardTitle>Why this merchant is on this rate</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Row label="Rate" value={
                <span className="font-mono">{rateText(override.tzs_per_usdc)}</span>
              } />
              <Row label="Granted by" value={override.granted_by} />
              <Row label="Granted at" value={formatDateTime(override.created_at)} />
              <Row label="In force from" value={formatDateTime(override.starts_at)} />
              <Row
                label="Ends"
                value={
                  override.ends_at
                    ? formatDateTime(override.ends_at)
                    : "never -- runs until someone changes or clears it"
                }
              />
              <Row label="Override id" value={
                <span className="font-mono text-xs">{override.rate_id}</span>
              } />
            </div>
            <Row label="Reason given when it was requested" value={override.note} />
            <p className="text-xs text-text-muted">
              `Granted by` is the ops.admin who APPROVED the request, not the
              one who filed it. Earlier rates for this merchant are not
              overwritten -- the grant and the clear are both recorded in the
              audit log, which the Activity tab lists.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Changing what this merchant pays</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {/* Requirement, in words, on the body of the tab as well as in the
              modal: the person who grants a rate is not always the person who
              reads the modal. */}
          <p className="font-semibold text-text">{NO_EXPIRY}</p>
          <p className="text-text-muted">
            Both changes are requests. Filing one changes nothing: a different
            ops.admin must approve it from the Actions queue within the hour,
            or it expires and nothing happens at all.
          </p>
          {catalogue === null ? null : (
            <div className="flex flex-wrap items-center gap-2">
              {may(SET) ? (
                <Button size="sm" onClick={() => setOpen("grant")}>
                  {override ? "Request a different client rate" : "Request a client rate"}
                </Button>
              ) : null}
              {override && may(CLEAR) ? (
                <Button size="sm" variant="destructive" onClick={() => setOpen("clear")}>
                  Request clear back to universal
                </Button>
              ) : null}
              {!may(SET) && !(override && may(CLEAR)) ? (
                <p className="text-text-muted">
                  This account may not request pricing changes.
                </p>
              ) : null}
            </div>
          )}
          {!override && may(CLEAR) ? (
            <p className="text-xs text-text-muted">
              There is nothing to clear: this merchant is already on the
              universal rate.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <GrantRateModal
        merchant={merchant}
        rate={rate}
        open={open === "grant"}
        onOpenChange={(o) => setOpen(o ? "grant" : null)}
        onRequested={setRequested}
      />
      {/* Mounted only while there is a live override to clear, so the modal
          can never describe clearing a rate the merchant does not have. */}
      {override ? (
        <ClearRateModal
          merchant={merchant}
          rate={rate}
          open={open === "clear"}
          onOpenChange={(o) => setOpen(o ? "clear" : null)}
          onRequested={setRequested}
        />
      ) : null}
    </div>
  );
}
