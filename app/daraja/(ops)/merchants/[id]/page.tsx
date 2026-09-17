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
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingBlock } from "@/components/common/PageStates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusVariant } from "@/components/ui/status_badge";
import { ActivityTab } from "@/components/daraja/ActivityTab";
import { ExpensesTab } from "@/components/daraja/ExpensesTab";
import { WalletTab } from "@/components/daraja/WalletTab";
import { CardsTab } from "@/components/daraja/CardsTab";
import { PeopleTab } from "@/components/daraja/PeopleTab";
import { KycTab } from "@/components/daraja/KycTab";
import { formatMoney, formatDate } from "@/lib/format";
import { useDarajaResource } from "@/lib/darajaAuth";
import type { MerchantDetail } from "@/types/daraja";

// Same convention as the roster (app/daraja/(ops)/merchants/page.tsx):
// Employer.kyc_status can be NULL on historical rows even though it types as
// a plain string, so "Unknown" is a real state here, never the literal
// string "null". Duplicated locally rather than exported, matching that
// page's own precedent -- neither helper is on this plan's shared-component
// list.
const kycVariant = (s: string | null | undefined): StatusVariant =>
  s === "approved" ? "success" : s === "rejected" ? "danger" : s ? "warning" : "neutral";

const kycLabel = (s: string | null | undefined): string => {
  if (!s) return "Unknown";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-text">{value ?? "—"}</div>
    </div>
  );
}

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: m, loading, error, refetch } = useDarajaResource<MerchantDetail>(
    `/employers/${id}/`,
  );

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
          </div>
        }
      />

      {m.wallet === null ? (
        // A merchant this active and this fully approved with no wallet at
        // all is a real state, not a data bug -- see L&M Tutashinda,
        // 2026-09-16. No code path in the system creates one today, so this
        // card can only warn; wallet creation is a money action that
        // arrives with the money-actions plan, not this one.
        <Card className="mb-4 border border-danger-fg">
          <CardHeader><CardTitle>No wallet</CardTitle></CardHeader>
          <CardContent className="text-sm">
            This merchant has no wallet at all, so every payout they attempt
            will fail before it starts. There is nothing to fix from this
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
                  EmployerDetailSerializer never emits `balance` -- that's a
                  roster-only annotation (dashboard/serializers/employers.py).
                  The detail screen's only source of truth for money is the
                  wallet object itself, and `wallet` can be null.
                */}
                {m.wallet ? formatMoney(Number(m.wallet.balance)) : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Wallet</CardTitle></CardHeader>
              <CardContent className="font-mono text-sm">
                {m.wallet?.account_no || "none"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Tier &amp; cap</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <div className="text-text">{m.tier ?? "no tier set"}</div>
                <div className="text-text-muted">
                  {m.monthly_cap_tzs
                    ? `${formatMoney(Number(m.monthly_cap_tzs))} / month (stored, not enforced)`
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
