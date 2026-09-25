// components/daraja/CardsTab.tsx -- a merchant's cards, and the first UI in
// this system that can place or lift an OPS hold on one.
//
// NOTHING HERE FREEZES A CARD. Both buttons only ever POST
// /dashboard/actions/requests/, which per that view's own docstring "does NOT
// execute": they store a row a DIFFERENT ops.admin must approve from the
// Actions queue within the hour, or it expires and nothing happens at all.
// Same shape, and the same reason, as the merchant Activate/Suspend buttons
// (app/daraja/(ops)/merchants/[id]/page.tsx). The labels say "Request" and the
// confirmation says it again, because an operator who thinks a compromised
// card has just been stopped -- when in fact it is still spending until a
// second admin clicks approve -- is the expensive misunderstanding here.
//
// WHY AN OPS FREEZE IS NOT THE EMPLOYER'S FREEZE. It sets `frozen_reason` to
// 'ops', which the employer CANNOT lift from the app (dashboard/actions/
// cards.py); only another ops unfreeze releases it. And it never weakens a
// hold that is already stronger: a card held 'unreconciled' stays
// 'unreconciled'. The preview the approver sees carries those warnings -- the
// copy below points at them rather than restating them, so there is one place
// they can go stale.
"use client";
import * as React from "react";
import Link from "next/link";
import { CursorList } from "@/components/daraja/CursorList";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import {
  createActionRequest,
  extractOpsErrorMessage,
  getActionCatalogue,
  type ActionCatalogueEntry,
} from "@/lib/darajaActions";
import type { CardRow } from "@/types/daraja";

const FREEZE = "card.freeze";
const UNFREEZE = "card.unfreeze";

type Pending = { card: CardRow; actionType: typeof FREEZE | typeof UNFREEZE };

export function CardsTab({ employerId }: { employerId: string }) {
  const [catalogue, setCatalogue] = React.useState<ActionCatalogueEntry[] | null>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [requested, setRequested] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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

  async function submit(p: Pending, reason: string) {
    try {
      await createActionRequest({
        action_type: p.actionType,
        // The CARD's id, not the merchant's: `card.freeze`/`card.unfreeze`
        // are target_type "Card" and their target_ref is a card_id
        // (dashboard/actions/cards.py `_load`).
        target_ref: p.card.card_id,
        reason,
      });
      setError(null);
      setRequested(
        `Request created for card ${p.card.card_id}. NOTHING HAS HAPPENED YET `
        + `-- the card is still ${p.card.status}. A different ops.admin must `
        + `approve it from the Actions queue within the hour, or it expires `
        + `and nothing happens at all. If this card is compromised, it is `
        + `still spending until then.`,
      );
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not create the request.");
      setError(msg);
      throw new Error(msg); // keeps the modal open so the error is visible
    }
  }

  const showOps = may(FREEZE) || may(UNFREEZE);

  return (
    <>
      {requested ? (
        <Card className="mb-4 border border-brand">
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

      {error ? <p className="mb-2 text-xs text-danger-fg">{error}</p> : null}

      <CursorList<CardRow>
        path={`/employers/${employerId}/cards/`}
        rowKey={(c) => c.card_id}
        emptyMessage="No cards issued."
        columns={[
          { key: "registered", header: "Issued",
            render: (c) => formatDateTime(c.registered) },
          { key: "card_id", header: "Card",
            render: (c) => <span className="font-mono text-xs">{c.card_id}</span> },
          { key: "status", header: "Status" },
          ...(showOps
            ? [{
                key: "ops",
                // Named for what the buttons DO -- file a request -- not
                // "Actions", which would read as though clicking one acts.
                header: "Ops request",
                render: (c: CardRow) => (
                  <div className="flex items-center gap-2">
                    {may(FREEZE) ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setPending({ card: c, actionType: FREEZE })}
                      >
                        Request freeze
                      </Button>
                    ) : null}
                    {may(UNFREEZE) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPending({ card: c, actionType: UNFREEZE })}
                      >
                        Request unfreeze
                      </Button>
                    ) : null}
                  </div>
                ),
              }]
            : []),
        ]}
      />

      {/* Mounted only while a card is chosen -- which also captures `pending`
          in a const the confirm handler can close over, so there is no
          non-null assertion on a value another click could have cleared. */}
      {pending ? (
        <DangerousActionModal
          open
          onOpenChange={(o) => { if (!o) setPending(null); }}
          title={
            pending.actionType === FREEZE
              ? `Request freeze: card ${pending.card.card_id}`
              : `Request unfreeze: card ${pending.card.card_id}`
          }
          confirmLabel="Create request"
          requireReason
          onConfirm={(reason) => submit(pending, reason)}
          impact={
            pending.actionType === FREEZE ? (
              <div className="flex flex-col gap-2">
                <p>
                  This only CREATES a request -- IT DOES NOT FREEZE THE CARD.
                  The card (status {pending.card.status}) keeps spending until
                  a different ops.admin approves this from the Actions queue,
                  within one hour, or it expires and nothing happens.
                </p>
                <p>
                  Once approved this places an OPS hold: the employer cannot
                  lift it from the app, only another ops unfreeze can. A hold
                  already in place for a stronger reason -- an unreconciled
                  top-up -- is kept, not relabelled. The approver sees the
                  exact before/after and every warning on the request itself.
                </p>
                <p>
                  Approving calls Nuvion. If Nuvion gives no usable answer the
                  execution lands in “unknown” and a human has to read Nuvion’s
                  own dashboard before it can be closed.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p>
                  This only CREATES a request -- IT DOES NOT UNFREEZE THE CARD.
                  It stays {pending.card.status} until a different ops.admin
                  approves this from the Actions queue, within one hour, or it
                  expires and nothing happens.
                </p>
                <p>
                  Once approved the card can spend again. A card held because a
                  top-up took the merchant’s money and never reconciled at
                  Nuvion cannot be released this way at all -- that request is
                  refused outright and names the command that can settle it.
                </p>
              </div>
            )
          }
        />
      ) : null}
    </>
  );
}
