// components/daraja/ReversalRequest.tsx -- the first DESTRUCTIVE control in
// this console: handing a merchant their shillings back when a payment did
// not land.
//
// NOTHING HERE RETURNS ANY MONEY. Like every other control in this console it
// only ever POSTs /dashboard/actions/requests/, which per that view's own
// docstring "does NOT execute": it stores a row a DIFFERENT ops.admin must
// approve from the Actions queue within the hour, or it expires and nothing
// happens at all. Same shape, and the same reason, as PricingTab's two
// buttons and CardsTab's freeze pair.
//
// WHY THE ATTESTATION IS A TEXTAREA AND NOT A CHECKBOX -- the whole point of
// this file. Neither reversal can be verified by this system. Nothing on our
// side can prove nTZS did not pay a till, or that Nuvion did not deliver the
// dollars; a timeout is precisely the case where it may have. The only
// evidence there can be is a human opening the provider's own dashboard,
// searching for the id, and writing down what they saw. On the shell that is
// a flag an operator types (`--confirm-not-paid-at-ntzs`,
// `--confirm-not-funded-at-nuvion`). It was deliberately NOT made a checkbox
// here: a checkbox beside an Approve button becomes the default click, and
// dual approval degrades into two people ticking the same box. So this is a
// prompted free-text statement, at least MIN_EVIDENCE characters, shown to the
// approver VERBATIM (components/daraja/ActionRequestCard.tsx) and kept on the
// audit row -- and "ok" or "checked" is refused, which is the entire point.
//
// AND WHY IT MATTERS MORE ON THE LIPA RAIL THAN ANYWHERE ELSE: a wrong Lipa
// attestation is PERMANENTLY INVISIBLE. Reversing sets the payment `failed`,
// which takes it out of LipaPayment.IN_FLIGHT for good -- reconcile_lipa
// filters on IN_FLIGHT and never looks at the row again, and no detector
// watches a terminal row. The copy below says that, in those words, where the
// person filing it reads it.
"use client";
import * as React from "react";
import Link from "next/link";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createActionRequest,
  extractOpsErrorMessage,
} from "@/lib/darajaActions";

export const LIPA_REVERSE = "lipa.reverse";
export const CARDTOPUP_REVERSE = "cardtopup.reverse";

/**
 * dashboard/actions/reversals.py MIN_EVIDENCE.
 *
 * Mirrored here so a short statement is caught in front of the person who
 * typed it, with the input still on screen, instead of coming back as a 400
 * that closes nothing but loses their typing. The backend remains the
 * authority -- this never relaxes it, and a statement that passes here and
 * is still refused there is shown as the refusal it is.
 */
export const MIN_EVIDENCE = 20;

type ReversalKind = "lipa" | "cardtopup";

type Copy = {
  actionType: string;
  /** The panel heading: the FAILURE, not the control. */
  title: string;
  /** The modal's own heading -- what the operator is about to file. */
  modalTitle: string;
  /** What this returns, and what to check before filing it at all. */
  intro: React.ReactNode;
  idLabel: string;
  idHelp: React.ReactNode;
  idPlaceholder: string;
  /** The prompt above the textarea: what to search, where, what was seen. */
  evidencePrompt: string;
  evidencePlaceholder: string;
  /** The facts an operator must have read BEFORE filing, not after. */
  consequences: React.ReactNode;
};

const COPY: Record<ReversalKind, Copy> = {
  lipa: {
    actionType: LIPA_REVERSE,
    title: "A Lipa Namba till payment that did not land",
    modalTitle: "Request reversal: return a Lipa Namba payment's shillings",
    intro: (
      <>
        This returns the merchant&rsquo;s shillings for a till payment nTZS
        never made. Before filing one, check that{" "}
        <code className="font-mono">reconcile_lipa</code> is actually running:
        it settles stuck payments on its own cadence, and a payment that is
        merely waiting for it is not a payment to reverse. A payment touched
        in the last few minutes is refused outright, by the same grace the
        shell command enforces.
      </>
    ),
    idLabel: "Payment id",
    idHelp: (
      <>
        <span className="font-mono">payment_id</span>, NOT the expense id. It
        is also the Idempotency-Key sent to nTZS and the reference on both
        ledger movements, so it is the one string that ties the merchant&rsquo;s
        expense, our ledger and nTZS&rsquo;s own screen together &mdash; and it
        is what you search nTZS for.
      </>
    ),
    idPlaceholder: "the payment_id / nTZS Idempotency-Key",
    evidencePrompt:
      "What did you search, where, and what did you see? Nothing in this "
      + "system can prove nTZS did not pay this till, so the reversal rests "
      + "entirely on this statement. A second ops.admin approves against it, "
      + "and it is the only record of why this merchant's money came back.",
    evidencePlaceholder:
      "nTZS dashboard, searched Idempotency-Key <payment id>, no payment "
      + "listed, checked 14:05 EAT",
    consequences: (
      <>
        <p>
          <span className="font-semibold text-danger-fg">
            This system cannot verify what you type.
          </span>{" "}
          A timeout is exactly the case where nTZS may have paid the till. If
          it did, the money is gone twice: Daraja&rsquo;s nTZS treasury paid
          the supplier AND this merchant gets their shillings back.
        </p>
        <p>
          <span className="font-semibold text-danger-fg">
            A wrong attestation here is permanently invisible.
          </span>{" "}
          Reversing sets the payment <span className="font-mono">failed</span>,
          which takes it out of the in-flight set for good &mdash;{" "}
          <code className="font-mono">reconcile_lipa</code> never looks at a
          terminal row again and no detector watches one. Nothing in this
          system will ever say the claim was wrong.
        </p>
      </>
    ),
  },
  cardtopup: {
    actionType: CARDTOPUP_REVERSE,
    title: "A card top-up that stranded",
    modalTitle: "Request reversal: return a card top-up's shillings",
    intro: (
      <>
        This returns the shillings for a stranded or half-finished card
        top-up &mdash; a top-up whose TZS left the merchant&rsquo;s wallet and
        whose dollars never arrived at Nuvion. Only a{" "}
        <span className="font-mono">STRANDED</span> or{" "}
        <span className="font-mono">TZS_DEBITED</span> top-up can be reversed
        from here.
      </>
    ),
    idLabel: "Top-up id",
    idHelp: (
      <>
        <span className="font-mono">topup_id</span> &mdash; the reference on
        the ledger debit, and the Nuvion idempotency key, so it is what you
        search Nuvion&rsquo;s transfers for. Card loads are listed on this
        merchant&rsquo;s Activity tab.
      </>
    ),
    idPlaceholder: "the topup_id",
    evidencePrompt:
      "What did you search, where, and what did you see? Nothing in this "
      + "system can prove Nuvion did not deliver the dollars, so the reversal "
      + "rests entirely on this statement. A second ops.admin approves "
      + "against it, and it is the only record of why this merchant's money "
      + "came back.",
    evidencePlaceholder:
      "Nuvion transfers, searched topup_id <id>, no transfer listed, card "
      + "balance still $0, checked 15:20 EAT",
    consequences: (
      <>
        <p>
          <span className="font-semibold text-danger-fg">
            This system cannot verify what you type.
          </span>{" "}
          A strand on a Nuvion TIMEOUT is exactly the case where the dollars
          may have been delivered. If they were, the loss lands on BOTH legs
          at once: the merchant gets the shillings back AND keeps the dollars
          on the card. There is no path in this codebase that moves USD back
          out of a merchant&rsquo;s Nuvion account.
        </p>
        <p>
          <span className="font-semibold">
            This does NOT close the top-up, and it is not meant to.
          </span>{" "}
          CardTopUp has no reversed state, and{" "}
          <span className="font-mono">FAILED</span> is the saga&rsquo;s promise
          that nothing ever left the merchant&rsquo;s wallet &mdash; false the
          moment this runs. A{" "}
          <code className="font-mono">manage.py reconcile_topup</code>{" "}
          follow-up is REQUIRED afterwards to close the row and release any
          cards it holds. The approver is shown the exact command, and so is
          whoever reads the request after it is approved.
        </p>
        <p className="text-text-muted">
          A <span className="font-mono">RESERVED</span> top-up is refused here
          on purpose: reversing one means stranding it first, which calls
          Nuvion over HTTP to freeze this merchant&rsquo;s cards &mdash;
          outside any transaction, best-effort, partly-done on failure by
          design. That belongs on the shell:{" "}
          <code className="font-mono select-all">
            manage.py reverse_card_topup --topup-id &lt;id&gt;
            --confirm-not-funded-at-nuvion
          </code>
          .
        </p>
      </>
    ),
  },
};

/**
 * The panel, and the modal behind it, for one rail.
 *
 * `may` is the caller's answer from the action catalogue -- computed with the
 * same `_may()` the create endpoint checks, "so the UI never renders a button
 * that would 403" (ActionCatalogue's own docstring). Rendered as nothing at
 * all when false, rather than as a button that cannot be used.
 */
export function ReversalPanel({
  kind,
  may,
}: {
  kind: ReversalKind;
  may: boolean;
}) {
  const copy = COPY[kind];
  const [open, setOpen] = React.useState(false);
  const [targetRef, setTargetRef] = React.useState("");
  const [evidence, setEvidence] = React.useState("");
  const [note, setNote] = React.useState("");
  const [idError, setIdError] = React.useState<string | null>(null);
  const [evidenceError, setEvidenceError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [requested, setRequested] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      // Deliberately NOT cleared while the modal is open, including after a
      // failed submit: a refusal ("the row was touched two minutes ago, wait
      // and file this again") must not cost the operator the paragraph they
      // just wrote about what they saw on the provider's dashboard.
      setTargetRef("");
      setEvidence("");
      setNote("");
      setIdError(null);
      setEvidenceError(null);
      setFormError(null);
    }
  }, [open]);

  const typed = evidence.trim();

  async function submit(reason: string) {
    setIdError(null);
    setEvidenceError(null);
    setFormError(null);

    const ref = targetRef.trim();
    let bad = false;
    if (!ref) {
      setIdError(`Enter the ${copy.idLabel.toLowerCase()} to reverse.`);
      bad = true;
    }
    // The backend's own rule, mirrored: non-blank, and at least
    // MIN_EVIDENCE characters. Checked HERE so a short statement never costs
    // someone their typing to a 400.
    if (!typed) {
      setEvidenceError(
        "Evidence is required. Nothing in this system can check this claim, "
        + "so the reversal rests entirely on what you looked at.",
      );
      bad = true;
    } else if (typed.length < MIN_EVIDENCE) {
      setEvidenceError(
        `That is ${typed.length} characters; at least ${MIN_EVIDENCE} are `
        + `required. This is the statement a second ops.admin approves `
        + `against, and the only record of why a merchant's money came back `
        + `-- say what you searched, where, and when.`,
      );
      bad = true;
    }
    if (bad) throw new Error("incomplete"); // keeps the modal open

    try {
      await createActionRequest({
        action_type: copy.actionType,
        // The PAYMENT's or TOP-UP's own id -- `lipa.reverse` is target_type
        // "LipaPayment" and `cardtopup.reverse` is target_type "CardTopUp"
        // (dashboard/actions/reversals.py), so target_ref is a payment_id or
        // a topup_id, never the merchant's employer_id.
        target_ref: ref,
        // `evidence` is sent as the operator typed it, trimmed and nothing
        // else: it is a statement about what a human saw, and this screen
        // does not edit, truncate or summarise one. `note` is omitted rather
        // than sent empty when it was left blank.
        params: note.trim()
          ? { evidence: typed, note: note.trim() }
          : { evidence: typed },
        reason,
      });
      setRequested(
        `Request created for ${ref}. NOTHING HAS BEEN RETURNED YET -- no `
        + `money has moved and this merchant's row is unchanged. A different `
        + `ops.admin must read your statement and approve it from the Actions `
        + `queue within the hour, or it expires and nothing happens at all.`,
      );
      // DangerousActionModal closes itself once onConfirm resolves, and the
      // effect on `open` is what clears the inputs -- including the statement,
      // which must survive a REFUSAL but not outlive a filed request.
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not create the request.");
      setFormError(msg);
      throw new Error(msg); // keeps the modal open so the error is visible
    }
  }

  if (!may) return null;

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

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{copy.intro}</p>
          <p className="text-text-muted">
            Filing this changes nothing. It stores a request a different
            ops.admin must approve from the Actions queue within the hour, or
            it expires and nothing happens at all.
          </p>
          <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
            Request reversal
          </Button>
        </CardContent>
      </Card>

      <DangerousActionModal
        open={open}
        onOpenChange={setOpen}
        title={copy.modalTitle}
        confirmLabel="Create request"
        requireReason
        onConfirm={submit}
        impact={
          <div className="flex flex-col gap-3">
            <p>
              This only CREATES a request -- no money moves and nothing on this
              merchant&rsquo;s row changes. A different ops.admin must review
              your statement and approve it from the Actions queue within one
              hour, or it expires and nothing happens.
            </p>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reversal-target-ref">{copy.idLabel}</Label>
              <Input
                id="reversal-target-ref"
                value={targetRef}
                onChange={(e) => setTargetRef(e.target.value)}
                placeholder={copy.idPlaceholder}
                aria-invalid={idError ? true : undefined}
              />
              <p className="text-xs text-text-muted">{copy.idHelp}</p>
              {idError ? <p className="text-danger-fg">{idError}</p> : null}
            </div>

            {/* THE POINT OF THIS WHOLE SCREEN. A textarea with a prompt, never
                a checkbox: see this file's header comment. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reversal-evidence">
                What you checked at the provider
              </Label>
              <p className="text-xs text-text-muted">{copy.evidencePrompt}</p>
              <Textarea
                id="reversal-evidence"
                className="min-h-28"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder={copy.evidencePlaceholder}
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reversal-note">Note for the row (optional)</Label>
              <Input
                id="reversal-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ticket reference, or anything the next reader needs"
              />
              <p className="text-xs text-text-muted">
                Lands on the payment&rsquo;s own row beside the attestation,
                and on the approver&rsquo;s preview. The Reason below is stored
                on the request itself.
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-card border-2 border-danger-fg bg-danger-bg/40 p-3">
              {copy.consequences}
            </div>

            <p className="text-xs text-text-muted">
              The approver sees your statement verbatim, both legs of the
              ledger movement being undone, and every warning, on the request
              itself. Every refusal the shell command makes is made here too:
              a settled payment, an already-reversed one, a swept wallet or a
              row touched inside the grace is refused outright, and nothing is
              written.
            </p>

            {formError ? <p className="text-danger-fg">{formError}</p> : null}
          </div>
        }
      />
    </>
  );
}
