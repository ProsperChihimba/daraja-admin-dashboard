// app/daraja/(ops)/merchants/[id]/page.tsx  (URL: /daraja/merchants/<id>)
//
// Deliberately NOT under app/(app)/ -- that group's layout wraps every page
// in RequireAuth, which gates on the Ankara superuser Redux session. A real
// ops account has no such session (create_ops_user never touches Ankara's
// auth), so RequireAuth would bounce it to /login on every navigation here.
// This page lives inside the Daraja route group instead
// (app/daraja/(ops)/layout.tsx, from Task 7), which guards on the Daraja
// session and renders the shared shell around it.
"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status_badge";
import { Button } from "@/components/ui/button";
import { ActivityTab } from "@/components/daraja/ActivityTab";
import { ExpensesTab } from "@/components/daraja/ExpensesTab";
import { WalletTab } from "@/components/daraja/WalletTab";
import { CardsTab } from "@/components/daraja/CardsTab";
import { PeopleTab } from "@/components/daraja/PeopleTab";
import { KycTab } from "@/components/daraja/KycTab";
import { formatDate } from "@/lib/format";
import { formatOpsMoney } from "@/lib/darajaMoney";
import { useDarajaResource } from "@/lib/darajaAuth";
import {
  createActionRequest,
  extractOpsErrorMessage,
  getActionCatalogue,
  type ActionCatalogueEntry,
} from "@/lib/darajaActions";
import { kycLabel, kycVariant } from "@/lib/kyc";
import type { MerchantDetail } from "@/types/daraja";

/**
 * Activate/Suspend used to be direct-executing buttons ("Merchant
 * activated", toast, done) on the Ankara equivalent
 * (components/org/SuspendActivateDialog.tsx) -- the exact pattern this
 * plan's dual-approval control exists to remove for money actions. Neither
 * button here calls an execute endpoint. Both only ever POST
 * /dashboard/actions/requests/, which -- per dashboard/views/actions.py's
 * own docstring -- "does NOT execute": it stores a row a DIFFERENT
 * ops.admin must separately approve within the hour
 * (dashboard/views/actions.py REQUEST_TTL). The copy below says exactly
 * that, on purpose, every time.
 */
function MerchantLifecycleActions({
  merchant,
  onRequested,
}: {
  merchant: MerchantDetail;
  onRequested: (message: string) => void;
}) {
  const [catalogue, setCatalogue] = React.useState<ActionCatalogueEntry[] | null>(null);
  const [open, setOpen] = React.useState<"activate" | "suspend" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    // "So the UI never renders a button that would 403" -- ActionCatalogue's
    // own docstring. `may_request` is computed with the same _may() the
    // create endpoint checks, so a button hidden here truly could not be
    // used, and one shown here truly can be tried.
    getActionCatalogue()
      .then((rows) => { if (!cancelled) setCatalogue(rows); })
      .catch(() => { if (!cancelled) setCatalogue([]); });
    return () => { cancelled = true; };
  }, []);

  const may = (actionType: string) =>
    catalogue?.some((c) => c.action_type === actionType && c.may_request) ?? false;

  async function submit(actionType: string, reason: string) {
    try {
      await createActionRequest({
        action_type: actionType,
        target_ref: merchant.employer_id,
        reason,
      });
      onRequested(
        `Request created. Nothing has happened yet -- ${
          merchant.business_name || "this merchant"
        } is still ${merchant.active ? "active" : "inactive"}. A different ops.admin `
        + `must approve it from the Actions queue within the hour, or it expires `
        + `and nothing happens at all.`,
      );
      setError(null);
    } catch (e) {
      setError(extractOpsErrorMessage(e, "Could not create the request."));
      throw e; // keeps the modal open so the error is visible
    }
  }

  if (catalogue === null) return null; // don't flash a button that might 403

  return (
    <>
      {!merchant.active && may("employer.approve") ? (
        <Button size="sm" onClick={() => setOpen("activate")}>Activate</Button>
      ) : null}
      {merchant.active && may("employer.suspend") ? (
        <Button size="sm" variant="destructive" onClick={() => setOpen("suspend")}>
          Suspend
        </Button>
      ) : null}

      {error ? <p className="text-xs text-danger-fg">{error}</p> : null}

      <DangerousActionModal
        open={open === "activate"}
        onOpenChange={(o) => setOpen(o ? "activate" : null)}
        title={`Request: activate ${merchant.business_name || merchant.employer_id}`}
        impact={
          <>
            This only CREATES a request -- it does not activate the merchant.
            A different ops.admin must review and approve it (from the Actions
            queue) within one hour, or it expires and nothing happens.
          </>
        }
        confirmLabel="Create request"
        requireReason
        onConfirm={(reason) => submit("employer.approve", reason)}
      />
      <DangerousActionModal
        open={open === "suspend"}
        onOpenChange={(o) => setOpen(o ? "suspend" : null)}
        title={`Request: suspend ${merchant.business_name || merchant.employer_id}`}
        impact={
          <>
            This only CREATES a request -- it does not suspend the merchant.
            A different ops.admin must review and approve it (from the Actions
            queue) within one hour, or it expires and nothing happens. Once
            approved, new payouts, expenses and card loads stop; anything
            already dispatched is not stopped and the wallet balance is
            untouched.
          </>
        }
        confirmLabel="Create request"
        requireReason
        onConfirm={(reason) => submit("employer.suspend", reason)}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      {/*
        `||`, not `??`. Every column below is `blank=True` on Employer and an
        EMPTY STRING is live data -- MASHTEMI was approved with TIN, licence,
        BRELA and email all blank -- which `??` renders as a blank cell that
        reads as a broken screen rather than as "not provided" (M1). Matches
        the account_no treatment below.
      */}
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-text">{value || "—"}</div>
    </div>
  );
}

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: m, loading, error, refetch } = useDarajaResource<MerchantDetail>(
    `/employers/${id}/`,
  );
  const [requestedMessage, setRequestedMessage] = React.useState<string | null>(null);

  if (error) {
    return (
      <>
        <PageHeader title="Merchant" />
        <ErrorState message={error} onRetry={refetch} />
      </>
    );
  }
  if (loading && !m) {
    return (
      <>
        <PageHeader title="Merchant" />
        <LoadingBlock />
      </>
    );
  }
  if (!m) return null;

  return (
    <>
      <PageHeader
        title={m.business_name ?? "Unnamed merchant"}
        subtitle={`${m.phone_number ?? "no phone"} · registered ${formatDate(m.registered)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge variant={m.active ? "success" : "neutral"}>
              {m.active ? "active" : "inactive"}
            </StatusBadge>
            <StatusBadge variant={kycVariant(m.kyc_status)}>
              {kycLabel(m.kyc_status)}
            </StatusBadge>
            <MerchantLifecycleActions merchant={m} onRequested={setRequestedMessage} />
          </div>
        }
      />

      {requestedMessage ? (
        <Card className="mb-4 border border-brand">
          <CardContent className="flex items-start justify-between gap-4 text-sm">
            <p>{requestedMessage} See the <Link href="/daraja/actions" className="underline">Actions queue</Link>.</p>
            <Button size="sm" variant="outline" onClick={() => setRequestedMessage(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {m.wallet === null ? (
        // `wallet` is the first-opened ACTIVE CollectionAccount, so null here
        // means "no ACTIVE wallet" -- not necessarily "no wallet at all",
        // which is what this card used to claim. The distinction is live:
        // MASHTEMI's sole wallet is inactive and still holds 300, and the
        // Balance card above counts it, so "no wallet at all" beside a
        // non-zero balance would read as a broken screen. A merchant with no
        // wallet whatsoever is also a real state (L&M Tutashinda,
        // 2026-09-16) and shows TZS 0. No code path in the system creates a
        // wallet today, so this card can only warn; wallet creation is a
        // money action that arrives with the money-actions plan.
        <Card className="mb-4 border border-danger-fg">
          <CardHeader><CardTitle>No active wallet</CardTitle></CardHeader>
          <CardContent className="text-sm">
            This merchant has no active wallet, so every payout they attempt
            will fail before it starts. Any balance shown above is money held
            in wallets that are not active. There is nothing to fix from this
            screen -- creating a wallet is a money action for a later plan.
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="wallet">Wallet &amp; statement</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="people">Employees &amp; branches</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Balance</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">
                {/*
                  `m.balance`, NOT `m.wallet.balance`. The detail serializer
                  now emits a top-level `balance` -- the SUM of every wallet
                  this merchant holds, off the same annotation the roster
                  reads, so the two screens agree by construction. `wallet` is
                  one wallet: for Swahilies (two wallets) it reads 51,738.43
                  against a real total of 58,738.43, and the header
                  contradicted the roster row the operator clicked through
                  from. Passed to formatMoney as the STRING it is -- no
                  Number(), no `|| 0`; a default on a money field is how a
                  real 12,500 came to render as 0.

                  AND IF THE FIELD IS NOT THERE AT ALL, this reads "—", not
                  "TZS 0". `balance` landed on an unmerged backend branch
                  (981ac37/4a8c2f9/0954ac1); deployed ahead of it, this header
                  used to render Number(undefined) -> NaN -> formatNumber's
                  "0" for EVERY merchant, silently. Deploy order fixes today's
                  mismatch; formatOpsMoney fixes the class, because the same
                  hazard returns on any future contract drift
                  (lib/darajaMoney.ts, whole-branch review, I3).
                */}
                {formatOpsMoney(m.balance)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Wallet</CardTitle></CardHeader>
              <CardContent className="font-mono text-sm">
                {/*
                  "NO ACTIVE WALLET", NOT "NO WALLET" -- this card used to
                  render the latter and it is a claim the data does not
                  support. `wallet` is the first-opened ACTIVE
                  CollectionAccount (get_wallet filters active=True), while
                  `balance` beside it sums EVERY wallet with no active filter
                  (dashboard/queries.py). So the two cards disagree for a real
                  shape: MASHTEMI's sole wallet is inactive and still holds
                  300, which serialises as `wallet: null, balance: "300"` and
                  rendered as "Balance TZS 300 | Wallet no wallet" -- a screen
                  contradicting itself beside a merchant's money, and pointing
                  the operator at a wallet-creation problem when the real fact
                  is a deactivated wallet. This card now says exactly what the
                  red card above says.

                  The narrower fact -- no CollectionAccount row at all (L&M
                  Tutashinda, 2026-09-16) -- is still legible: that merchant's
                  Balance card reads TZS 0 beside this one, whereas MASHTEMI's
                  reads TZS 300. Three readings survive: no active wallet; an
                  active wallet whose account_no is the empty string
                  (blank=True, and Cheka Plus really is stored that way); and a
                  real number.
                */}
                {m.wallet ? m.wallet.account_no || "number not set" : "no active wallet"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Tier &amp; cap</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <div className="text-text">{m.tier ?? "no tier set"}</div>
                <div className="text-text-muted">
                  {m.monthly_cap_tzs
                    ? `${formatOpsMoney(m.monthly_cap_tzs)} / month (stored, not enforced)`
                    : "no cap set"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Contact person" value={m.contact_person} />
                <Field label="Email" value={m.email_address} />
                <Field label="Business type" value={m.business_type} />
                <Field label="TIN number" value={m.tin_number} />
                <Field label="Owner NIDA" value={m.owner_nida} />
                <Field label="Region" value={m.region} />
                <Field label="District" value={m.district} />
                <Field label="Address" value={m.physical_address} />
                <Field label="Website" value={m.website} />
                <Field label="Expected volume" value={m.expected_volume} />
                <Field label="Terms accepted"
                       value={m.terms_accepted_at ? formatDate(m.terms_accepted_at) : null} />
                <Field label="Phone verified"
                       value={m.phone_verified_at ? formatDate(m.phone_verified_at) : null} />
                <Field label="Email verified"
                       value={m.email_verified_at ? formatDate(m.email_verified_at) : null} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity"><ActivityTab employerId={id} /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab employerId={id} /></TabsContent>
        <TabsContent value="wallet"><WalletTab employerId={id} /></TabsContent>
        <TabsContent value="cards"><CardsTab employerId={id} /></TabsContent>
        <TabsContent value="people"><PeopleTab employerId={id} /></TabsContent>
        <TabsContent value="kyc"><KycTab merchant={m} /></TabsContent>
      </Tabs>
    </>
  );
}
