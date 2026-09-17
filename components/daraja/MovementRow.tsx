// components/daraja/MovementRow.tsx
//
// One movement, with its legs beneath it. This is the unit the ledger explorer
// exists to make legible: a `lipa_payout` has to read as
//
//     Mama Ntilie Kitchen   debit    TZS -1,065.00
//     lipa_namba (house)    credit   +TZS 1,060.00
//     revenue    (house)    credit   +TZS 5.00
//
// at a glance, with no arithmetic asked of the operator.
//
// THE SIGN IS THE INFORMATION. `LedgerLeg.amount` is signed -- negative debits
// the account (wallets/models.py, and types/daraja.ts:319). It is never
// abs()'d, never stripped, and the direction is stated three redundant ways --
// the sign itself, a colour, and the words "debit"/"credit" -- so an operator
// does not have to spot a minus glyph in a column of digits to know which way
// the money went.
//
// NO ARITHMETIC ON MONEY, INCLUDING NO TOTAL. This component deliberately does
// NOT sum the legs into a "balanced / out by X" line, tempting as that is for a
// double-entry screen. Summing means parsing decimal strings into JS numbers,
// which is the exact coercion lib/darajaMoney.ts exists to keep away from these
// figures (a 0.30 residue becoming "TZS 0"). A movement's legs are shown in
// full and the reader can see they answer each other; the screen does not
// compute a second, weaker claim about them. Direction is read as TEXT --
// `amount.startsWith("-")` -- not by comparing a parsed number to zero.
//
// AN UNREADABLE AMOUNT MAKES NO CLAIM. If a leg's amount is absent or not
// decimal text, formatOpsMoney renders UNKNOWN_AMOUNT and this row renders NO
// debit/credit label and no colour -- "I cannot read this" is a different fact
// from "this is a debit", and guessing a direction from an unparseable string
// is how a screen states something the backend never said.
"use client";

import { formatOpsMoney, UNKNOWN_AMOUNT } from "@/lib/darajaMoney";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LedgerLeg, MovementRow as MovementRowData } from "@/types/daraja";

// The type is imported under an alias rather than redefined: `MovementRow` is
// both this file's component and the shape in types/daraja.ts, and that shape
// was verified field-by-field against the backend serializer. Re-declaring or
// widening it locally is how two files come to disagree about one payload.

type LegDirection = "debit" | "credit" | "unknown";

/**
 * Which way this leg moved the account, decided ON THE STRING.
 *
 * `formatOpsMoney` is the single authority on whether a money value is
 * readable at all -- asking it first means this function cannot call something
 * a "credit" that the amount column is simultaneously rendering as "—".
 */
export function legDirection(amount: string | null | undefined): LegDirection {
  if (formatOpsMoney(amount) === UNKNOWN_AMOUNT) return "unknown";
  return String(amount).trim().startsWith("-") ? "debit" : "credit";
}

/**
 * What to call the account this leg touched.
 *
 * A NULL `business_name` USED TO MEAN "HOUSE ACCOUNT" HERE, AND THAT RULE WAS
 * WRONG. `Employer.business_name` is `blank=True, null=True` and this database
 * holds such rows, so a real merchant can arrive with a null name -- and this
 * screen rendered them as one of Daraja's own accounts. On the one screen
 * built to attribute money correctly, that is the worst thing it could say.
 *
 * The house question is now answered by `is_house_account`, which the backend
 * derives from `account.wallet_id is None` (dashboard/views/ledger.py:238) --
 * from whether there is a merchant behind the account at all, not from
 * whether one has been named and not from the account's kind. Three cases:
 *
 *   is_house_account: true   -> Daraja's own money; named by kind and id,
 *                               because rendering blank would make the
 *                               commonest legs in the ledger look broken.
 *   false + a name           -> that merchant.
 *   false + null             -> A MERCHANT WITH NO NAME ON FILE. Merchant
 *                               money, said so in words.
 */
export function legAccountLabel(leg: LedgerLeg): string {
  const name = leg.business_name?.trim();
  if (name) return name;
  if (leg.is_house_account) {
    return `${leg.account_kind} · ${leg.account_id.slice(0, 8)}`;
  }
  return `Unnamed merchant · ${leg.account_id.slice(0, 8)}`;
}

/**
 * The short label beside the account name, or null when the name says it all.
 *
 * Stated explicitly rather than implied by a blank name: whose money a leg
 * touched is a fact about the movement, not an absence. An unnamed merchant
 * gets a label of its own precisely so it cannot be read as the house.
 */
export function legAccountBadge(leg: LedgerLeg): string | null {
  if (leg.is_house_account) return "house account";
  if (leg.business_name?.trim()) return null;
  return "merchant — no name on file";
}

const DIRECTION_TEXT: Record<LegDirection, string> = {
  debit: "text-danger-fg",
  // `text-success-fg` is #FFFFFF -- it is the foreground for use ON a green
  // badge, not a text colour for a white surface, and would render an
  // invisible credit. `text-brand` (#33993C) is the green that is actually
  // legible here (app/globals.css).
  credit: "text-brand",
  unknown: "text-text-faint",
};

function Leg({ leg }: { leg: LedgerLeg }) {
  const direction = legDirection(leg.amount);
  const amount = formatOpsMoney(leg.amount);
  const badge = legAccountBadge(leg);

  return (
    <li className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm text-text">{legAccountLabel(leg)}</span>
        {/* Keyed off `is_house_account`, NEVER off `business_name === null`,
            which is what used to render a nameless merchant's money as
            Daraja's own. See legAccountBadge. */}
        {badge ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-faint">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-baseline gap-2">
        {direction === "unknown" ? null : (
          <span className="text-[10px] uppercase tracking-wide text-text-muted">
            {direction}
          </span>
        )}
        <span className={cn("font-mono text-sm tabular-nums", DIRECTION_TEXT[direction])}>
          {/* The "+" is a display glyph on an already-formatted string, never
              arithmetic, and is never attached to an amount that could not be
              read (that one renders "—" and claims no direction). */}
          {direction === "credit" ? "+" : ""}
          {amount}
        </span>
      </span>
    </li>
  );
}

export function MovementRow({ movement }: { movement: MovementRowData }) {
  return (
    <li className="rounded-card border border-border-soft bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <span className="font-heading text-sm font-semibold text-text">
            {/* Movement.kind is a free string -- `post(kind, reference, legs)`
                takes anything and there is no enum (wallets/services/ledger.py),
                so it is shown as the backend stated it, never mapped through a
                label table that a new kind would fall out of. */}
            {movement.kind || "—"}
          </span>
          {/* Movement.reference is `blank=True, default=""` (wallets/models.py):
              a movement recorded without one is ordinary and used to render a
              blank cell that reads as a broken screen. `||`, not `??` -- the
              empty string is the live value here, as on the wallet statement. */}
          <span className="truncate font-mono text-xs text-text-muted">
            {movement.reference || "—"}
          </span>
        </div>
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="text-xs text-text-muted">
            {formatDateTime(movement.created)}
          </span>
          <span className="font-mono text-[10px] text-text-faint">
            {movement.movement_id.slice(0, 8)}
          </span>
        </div>
      </div>

      {movement.legs.length === 0 ? (
        // A movement with no legs is not a normal state, and it is reported as
        // itself rather than as an empty space that reads like a render bug.
        <p className="mt-2 text-xs text-text-faint">No legs recorded on this movement.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border-soft border-t border-border-soft">
          {movement.legs.map((leg) => (
            <Leg key={leg.entry_id} leg={leg} />
          ))}
        </ul>
      )}
    </li>
  );
}
