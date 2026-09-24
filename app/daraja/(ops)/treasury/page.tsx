// app/daraja/(ops)/treasury/page.tsx  (URL: /daraja/treasury)
//
// Daraja sweeps its own Card Top-ups and Lipa Namba wallets into its float.
// Until now that was a management command typed on the server by one
// person -- no preview, no second pair of eyes. GET /dashboard/treasury/
// (dashboard/views/treasury.py) now exposes the balances; this screen is
// where an ops person SEES them and REQUESTS a sweep. Requesting only
// creates a row through the existing createActionRequest
// (lib/darajaActions.ts) -- exactly the machinery merchant activate/suspend
// already uses on app/daraja/(ops)/merchants/[id]/page.tsx. Nothing here
// ever calls an execute endpoint; a different ops.admin decides that from
// the Actions queue.
"use client";
import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/PageStates";
import { DataTable, type Column } from "@/components/common/DataTable";
import { DangerousActionModal } from "@/components/common/DangerousActionModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatOpsMoney } from "@/lib/darajaMoney";
import { useDarajaResource } from "@/lib/darajaAuth";
import { createActionRequest, extractOpsErrorMessage } from "@/lib/darajaActions";
import {
  TREASURY_PATH,
  type TreasuryResponse,
  type TreasuryWallet,
} from "@/lib/darajaTreasury";

/**
 * Requesting a sweep. `wallet.action` is the row's own `action_type`
 * ("treasury.sweep_card_topups" / "treasury.sweep_lipa_payouts") -- never
 * guessed at here. `amount` is optional: the backend's own
 * `_requested()`/`operator_amount()` (dashboard/actions/treasury.py) sweeps
 * everything free when it is left blank, and refuses a non-decimal or
 * too-large figure on approval, not here -- this screen does not duplicate
 * that validation.
 */
function SweepRequestModal({
  wallet,
  open,
  onOpenChange,
  onRequested,
}: {
  wallet: TreasuryWallet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: (message: string) => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setAmount("");
      setError(null);
    }
  }, [open]);

  // The float row (`action: null`) never reaches this modal -- its button
  // is never rendered -- but the guard is kept here too so a future caller
  // cannot wire it up wrong.
  if (!wallet || !wallet.action) return null;
  // Captured as its own const, not just narrowed: TS does not carry a
  // null-check's narrowing of an outer variable into a nested function
  // expression (`submit` below), so `wallet` itself still types as
  // possibly-null inside it even after the guard above.
  const w = wallet;
  const actionType = w.action as string;

  async function submit(reason: string) {
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      const trimmed = amount.trim();
      if (trimmed) params.amount = trimmed;
      await createActionRequest({
        action_type: actionType,
        target_ref: w.key,
        reason,
        params,
      });
      onRequested(
        `Request created for ${w.name}. Nothing has moved yet -- a `
        + `different ops.admin must approve it from the Actions queue `
        + `within the hour, or it expires and nothing happens at all.`,
      );
    } catch (e) {
      const msg = extractOpsErrorMessage(e, "Could not create the request.");
      setError(msg);
      throw new Error(msg); // keeps the modal open so the error is visible
    }
  }

  return (
    <DangerousActionModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Request sweep: ${wallet.name}`}
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
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-text-muted">Balance</dt>
            <dd className="text-right font-medium text-text">
              {formatOpsMoney(wallet.balance)}
            </dd>
            {wallet.reserved !== null ? (
              <>
                <dt className="text-text-muted">Reserved</dt>
                <dd className="text-right font-medium text-text">
                  {formatOpsMoney(wallet.reserved)}
                </dd>
              </>
            ) : null}
            <dt className="text-text-muted">Available to sweep</dt>
            <dd className="text-right font-medium text-text">
              {formatOpsMoney(wallet.sweepable)}
            </dd>
          </dl>
          {wallet.reserved !== null ? (
            <p className="text-xs text-text-muted">
              Reserved money is already committed to unsettled Lipa payments
              -- it will not be swept.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sweep-amount">
              Amount (optional -- leave blank to sweep everything available)
            </Label>
            <Input
              id="sweep-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={wallet.sweepable ?? undefined}
            />
          </div>
          {error ? <p className="text-danger-fg">{error}</p> : null}
        </div>
      }
    />
  );
}

export default function TreasuryPage() {
  const { data, loading, error, refetch } = useDarajaResource<TreasuryResponse>(
    TREASURY_PATH,
  );
  const [target, setTarget] = React.useState<TreasuryWallet | null>(null);
  const [requestedMessage, setRequestedMessage] = React.useState<string | null>(null);

  const wallets = data?.wallets ?? [];

  const columns: Column<TreasuryWallet>[] = [
    {
      key: "name",
      header: "Wallet",
      render: (w) => (
        <div>
          <span className="font-medium text-text">{w.name}</span>
          {w.note ? (
            <div className="text-xs text-danger-fg">{w.note}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      // A DecimalField-as-string, or null when this wallet is undesignated
      // or unreadable -- formatOpsMoney renders that "—", never "0".
      render: (w) => formatOpsMoney(w.balance),
    },
    {
      key: "reserved",
      header: "Reserved",
      // Shown wherever it is non-null (today: only the Lipa row), with the
      // one-line reason a balance-only reading would miss.
      render: (w) =>
        w.reserved !== null ? (
          <div>
            <div>{formatOpsMoney(w.reserved)}</div>
            <div className="text-xs text-text-muted">
              committed to unsettled Lipa payments
            </div>
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "sweepable",
      header: "Available to sweep",
      render: (w) => formatOpsMoney(w.sweepable),
    },
    {
      key: "action",
      header: "",
      render: (w) => {
        // The float account is never itself swept from this screen.
        if (!w.action) return null;
        const disabled = !w.designated;
        return (
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" disabled={disabled} onClick={() => setTarget(w)}>
              Request sweep
            </Button>
            {disabled ? (
              <span className="text-xs text-text-muted">
                {w.reason ?? "not designated"}
              </span>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Treasury"
        subtitle="Daraja's own internal wallets. Requesting a sweep moves nothing by itself -- a different ops.admin approves it from the Actions queue."
      />

      {requestedMessage ? (
        <Card className="mb-4 border border-brand">
          <CardContent className="flex items-start justify-between gap-4 text-sm">
            <p>
              {requestedMessage} See the{" "}
              <Link href="/daraja/actions" className="underline">
                Actions queue
              </Link>
              .
            </p>
            <Button size="sm" variant="outline" onClick={() => setRequestedMessage(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Only a failure with nothing to show takes the whole area -- rows
          already read stay on screen, with the error and Retry above them
          (the convention app/daraja/(ops)/wallets/page.tsx set). */}
      {error && !wallets.length ? <ErrorState message={error} onRetry={refetch} /> : null}
      {error && wallets.length ? (
        <div className="mb-3">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={wallets}
        loading={loading && !wallets.length}
        rowKey={(w) => w.key}
        emptyMessage="No internal wallets to show."
      />

      <SweepRequestModal
        wallet={target}
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        onRequested={(message) => {
          setTarget(null);
          setRequestedMessage(message);
          refetch();
        }}
      />
    </>
  );
}
