// components/daraja/KycTab.tsx
// The only tab without "use client" -- harmless, since its importer is a
// client component, but inconsistent with its six siblings (M7).
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status_badge";
import { formatDate } from "@/lib/format";
import { kycLabel, kycVariant } from "@/lib/kyc";
import type { MerchantDetail } from "@/types/daraja";

const DOC_LABELS: Record<string, string> = {
  business_licence: "Business licence",
  brela_certificate: "BRELA certificate",
  memart: "Memorandum & articles",
};

export function KycTab({ merchant }: { merchant: MerchantDetail }) {
  const docs = Object.entries(merchant.documents ?? {});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Review status</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge variant={kycVariant(merchant.kyc_status)}>
              {kycLabel(merchant.kyc_status)}
            </StatusBadge>
            {merchant.reviewed_at ? (
              <span className="text-text-muted">
                reviewed {formatDate(merchant.reviewed_at)}
              </span>
            ) : null}
          </div>
          {merchant.rejection_reason ? (
            <p className="text-danger-fg">{merchant.rejection_reason}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents on file</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {/*
            This is NOT a checklist of every document the merchant needs.
            `EmployerDetailSerializer.get_documents` reads exactly three
            legacy fields on Employer -- business_licence, brela_certificate,
            memart -- while the newer, structured EmployerDocument table
            defines its own REQUIRED_TYPES as business_licence,
            tin_certificate and director_id (employer/models.py). Only
            business_licence is common to both; tin_certificate and
            director_id have no field surfaced here at all (that table is a
            later registration plan, not assumed by this endpoint). Present
            what exists, never as a complete compliance picture.
          */}
          {docs.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing uploaded.</p>
          ) : (
            docs.map(([name, url]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-sm">{DOC_LABELS[name] ?? name.replace(/_/g, " ")}</span>
                {url ? (
                  <a className="text-sm text-primary underline" href={url}
                     target="_blank" rel="noreferrer">Open</a>
                ) : (
                  <span className="text-sm text-text-muted">missing</span>
                )}
              </div>
            ))
          )}
          <p className="pt-2 text-xs text-text-muted">
            Covers business licence, BRELA certificate and memorandum &amp;
            articles only. TIN certificate and director ID are required for
            approval but are not yet tracked as uploadable documents in this
            system -- check the compliance record itself (tin_number, owner_nida
            on the merchant profile) rather than treating this list as complete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
