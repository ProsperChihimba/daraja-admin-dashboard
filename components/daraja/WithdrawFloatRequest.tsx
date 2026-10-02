// components/daraja/WithdrawFloatRequest.tsx -- taking Daraja's own float OUT
// of the Selcom pool, to a bank account.
//
// NOTHING HERE MOVES ANY MONEY. Like every other control in this console it
// only POSTs /dashboard/actions/requests/, which stores a row a DIFFERENT
// ops.admin must approve from the Actions queue within the hour, or it
// expires and nothing happens at all. Same shape, and the same reason, as the
// sweep modal beside it.
//
// WHY THIS SCREEN EXISTS AT ALL: on 2026-09-22 a 5,330,000 withdrawal was
// done by hand -- `sweep_card_topups` on the server, then the Selcom Business
// API driven from utils_functions/selcom_business_balance.py, because the
// Selcom portal cannot initiate a transfer. One person, no preview, no second
// pair of eyes, and a live API key printed into the terminal three times.
//
// THREE THINGS THIS FORM SAYS OUT LOUD, because each one has already cost
// something:
//
//  1. THE RECIPIENT NAME. The handler prefers Selcom's name lookup and falls
//     back to a name typed here. With NEITHER, the preview only warns while
//     the approval RAISES -- the request dies at the moment a second person
//     thought they were releasing money. Selcom's lookup has been answering
//     403 "excessive lookup usage" since 2026-09-17 and did so again on
//     2026-10-02, so the typed fallback is the ordinary path, not the edge.
//
//  2. THE ALLOWLIST. A destination outside DARAJA_FLOAT_SOURCE_ACCOUNTS books
//     as an unowned debit: the ledger goes OVER the pool and every merchant's
//     payouts halt until someone runs `resolve_debit --float`. That happens on
//     every off-allowlist withdrawal, not only on a reversal. The override is
//     ops.admin-only and is sent ONLY when ticked -- never `override: false`,
//     which `create_request` would read as a truthy intent to override.
//     No endpoint exposes the allowlist, so this form cannot pre-check the
//     number; only the 400 on filing can.
//
//  3. WHOLE SHILLINGS. `operator_amount()` refuses a fractional part because
//     Selcom moves whole shillings. Caught here so it is visible as typed
//     rather than spent as a round trip.
"use client";
import * as React from "react";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatOpsMoney } from "@/lib/darajaMoney";
import { createActionRequest, extractOpsErrorMessage } from "@/lib/darajaActions";

/** The action's own type and target, never guessed at the call site. */
const ACTION_TYPE = "treasury.withdraw_float";
const TARGET_REF = "float";

/** Selcom's FI code for the destination bank. CRDB is Daraja's own. */
const DEFAULT_BANK = "CRDB";

/**
 * Whole shillings, or a reason why not.
 *
 * Deliberately NOT parseFloat: it accepts "1,000" as 1 and "1e6" as a
 * million, and this is the field that says how much money leaves. Returns
 * null when the amount is usable.
 */
export function amountProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Enter the amount to withdraw.";
  if (!/^\d+$/.test(value)) {
    return "Whole shillings only -- digits, no decimal point, no commas. "
      + "Selcom moves whole shillings and the backend refuses the rest.";
  }
  if (/^0+$/.test(value)) return "The amount must be more than zero.";
  return null;
}

export function WithdrawFloatRequest({
  open,
  onOpenChange,
  floatBalance,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The float wallet's balance as the treasury endpoint reported it, or null when it could not be read. */
  floatBalance: string | null;
  onRequested: (message: string) => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [account, setAccount] = React.useState("");
  const [bank, setBank] = React.useState(DEFAULT_BANK);
  const [name, setName] = React.useState("");
  const [override, setOverride] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setAmount("");
      setAccount("");
      setBank(DEFAULT_BANK);
      setName("");
      setOverride(false);
      setError(null);
    }
  }, [open]);

  const problem = amountProblem(amount);
  const destinationMissing = !account.trim();

  async function submit(reason: string) {
    setError(null);
    const localProblem = problem ?? (destinationMissing ? "Enter the destination account number." : null);
    if (localProblem) {
      setError(localProblem);
      throw new Error(localProblem);   // keeps the modal open
    }
    try {
      const params: Record<string, unknown> = {
        amount: amount.trim(),
        bank: bank.trim() || DEFAULT_BANK,
        account: account.trim(),
      };
      // Optional to the API, but a request filed without it dies at the
      // APPROVAL when Selcom's lookup is throttled -- see the header note.
      if (name.trim()) params.name = name.trim();
      // Only ever sent when ticked. `create_request` treats any truthy
      // `override` as an intent to override and re-checks the filer against
      // ops.admin, so sending `false` would be a different request.
      if (override) params.override = true;

      await createActionRequest({
        action_type: ACTION_TYPE,
        target_ref: TARGET_REF,
        reason,
        params,
      });
      onRequested(
        `Withdrawal request created for ${amount.trim()} to ${account.trim()}. `
        + `Nothing has moved yet -- a different ops.admin must approve it from `
        + `the Actions queue within the hour, or it expires and nothing happens.`,
      );
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not create the request.");
      setError(msg);
      throw new Error(msg);
    }
  }

  return (
    <DangerousActionModal
      open={open}
      onOpenChange={onOpenChange}
      title="Request float withdrawal"
      confirmLabel="Create request"
      requireReason
      onConfirm={submit}
      impact={
        <div className="flex flex-col gap-3">
          <p>
            This only CREATES a request -- it does not move any money. A
            different ops.admin must review and approve it (from the Actions
            queue) within one hour, or it expires and nothing happens.
          </p>
          <p>
            On approval this sends real money OUT of the Selcom pool to the
            account below. The ledger entry is written later, by
            poll_deposits, when the debit appears on the statement -- so run
            poll_deposits and reconcile_wallets afterwards.
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-text-muted">Daraja float</dt>
            <dd className="text-right font-medium text-text">
              {floatBalance === null ? "could not be read" : formatOpsMoney(floatBalance)}
            </dd>
          </dl>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-amount">Amount (whole shillings)</Label>
            <Input
              id="withdraw-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5330000"
            />
            {amount.trim() && problem ? (
              <p className="text-xs text-danger-fg">{problem}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-account">Destination account number</Label>
            <Input
              id="withdraw-account"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="e.g. 0150001LA2C00"
            />
            <p className="text-xs text-text-muted">
              Daraja&apos;s own CRDB account is 0150001LA2C00. Anything else
              needs the override below.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-bank">Bank (Selcom FI code)</Label>
            <Input
              id="withdraw-bank"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder={DEFAULT_BANK}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-name">Recipient name</Label>
            <Input
              id="withdraw-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DARAJA FINTECH"
            />
            <p className="text-xs text-text-muted">
              Type it. Selcom&apos;s name lookup has been throttled since
              2026-09-17, and with no looked-up name and none typed here the
              APPROVAL fails -- not this request, the approval, after someone
              else has already decided to release the money.
            </p>
          </div>

          {/*
            Not gated in the client. This console has no role model -- see
            ActionExecutions.tsx, which lets a 403 explain itself rather than
            guessing at groups -- and `create_request` re-checks any truthy
            `override` against CAN_ADMINISTER (ops.admin, narrower than the
            ops.finance who may file money requests at all). A non-admin who
            ticks this gets the server's own 403, in the error line below.
          */}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
              aria-label="Send to an account that is not one of Daraja's configured float accounts"
            />
            <span>
              This destination is <strong>not</strong> one of Daraja&apos;s
              configured float accounts, and I accept that the debit will book
              as an unowned debit -- which leaves the ledger over the pool and{" "}
              <strong>halts every merchant&apos;s payouts</strong> until an
              operator runs <code>resolve_debit --float</code>. ops.admin only.
            </span>
          </label>

          {error ? <p className="text-danger-fg">{error}</p> : null}
        </div>
      }
    />
  );
}
