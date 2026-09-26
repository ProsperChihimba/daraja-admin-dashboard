// lib/darajaTreasury.ts -- GET /dashboard/treasury/ (dashboard/views/treasury.py).
//
// Daraja's own internal wallets -- Card Top-ups, Lipa Namba, the float
// account, Revenue, Pool, Suspense and (when it still holds something) the
// pre-designation Revenue account -- read-only. This is where an operator
// SEES where the company's money is, and, for the two sweepable wallets,
// whether a sweep (dashboard.actions.treasury) is worth REQUESTING -- the
// request itself goes through the existing lib/darajaActions.ts
// createActionRequest, not through anything in this file.
//
// THE SHAPE BELOW IS COPIED FIELD-FOR-FIELD FROM
// dashboard/views/treasury.py (_designated_wallet_row / _float_row /
// _system_row / _old_revenue_row / Treasury.get), not guessed at, because a
// typo here is a silently empty column tsc cannot catch:
//
//   key, name, designated, balance, reserved, sweepable, action, reason,
//   note (optional)
//
// NULL-OVER-ZERO, on purpose, matching that view's own docstring:
//
//   - `balance`/`reserved`/`sweepable` are `null` when this wallet is
//     unreadable (undesignated, or DuplicateSystemAccount for a system
//     account) -- NEVER "0.00" standing in for "nobody set this up".
//     `reason` explains why. A real empty wallet reports "0.00", a real
//     number.
//   - `action` is the action_type to send to createActionRequest
//     ("treasury.sweep_card_topups" / "treasury.sweep_lipa_payouts"), or
//     `null` for a row with no sweep command -- the float row, and (since
//     the endpoint grew to show where the company's money actually is,
//     not only the two sweepable wallets) Revenue, Pool, Suspense and the
//     pre-designation Revenue row. None of those five is ever swept from
//     here.
//   - `reserved` is non-null ONLY for the Lipa row today (money already
//     committed to unsettled Lipa payments, via _lipa_in_flight) -- every
//     other row always sends `reserved: null`, meaning "no reserve concept
//     for this wallet", not "zero reserved".
//   - `note`, when present, is a call-out beyond the number -- today only
//     Suspense, and only when its balance is non-zero: money nobody could
//     attribute to a wallet, worth acting on rather than just sweeping.
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
  note?: string | null;
};

// One provider's own account balance -- today only Nuvion's Liquidity
// account, the USD pool that funds card issuing ($0.50/card) and every
// top-up. Field-for-field from dashboard/views/treasury.py's `_nuvion_row`:
//
//   key, name, balance, currency, measured_at, age_seconds, stale, error,
//   account_ref
//
// `balance` is a decimal STRING in MAJOR units ("1270.84"), paired with
// `currency` -- NEVER render it through `formatOpsMoney` (that formatter is
// hardcoded "TZS"), use `formatOpsMoneyAs(row.currency, row.balance)`
// instead. `balance` is `null` -- never "0.00" -- whenever no reading has
// ever been taken, or the reading itself failed; `error` explains why, and
// `stale` is true in both of those cases as well as whenever the newest
// reading is older than 30 minutes. The endpoint never calls the provider on
// an ordinary load; only `?live=1` does.
export type ProviderBalanceRow = {
  key: string;
  name: string;
  balance: string | null;
  currency: string;
  measured_at: string | null;
  age_seconds: number | null;
  stale: boolean;
  error: string | null;
  account_ref: string;
};

/**
 * The platform's own price for a dollar, and who is NOT on it.
 *
 * Field-for-field from dashboard/views/treasury.py's `_rate_block`:
 *
 *   universal, note, set_at, override_holders, below_universal
 *
 * `universal` is the DecimalField(20,6)-as-string `_rate()` renders
 * ("2750.000000"), so it goes to `formatOpsRate` untouched -- never
 * `Number()`/`parseFloat()`/`toFixed()`, because rounding this number in a
 * browser is rounding the price of every top-up, expense and payout quote on
 * the platform.
 *
 * `universal`/`note`/`set_at` are ALL null together, and only in one state: no
 * universal rate has ever been set. That is not an error and must not render as
 * a zero -- with no rate configured `rate_for` raises `NoRateConfigured` and
 * nothing can price anything, which is precisely what someone would open this
 * screen to diagnose. `note` may also be an empty STRING on a real rate
 * (`ConversionRate.note` is blank=True, and `set_conversion_rate --note`
 * defaults to ""), so read it with `||`, not `??`.
 *
 * `override_holders` counts merchants on a live `EmployerConversionRate`;
 * `below_universal` counts how many OF THOSE sit below `universal`. Both come
 * from the same `override_holders()`/`holders_below()` that
 * `pricing.set_universal_rate`'s preview and the `client_rate_below_universal`
 * alert use, so this screen can never disagree with either. `below_universal`
 * is 0 when there is no universal rate at all -- nothing to compare an override
 * against -- not because nobody is underwater. NEITHER IS RECOMPUTED HERE.
 */
export type TreasuryRate = {
  universal: string | null;
  note: string | null;
  set_at: string | null;
  override_holders: number;
  below_universal: number;
};

export type TreasuryResponse = {
  wallets: TreasuryWallet[];
  providers: ProviderBalanceRow[];
  /**
   * Typed non-optional (the deployed backend sends it) but read as though it
   * might be absent -- the same treatment, for the same reason, as
   * `MerchantDetail.rate`. A console deployed ahead of the backend that added
   * this key must SAY it cannot read the rate rather than draw the card of a
   * platform with no rate configured: that would be a claim about what every
   * merchant is charged.
   */
  rate: TreasuryRate;
};

export const TREASURY_PATH = "/treasury/";

/** GET /dashboard/treasury/ -- the three internal wallets and their
 * live ledger balances. Read-only; requesting a sweep is a separate
 * call through lib/darajaActions.ts's createActionRequest. */
export async function listTreasury(): Promise<TreasuryResponse> {
  const { data } = await darajaApi.get<TreasuryResponse>(TREASURY_PATH);
  return data;
}

/**
 * GET /dashboard/treasury/?live=1 -- the ONE call on this screen allowed to
 * reach Nuvion. Mirrors the Ledger page's own live re-fetch
 * (`refetchPosition({ live: "1" })` in app/daraja/(ops)/ledger/page.tsx),
 * which exists for the exact same reason: the ordinary load must never call
 * a provider that has been throttled for excessive lookups, so only an
 * operator's explicit click may.
 *
 * Returns the WHOLE response, `wallets` included -- the backend recomputes
 * that side too, but nothing about it needs a network call either way, so
 * there is no reason to special-case it out. Callers that only care about
 * the provider figures read `.providers` off the result.
 */
export async function refreshTreasuryLive(): Promise<TreasuryResponse> {
  const { data } = await darajaApi.get<TreasuryResponse>(TREASURY_PATH, {
    params: { live: "1" },
  });
  return data;
}
