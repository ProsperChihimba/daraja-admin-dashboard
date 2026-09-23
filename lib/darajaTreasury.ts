// lib/darajaTreasury.ts -- GET /dashboard/treasury/ (dashboard/views/treasury.py).
//
// Daraja's own internal wallets (Card Top-ups, Lipa Namba, the float
// account), read-only. This is where an operator sees whether a sweep
// (dashboard.actions.treasury) is worth REQUESTING -- the request itself
// goes through the existing lib/darajaActions.ts createActionRequest, not
// through anything in this file.
//
// THE SHAPE BELOW IS COPIED FIELD-FOR-FIELD FROM
// dashboard/views/treasury.py (_designated_wallet_row / _float_row /
// Treasury.get), not guessed at, because a typo here is a silently empty
// column tsc cannot catch:
//
//   key, name, designated, balance, reserved, sweepable, action, reason
//
// NULL-OVER-ZERO, on purpose, matching that view's own docstring:
//
//   - `balance`/`reserved`/`sweepable` are `null` when this wallet is
//     unreadable (undesignated, or DuplicateSystemAccount for the float
//     row) -- NEVER "0.00" standing in for "nobody set this up". `reason`
//     explains why. A real empty wallet reports "0.00", a real number.
//   - `action` is the action_type to send to createActionRequest
//     ("treasury.sweep_card_topups" / "treasury.sweep_lipa_payouts"), or
//     `null` for the float row, which is never itself swept from here.
//   - `reserved` is non-null ONLY for the Lipa row today (money already
//     committed to unsettled Lipa payments, via _lipa_in_flight) -- Card
//     Top-ups and the float row always send `reserved: null`, meaning "no
//     reserve concept for this wallet", not "zero reserved".
//
// Every money field is the DecimalField-as-string DRF sends
// (`_money()` -- always two places, e.g. "12345.67"). Hand it to
// formatOpsMoney untouched; never Number()/parseFloat()/toFixed().
import darajaApi from "@/lib/darajaApi";

export type TreasuryWallet = {
  key: string;
  name: string;
  designated: boolean;
  balance: string | null;
  reserved: string | null;
  sweepable: string | null;
  action: string | null;
  reason: string | null;
};

export type TreasuryResponse = {
  wallets: TreasuryWallet[];
};

export const TREASURY_PATH = "/treasury/";

/** GET /dashboard/treasury/ -- the three internal wallets and their
 * live ledger balances. Read-only; requesting a sweep is a separate
 * call through lib/darajaActions.ts's createActionRequest. */
export async function listTreasury(): Promise<TreasuryResponse> {
  const { data } = await darajaApi.get<TreasuryResponse>(TREASURY_PATH);
  return data;
}
