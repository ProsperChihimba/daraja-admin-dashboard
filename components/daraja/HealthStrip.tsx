// components/daraja/HealthStrip.tsx
//
// The screen this whole plan exists for: five cells an operator reads during
// an incident, above the house's own accounts. THE RULE THIS HONOURS -- the
// 2026-09-16 halt was seventeen hours of frozen payouts triggered by a pool
// balance of 0 that was actually a failed Selcom read, misread as "the money
// is gone":
//
//   - `pool_balance` is nullable. A failed live read renders through
//     `formatOpsMoney`, which turns null into `UNKNOWN_AMOUNT` ("--"),
//     NEVER a number -- the `pool_error` text is what explains the dash.
//   - `pool_suspect` means Selcom genuinely returned zero: the number IS
//     shown (it's real), but flagged, because a real zero and a bad read
//     render identically otherwise.
//   - `gap` is null whenever either side is unknown, and is never computed
//     or guessed at here -- the backend is the only thing that gets to
//     decide the two sides are comparable.
//   - `gap`'s sign: POSITIVE means the ledger claims more money than
//     exists (`ledger_over`, the halting direction). `halt.gap_magnitude`
//     is UNSIGNED and is labelled "magnitude" below -- it is never signed
//     by guessing which direction it points.
//   - `ledger_total` is nullable too, with `ledger_error`: the ledger not
//     summing to zero is worse than a breach, so it is its own failure
//     state, not folded into the gap.
"use client";

import { formatOpsMoney } from "@/lib/darajaMoney";
import type { LedgerPosition } from "@/types/daraja";

type Severity = "ok" | "warn" | "bad";

const BORDER: Record<Severity, string> = {
  ok: "border-border-soft",
  warn: "border-border-soft border-l-4 border-l-warning-bg",
  bad: "border-border-soft border-l-4 border-l-danger-bg",
};

const DOT: Record<Severity, string | null> = {
  ok: null,
  warn: "bg-warning-bg",
  bad: "bg-danger-bg",
};

/**
 * "38s ago" / "4m ago" / "2h ago", or "--" when the age itself is unknown.
 * Exported: the page's last-runs panel reads the same CommandRunInfo /
 * LedgerHaltInfo `age_seconds` fields and must not grow a second clock.
 */
export function age(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "—";
  }
  if (seconds < 90) return `${Math.round(seconds)}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function gapNote(position: LedgerPosition): string {
  switch (position.direction) {
    case "balanced":
      return "balanced";
    case "ledger_over":
      return "ledger claims more than exists";
    case "pool_over":
      return "pool holds more than the ledger claims (harmless)";
    case "unknown":
    default:
      return "not computable — ledger or pool unreadable";
  }
}

function haltNote(position: LedgerPosition): string | undefined {
  if (position.halt_error) return position.halt_error;
  const halt = position.halt;
  if (!halt) return undefined;
  const magnitude =
    halt.gap_magnitude !== null
      ? ` · magnitude ${formatOpsMoney(halt.gap_magnitude)}`
      : "";
  return `${age(halt.age_seconds)} · ${halt.reason}${magnitude}`;
}

function queuesValue(position: LedgerPosition): string {
  return position.unmatched_count === null
    ? "— unmatched"
    : `${position.unmatched_count} unmatched`;
}

function queuesNote(position: LedgerPosition): string {
  if (position.stuck_payouts_error) return `stuck payouts: ${position.stuck_payouts_error}`;
  if (position.stuck_payouts === null) return "stuck payouts unknown";
  return `${position.stuck_payouts} payout${position.stuck_payouts === 1 ? "" : "s"} stuck`;
}

function queuesSeverity(position: LedgerPosition): Severity {
  if (position.stuck_payouts_error) return "warn";
  if ((position.stuck_payouts ?? 0) > 0) return "warn";
  if ((position.unmatched_count ?? 0) > 0) return "warn";
  return "ok";
}

export function HealthStrip({ position }: { position: LedgerPosition }) {
  const halted = position.halt !== null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Cell
        label="Ledger"
        value={formatOpsMoney(position.ledger_total)}
        note={position.ledger_error ?? undefined}
        severity={position.ledger_error !== null ? "bad" : "ok"}
      />
      <Cell
        label="Pool (live)"
        value={formatOpsMoney(position.pool_balance)}
        /* A failed read shows the reason, never a number: formatOpsMoney(null)
         * is UNKNOWN_AMOUNT, never "TZS 0". */
        note={
          position.pool_error ??
          (position.pool_suspect ? "Selcom reports zero — verify before acting" : undefined)
        }
        severity={
          position.pool_error !== null ? "bad" : position.pool_suspect ? "warn" : "ok"
        }
      />
      <Cell
        label="Gap"
        value={formatOpsMoney(position.gap)}
        note={gapNote(position)}
        severity={
          position.direction === "ledger_over"
            ? "bad"
            : position.direction === "unknown"
              ? "warn"
              : "ok"
        }
      />
      <Cell
        label="Halt"
        value={position.halt_error ? "—" : halted ? "ACTIVE" : "none"}
        note={haltNote(position)}
        severity={position.halt_error !== null ? "warn" : halted ? "bad" : "ok"}
      />
      <Cell
        label="Queues"
        value={queuesValue(position)}
        note={queuesNote(position)}
        severity={queuesSeverity(position)}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  note,
  severity = "ok",
}: {
  label: string;
  value: string;
  note?: string;
  severity?: Severity;
}) {
  return (
    <div
      className={`rounded-card border bg-surface p-3 shadow-[var(--shadow-card)] ${BORDER[severity]}`}
    >
      <div className="flex items-center gap-2">
        {DOT[severity] ? (
          <span className={`size-2 shrink-0 rounded-full ${DOT[severity]}`} />
        ) : null}
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </span>
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-text">{value}</div>
      {note ? <div className="mt-1 text-xs text-text-muted">{note}</div> : null}
    </div>
  );
}
