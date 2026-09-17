// lib/darajaMoney.ts -- the ops console's own money formatter.
//
// WHY THIS IS NOT `formatMoney` FROM lib/format.ts, AND WHY THAT FILE WAS NOT
// CHANGED. `lib/format.ts` is shared with the Ankara integration -- loans,
// subscriptions, organizations, transactions, some forty call sites on screens
// this plan has never reviewed. Its `formatNumber` is
// `Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })`, so it rounds
// every figure to whole shillings. Relaxing that would move numbers on all of
// those screens at once; the ops screens get their own formatter instead.
//
// WHAT WAS WRONG WITH ROUNDING HERE. Fractional TZS is real in this system,
// not theoretical. `Entry.amount` and `DepositIntent.amount` are
// DecimalField(20,2) (wallets/models.py) and `CardTopUp.tzs_amount` is
// DecimalField(20,2) derived from a captured USD rate (cards/models.py:156),
// whose ledger legs land in `Entry`. So:
//
//   - a 2,512.47 card load rendered "TZS 2,512" on the Statement and in
//     Activity, and an operator reconciling those rows against the balance
//     card found they did not add up, with nothing on screen saying why;
//   - a 0.30 residue rendered "TZS 0" -- a real, non-zero amount displayed as
//     zero. Nobody investigates a zero. That is the same failure this plan has
//     already shipped once on the backend, arriving by rounding instead of by
//     a default.
//
// THE RULES THIS FILE OBEYS.
//
//  1. NO ARITHMETIC ON MONEY. The value arrives from DRF as a decimal STRING
//     and is grouped and trimmed as text. There is no Number(), no
//     parseFloat(), no toFixed(), no `|| 0`. A digit the backend sent cannot
//     be lost on the way to the screen because nothing here converts.
//  2. A NON-ZERO AMOUNT NEVER RENDERS AS ZERO. Nothing is rounded away: every
//     significant digit the backend sent is shown. `CollectionAccount.balance`
//     is DecimalField(50,5), so a summed balance arrives as "51738.43000";
//     trailing zeros are dropped (they assert nothing) but a fifth-place 1 is
//     not.
//  3. WHAT CANNOT BE READ IS NOT GUESSED. A missing, null or non-decimal value
//     renders `UNKNOWN_AMOUNT`, never a number. A zero is an assertion about a
//     merchant's money and is displayed only when the backend actually said
//     zero.
//
// Amounts may be negative -- `Entry.amount` is signed, positive credits and
// negative debits (wallets/models.py:78) -- so the sign is preserved, in the
// same position the shared formatter put it: "TZS -2,512.47".

/** What a money cell shows when the value cannot be read. Not "0". */
export const UNKNOWN_AMOUNT = "—";

// DRF renders a DecimalField as plain decimal text: optional sign, digits,
// optionally a dot and more digits. No exponent, no thousands separators, no
// currency symbol. Anything else is not a money figure this screen can read.
const DECIMAL_TEXT = /^-?\d+(?:\.\d+)?$/;

/** Thousands separators, inserted into a run of digits as text. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * The digits to display for one amount, or null if it cannot be read.
 *
 * Exported for the one caller that needs the amount without the "TZS" prefix;
 * `formatOpsMoney` is what screens normally use.
 */
export function opsAmountDigits(value: string | number): string | null {
  let raw: string | null = null;
  if (typeof value === "number") {
    // `Expenses.amount` is the one money field on these tabs that arrives as a
    // JSON number (FloatField, expenses/models.py:39). String() is exact for
    // every value this system produces; only |n| >= 1e21 or < 1e-6 takes
    // JavaScript to exponent notation, and neither is a shilling amount. Such
    // a value fails the test below and is refused rather than guessed at --
    // as are NaN and Infinity, which is what an absent field used to become
    // on its way to rendering "TZS 0".
    raw = String(value);
  } else if (typeof value === "string") {
    raw = value.trim();
  }
  if (raw === null || !DECIMAL_TEXT.test(raw)) return null;

  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = (negative ? raw.slice(1) : raw).split(".");
  // Trailing zeros are an artefact of the column width (a 50,5 balance always
  // arrives with five places), not information. What remains is kept in full:
  // never rounded, never truncated to two places, because the digit dropped
  // would be a digit of somebody's money.
  const significant = fraction.replace(/0+$/, "");
  // A fraction is padded UP to the customary two places -- 0.3 reads as a
  // typo where 0.30 reads as money -- but never padded down.
  const shown =
    significant === ""
      ? ""
      : significant.length === 1
        ? `${significant}0`
        : significant;

  const body = shown ? `${groupThousands(whole)}.${shown}` : groupThousands(whole);
  return negative ? `-${body}` : body;
}

/**
 * "TZS 2,512.47" -- an amount as the backend stated it, or `UNKNOWN_AMOUNT`.
 *
 * Pass the string DRF sent, unconverted. Never coerce it first: `Number()` on
 * the way in is how a real figure becomes NaN, and NaN is how a merchant's
 * money becomes "TZS 0".
 */
export function formatOpsMoney(value: string | number): string {
  const digits = opsAmountDigits(value);
  return digits === null ? UNKNOWN_AMOUNT : `TZS ${digits}`;
}
