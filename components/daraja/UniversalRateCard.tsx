// components/daraja/UniversalRateCard.tsx -- the platform's own price for a
// dollar, on the Treasury screen, and the request that moves it.
//
// WHAT DID NOT EXIST BEFORE THIS FILE. The universal rate -- the USD->TZS
// number every merchant WITHOUT a client rate pays, on every top-up, expense
// and payout quote -- could only be changed by SSHing to the box and running
// `manage.py set_conversion_rate 2750`. One person with a server login, typing
// a number: no preview, no approval, no sanity band, no record of who decided
// it (the last move, 2765 to 2750, left none). Meanwhile a rate for ONE
// merchant already needed two ops admins and a typed justification. That
// asymmetry was backwards -- this is the more consequential control -- and this
// card closes it. The shell command stays as the emergency path that does not
// depend on two people being awake; this is the everyday door.
//
// NOTHING HERE CHANGES THE RATE. Like every other control in this console it
// only ever POSTs /dashboard/actions/requests/, which per that view's own
// docstring "does NOT execute": it stores a row a DIFFERENT ops.admin must
// approve from the Actions queue within the hour, or it expires and nothing
// happens at all. The copy says so in the card, in the modal, and in the
// confirmation -- the failure this wording exists to prevent is somebody
// typing a number, clicking, and walking away believing the platform's price
// has moved.
//
// WHY THE JUSTIFICATION IS A TEXTAREA AND NOT A CHECKBOX. Same reason as
// components/daraja/ReversalRequest.tsx, which is the pattern this file
// follows (rather than PricingTab's, whose grant modal has no statement at
// all): the decision behind a rate is commercial and nothing in this system
// records it. A checkbox beside an Approve button becomes the default click
// and dual approval degrades into two people ticking the same box. So it is a
// prompted free-text statement, at least MIN_EVIDENCE characters, mirrored
// client-side so a short one never costs the operator their typing to a 400,
// shown to the approver verbatim and written onto the ConversionRate row's own
// `note` -- which is the first thing anyone reading rate history sees.
//
// NO ARITHMETIC ON THE RATE. Every figure is text through `formatOpsRate`: the
// column is DecimalField(20,6) and a browser must not round the price of every
// quote on the platform. The priced $100 before/after comparison an approver
// needs is computed in Decimal by the action's own preview and shown on the
// request itself.
//
// AND THE HALF OF THIS SCREEN THAT IS NOT THE NUMBER. A client rate does NOT
// track the universal rate and does NOT expire, so when this number moves,
// every override holder stays exactly where they were. `below_universal`
// counts the ones left priced UNDER it -- sold dollars for less than everybody
// else, on every top-up, indefinitely, with only the
// `client_rate_below_universal` detector to say so afterwards. Both counts are
// rendered whether they are zero or not (a warning that appears only sometimes
// cannot be told apart from one nobody wrote), and a non-zero
// `below_universal` gets the red treatment rather than a grey number.
"use client";
import * as React from "react";
import Link from "next/link";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatDateTime } from "@/lib/format";
import { formatOpsRate } from "@/lib/darajaMoney";
import {
  createActionRequest,
  extractOpsErrorMessage,
  getActionCatalogue,
  MIN_EVIDENCE,
  type ActionCatalogueEntry,
} from "@/lib/darajaActions";
import type { TreasuryRate } from "@/lib/darajaTreasury";

export const SET_UNIVERSAL_RATE = "pricing.set_universal_rate";

/**
 * `dashboard/actions/pricing.py` UNIVERSAL_TARGET_REF -- the fixed sentinel.
 *
 * This action has NO merchant, and the backend refuses any other `target_ref`
 * outright rather than normalising it: filed against an employer id it would
 * still write a universal rate, while the audit row and every per-merchant
 * history view pointed at one merchant.
 */
const UNIVERSAL_TARGET_REF = "universal";

/** The sentence this whole card turns on. One copy, used by the card body and
 *  by the modal, so the two cannot drift apart. */
const NO_TRACKING =
  "A client rate does not track this number and does not expire. Every "
  + "merchant holding one stays exactly where they are when this moves, on "
  + "every top-up, expense and payout quote, until a human grants them "
  + "another rate or clears them back to universal.";

/** One of the two counts, as a tile. Red when it is the underwater one and it
 *  is not zero -- see this file's header comment. */
function CountTile({
  value,
  label,
  alarming,
  children,
}: {
  value: number;
  label: string;
  alarming: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        alarming
          ? "rounded-card border-2 border-danger-fg bg-danger-bg/40 p-3"
          : "rounded-card border border-border p-3"
      }
    >
      <div className="flex items-baseline gap-2">
        <span
          className={
            alarming
              ? "text-2xl font-semibold text-danger-fg"
              : "text-2xl font-semibold text-text"
          }
        >
          {value}
        </span>
        <span
          className={
            alarming
              ? "text-xs font-semibold tracking-tight text-danger-fg"
              : "text-xs font-semibold tracking-tight text-text-muted"
          }
        >
          {label}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-muted">{children}</p>
    </div>
  );
}

/** Filing the request. Everything the backend refuses is left to the backend
 *  EXCEPT the two things that would cost the operator their typing: a blank
 *  rate and a statement under the floor. */
function SetUniversalRateModal({
  rate,
  open,
  onOpenChange,
  onRequested,
}: {
  rate: TreasuryRate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: (message: string) => void;
}) {
  const [value, setValue] = React.useState("");
  const [evidence, setEvidence] = React.useState("");
  const [rateError, setRateError] = React.useState<string | null>(null);
  const [evidenceError, setEvidenceError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      // Deliberately NOT cleared while the modal is open, including after a
      // failed submit: a refusal ("that rate is outside the 0.5x-2.0x band")
      // must not cost the operator the paragraph they just wrote about why the
      // price is moving.
      setValue("");
      setEvidence("");
      setRateError(null);
      setEvidenceError(null);
      setFormError(null);
    }
  }, [open]);

  const typed = evidence.trim();
  const noRateYet = rate.universal === null;

  async function submit(reason: string) {
    setRateError(null);
    setEvidenceError(null);
    setFormError(null);

    const trimmed = value.trim();
    let bad = false;
    if (!trimmed) {
      setRateError("Enter the new universal rate, in TZS per USD.");
      bad = true;
    }
    // The backend's own floor, mirrored -- and ONLY this one. A non-number, a
    // non-positive figure, a rate too wide for the column, a rate outside the
    // 0.5x-2.0x sanity band that catches a dropped or doubled digit: all are
    // refused by the action's own snapshot() and arrive as a 409 whose message
    // names the rule. This screen does not duplicate that validation, so there
    // is one place each rule lives.
    if (!typed) {
      setEvidenceError(
        "A justification is required. This is the price every merchant "
        + "without a client rate pays, and nothing in this system records why "
        + "it moved.",
      );
      bad = true;
    } else if (typed.length < MIN_EVIDENCE) {
      setEvidenceError(
        `That is ${typed.length} characters; at least ${MIN_EVIDENCE} are `
        + `required. This is the statement a second ops.admin approves `
        + `against, and it is the only record of why the platform's rate `
        + `changed -- say what the number is based on and who agreed it.`,
      );
      bad = true;
    }
    if (bad) throw new Error("incomplete"); // keeps the modal open

    try {
      await createActionRequest({
        action_type: SET_UNIVERSAL_RATE,
        target_ref: UNIVERSAL_TARGET_REF,
        params: {
          // Sent as the STRING the operator typed, never parsed here. The
          // action parses it with Decimal; a Number() round trip on the way
          // out is how 2750.1 becomes something else.
          tzs_per_usdc: trimmed,
          // `evidence`, not "justification" -- the backend's shared
          // typed-statement parser reads that key
          // (dashboard/actions/statements.py). Sent as typed, trimmed and
          // nothing else: it is a statement a human wrote, and this screen
          // does not edit, truncate or summarise one.
          evidence: typed,
        },
        reason,
      });
      onRequested(
        `Request created. NOTHING HAS CHANGED YET -- every merchant on the `
        + `universal rate is still charged `
        + `${noRateYet ? "nothing, because no universal rate is configured" : formatOpsRate(rate.universal)}. `
        + `A different ops.admin must read your justification and approve it `
        + `from the Actions queue within the hour, or it expires and nothing `
        + `happens at all.`,
      );
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not create the request.");
      setFormError(msg);
      throw new Error(msg); // keeps the modal open so the error is visible
    }
  }

  return (
    <DangerousActionModal
      open={open}
      onOpenChange={onOpenChange}
      title="Request a new universal rate: the price every merchant pays"
      confirmLabel="Create request"
      requireReason
      onConfirm={submit}
      impact={
        <div className="flex flex-col gap-3">
          <p>
            This only CREATES a request -- it does not change what anybody
            pays. A different ops.admin must review your justification and
            approve it (from the Actions queue) within one hour, or it expires
            and nothing happens.
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-text-muted">Rate in force</dt>
            <dd className="text-right font-mono font-medium text-text">
              {noRateYet ? "none configured" : formatOpsRate(rate.universal)}
            </dd>
            {noRateYet ? null : (
              <>
                <dt className="text-text-muted">Set</dt>
                <dd className="text-right font-medium text-text">
                  {formatDateTime(rate.set_at)}
                </dd>
              </>
            )}
            <dt className="text-text-muted">Merchants on a client rate</dt>
            <dd className="text-right font-medium text-text">
              {rate.override_holders}
            </dd>
            <dt
              className={
                rate.below_universal > 0
                  ? "font-semibold text-danger-fg"
                  : "text-text-muted"
              }
            >
              ...of those, below the universal rate
            </dt>
            <dd
              className={
                rate.below_universal > 0
                  ? "text-right font-semibold text-danger-fg"
                  : "text-right font-medium text-text"
              }
            >
              {rate.below_universal}
            </dd>
          </dl>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="universal-rate-value">
              New universal rate (TZS per USD)
            </Label>
            <Input
              id="universal-rate-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={rate.universal ?? "e.g. 2750.000000"}
              aria-invalid={rateError ? true : undefined}
            />
            <p className="text-xs text-text-muted">
              Up to six decimal places, as typed.{" "}
              {noRateYet
                ? "There is no rate in force, so NO sanity band can be applied "
                  + "-- there is nothing to measure this against. Read it digit "
                  + "by digit: a dropped or doubled digit would be accepted and "
                  + "nothing downstream would question it."
                : "A figure outside half to double the rate in force is refused "
                  + "on approval as a probable dropped or doubled digit."}
            </p>
            {rateError ? <p className="text-danger-fg">{rateError}</p> : null}
          </div>

          {/* A prompted textarea, never a checkbox: see this file's header. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="universal-rate-evidence">
              Why the platform&rsquo;s rate is changing
            </Label>
            <p className="text-xs text-text-muted">
              What is the number based on, and who agreed it? Nothing in this
              system records a commercial decision, so the change rests
              entirely on this statement. A second ops.admin approves against
              it, it lands on the rate row itself, and it is the only record of
              why the price moved -- the last move, 2765 to 2750, left none.
            </p>
            <Textarea
              id="universal-rate-evidence"
              className="min-h-28"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Bridge USD cost rose 4.1% over the week, agreed with the owner 2026-09-26"
              aria-invalid={evidenceError ? true : undefined}
            />
            <p className="text-xs text-text-muted">
              At least {MIN_EVIDENCE} characters, and the approver reads it
              word for word. There is no tickbox for this on purpose: a box
              beside an Approve button becomes the default click, and dual
              approval turns into two people ticking the same box.{" "}
              {typed.length > 0 && typed.length < MIN_EVIDENCE
                ? `${typed.length} of ${MIN_EVIDENCE} so far.`
                : null}
            </p>
            {evidenceError ? (
              <p className="text-danger-fg">{evidenceError}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 rounded-card border-2 border-danger-fg bg-danger-bg/40 p-3">
            <p>
              <span className="font-semibold text-danger-fg">
                This is the rate EVERY merchant without a client rate pays.
              </span>{" "}
              Once approved, every top-up, expense and payout quote on the
              platform is priced from it the moment the transaction commits,
              and it runs until a human changes it again.
            </p>
            <p className="font-semibold">{NO_TRACKING}</p>
            {rate.below_universal > 0 ? (
              <p>
                <span className="font-semibold text-danger-fg">
                  {rate.below_universal} of the {rate.override_holders} client
                  rate(s) in force already sit below the current universal
                  rate.
                </span>{" "}
                Raising this number leaves them further under it. The approver
                is shown each one by name, with its rate, on the request
                itself.
              </p>
            ) : null}
          </div>

          <p className="text-xs text-text-muted">
            The approver sees the exact before/after, the same $100 top-up
            priced under both rates, every merchant who would be left below the
            new rate by name, and your justification verbatim, on the request
            itself. This APPENDS a rate row: the rate in force is not edited
            and not deleted, and stays readable as the record of what the
            platform charged until now.
          </p>

          {formError ? <p className="text-danger-fg">{formError}</p> : null}
        </div>
      }
    />
  );
}

/**
 * The Treasury screen's rate card.
 *
 * `rate` is `undefined` when the backend did not send the key at all -- a
 * console deployed ahead of the backend -- and that is rendered as the version
 * mismatch it is, NOT as a platform with no rate configured. `loading` keeps
 * the mismatch card off the screen during the first fetch, when `rate` is
 * legitimately not there yet.
 */
export function UniversalRateCard({
  rate,
  loading,
}: {
  rate: TreasuryRate | undefined;
  loading: boolean;
}) {
  const [catalogue, setCatalogue] = React.useState<ActionCatalogueEntry[] | null>(
    null,
  );
  const [open, setOpen] = React.useState(false);
  const [requested, setRequested] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    // "So the UI never renders a button that would 403" -- ActionCatalogue's
    // own docstring. `may_request` is computed with the same `_may()` the
    // create endpoint checks, so a button hidden here truly could not have
    // been used. A failed catalogue read shows no button rather than guessing
    // that this account may move the platform's price.
    getActionCatalogue()
      .then((rows) => { if (!cancelled) setCatalogue(rows); })
      .catch(() => { if (!cancelled) setCatalogue([]); });
    return () => { cancelled = true; };
  }, []);

  const may =
    catalogue?.some(
      (c) => c.action_type === SET_UNIVERSAL_RATE && c.may_request,
    ) ?? false;

  if (!rate) {
    // Nothing at all during the first load: an empty card says less than no
    // card, and the mismatch copy below would be a lie while the fetch is
    // still in flight.
    if (loading) return null;
    return (
      <Card className="mb-4 border border-danger-fg">
        <CardHeader>
          <CardTitle>Universal rate not reported</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          This backend did not send a <code className="font-mono">rate</code>{" "}
          block on <code className="font-mono">/dashboard/treasury/</code>, so
          the price every merchant pays for a dollar cannot be shown here. This
          is a version mismatch, not a platform with no rate configured -- do
          not read it as one. Check the deployed backend before changing
          anything.
        </CardContent>
      </Card>
    );
  }

  const noRateYet = rate.universal === null;
  const underwater = rate.below_universal > 0;

  return (
    <>
      {requested ? (
        <Card className="mb-4 border border-brand">
          <CardContent className="flex items-start justify-between gap-4 text-sm">
            <p>
              {requested} See the{" "}
              <Link href="/daraja/actions" className="underline">
                Actions queue
              </Link>
              .
            </p>
            <Button size="sm" variant="outline" onClick={() => setRequested(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card
        className={
          underwater || noRateYet ? "mb-4 border-2 border-danger-fg" : "mb-4"
        }
      >
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Universal conversion rate</CardTitle>
            <p className="mt-1 text-xs text-text-muted">
              What every merchant WITHOUT a client rate is charged for a
              dollar. Every top-up, expense and payout quote on the platform is
              priced from it.
            </p>
          </div>
          {noRateYet ? (
            <StatusBadge variant="danger">NOT SET</StatusBadge>
          ) : underwater ? (
            <StatusBadge variant="danger">
              {rate.below_universal} BELOW UNIVERSAL
            </StatusBadge>
          ) : (
            <StatusBadge variant="neutral">in force</StatusBadge>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {noRateYet ? (
            <div className="space-y-2">
              <div className="font-mono text-2xl font-semibold text-danger-fg">
                No universal rate has ever been set
              </div>
              <p>
                There is no <code className="font-mono">ConversionRate</code> row
                at all, so nothing can price a top-up, expense or payout quote
                for any merchant without their own client rate -- those lookups
                raise{" "}
                <code className="font-mono">NoRateConfigured</code> and fail
                rather than guess a number. A client rate cannot be granted
                either: a grant is sanity-checked against the universal rate,
                and with none configured it is refused. This is the state to
                fix first.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-mono text-2xl font-semibold text-text">
                {formatOpsRate(rate.universal)}
              </div>
              <div className="text-xs text-text-muted">
                set {formatDateTime(rate.set_at)}
              </div>
              {/* `||`, not `??`: `ConversionRate.note` is blank=True and
                  `set_conversion_rate --note` defaults to "", so an empty
                  string is live data -- and an empty one is worth saying out
                  loud, because it means nobody recorded why. */}
              <p className="text-xs text-text-muted">
                {rate.note || (
                  <span className="text-danger-fg">
                    No reason was recorded with this rate -- it was set through
                    the shell, which asks for none.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Both counts, always, zero or not -- see this file's header. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <CountTile
              value={rate.override_holders}
              label="ON A CLIENT RATE"
              alarming={false}
            >
              {rate.override_holders === 0
                ? "No merchant holds a client rate, so every merchant on the "
                  + "platform moves with this number."
                : "Merchants with a rate of their own. They do NOT move when "
                  + "this number changes -- each stays on the number they were "
                  + "granted until a human changes or clears it."}
            </CountTile>
            <CountTile
              value={rate.below_universal}
              label="BELOW THE UNIVERSAL RATE"
              alarming={underwater}
            >
              {underwater ? (
                <>
                  Sold dollars for LESS than every other merchant pays, on
                  every top-up, indefinitely. Daraja loses the difference each
                  time. This is the condition the ops alert{" "}
                  <code className="font-mono">
                    client_rate_below_universal
                  </code>{" "}
                  pages on -- open each merchant&rsquo;s Pricing tab to grant a
                  new rate or clear them back to universal.
                </>
              ) : noRateYet ? (
                "Nothing can be underwater while there is no universal rate to "
                + "be under -- this count is not a clean bill of health until "
                + "a rate is set."
              ) : (
                "No client rate in force sits under the universal rate, so no "
                + "merchant is buying dollars for less than everybody else."
              )}
            </CountTile>
          </div>

          <p className="font-semibold text-text">{NO_TRACKING}</p>

          <p className="text-text-muted">
            Changing this is a REQUEST. Filing one changes nothing: a different
            ops.admin must approve it from the Actions queue within the hour,
            or it expires and nothing happens at all.
          </p>

          {catalogue === null ? null : may ? (
            <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
              {noRateYet
                ? "Request the first universal rate"
                : "Request a new universal rate"}
            </Button>
          ) : (
            <p className="text-text-muted">
              This account may not request a change to the universal rate.
            </p>
          )}
        </CardContent>
      </Card>

      <SetUniversalRateModal
        rate={rate}
        open={open}
        onOpenChange={setOpen}
        onRequested={(message) => {
          setOpen(false);
          setRequested(message);
        }}
      />
    </>
  );
}
