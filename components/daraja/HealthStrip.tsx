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
//   - `pool_balance` is a STORED reading by default (C2): the ordinary page
//     load never calls Selcom, it reads what `reconcile_wallets` already
//     measured up to two minutes ago. `pool_age_seconds`/`pool_measured_at`
//     say how old it is, and `pool_stale` (older than five minutes, or no
//     reading at all) is surfaced visibly -- an old number shown with no age
//     beside it is the 2026-09-16 failure with the clock changed instead of
//     the value. `?live=1` (the Refresh button) is the one path that still
//     calls Selcom, in which case the age is 0 and `pool_stale` is false.
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
//   - `unmatched_count` is nullable AND ITS NULL IS A WARNING. It used to be
//     the one nullable field in the payload with no `*_error` sibling, and
//     `queuesSeverity` computed `(unmatched_count ?? 0) > 0`, so the null
//     collapsed into the not-warned branch: a failed read of the queue depth
//     rendered "— unmatched" in an OK-coloured cell with no warning dot and
//     no error text anywhere. An operator scanning five cells for colour saw
//     an all-clear strip over a number nobody could read -- the 2026-09-16
//     failure in a different costume. The backend now sends
//     `unmatched_error` beside it; nothing here may coerce either away.
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

/**
 * EVERY FACT THE POOL FIGURE CARRIES, INCLUDING ITS AGE.
 *
 * `pool_error` wins outright: a failed read (no reading recorded yet, or a
 * failed `?live=1` call) explains the dash and there is nothing else to add.
 * Otherwise this is built from the parts that exist -- "measured 40s ago"
 * via the same `age()` clock every other cell uses (server-computed, does
 * not count up in the browser), then STALE when the reading has missed at
 * least two reconcile ticks, then the suspect-zero note. Order matters:
 * staleness is a fact about the AGE and belongs right after it, before the
 * separate question of whether the value itself looks suspicious.
 */
function poolNote(position: LedgerPosition): string | undefined {
  if (position.pool_error) return position.pool_error;
  const parts: string[] = [];
  if (position.pool_measured_at !== null) {
    parts.push(`measured ${age(position.pool_age_seconds)}`);
  }
  if (position.pool_stale) {
    parts.push("STALE — reconciler may have missed a tick, verify before acting");
  }
  if (position.pool_suspect) {
    parts.push("Selcom reports zero — verify before acting");
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** `bad` only for an unreadable pool -- the same failure `formatOpsMoney`
 *  turns into a dash. Staleness and a suspect zero are both `warn`: the
 *  number is real, but an operator should look before acting on it. Never
 *  folded into a single boolean -- both reasons render in `poolNote` even
 *  when only one of them fires this severity. */
function poolSeverity(position: LedgerPosition): Severity {
  if (position.pool_error) return "bad";
  if (position.pool_stale || position.pool_suspect) return "warn";
  return "ok";
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

/** A count that could not be read shows a placeholder, never "0": a
 *  fabricated zero is exactly how a full queue comes to look empty. */
function queuesValue(position: LedgerPosition): string {
  return position.unmatched_count === null
    ? "— unmatched"
    : `${position.unmatched_count} unmatched`;
}

/**
 * EVERY FACT THIS CELL HAS, INCLUDING THE ONES IT DOES NOT.
 *
 * This note used to report stuck payouts alone, so an unreadable
 * `unmatched_count` rendered a dash with no explanation beside it. The
 * binding rule is that a null renders as a placeholder plus ITS ERROR; a
 * placeholder on its own is indistinguishable from an empty queue.
 *
 * The bare-null branch is kept beside the `unmatched_error` branch on
 * purpose: a TypeScript type is a claim about a contract, not a guarantee
 * about the bytes that arrive, and an older backend (or a rollback) still
 * swallows this read to a bare null. Unknown must read as unknown either way.
 */
function queuesNote(position: LedgerPosition): string {
  const parts: string[] = [];

  if (position.unmatched_error) {
    parts.push(`unmatched debits unreadable: ${position.unmatched_error}`);
  } else if (position.unmatched_count === null) {
    parts.push("unmatched debit count unavailable");
  }

  if (position.stuck_payouts_error) {
    parts.push(`stuck payouts: ${position.stuck_payouts_error}`);
  } else if (position.stuck_payouts === null) {
    parts.push("stuck payouts unknown");
  } else {
    parts.push(
      `${position.stuck_payouts} payout${position.stuck_payouts === 1 ? "" : "s"} stuck`,
    );
  }

  return parts.join(" · ");
}

/**
 * NEVER `?? 0`. "Could not be read" is not "nothing to warn about", and the
 * two used to collapse into the same branch here. An unread queue is
 * UNKNOWN, and unknown is a warning on the one screen that exists to make
 * an unknown visible.
 */
function queuesSeverity(position: LedgerPosition): Severity {
  if (position.unmatched_error || position.unmatched_count === null) return "warn";
  if (position.stuck_payouts_error || position.stuck_payouts === null) return "warn";
  if (position.stuck_payouts > 0) return "warn";
  if (position.unmatched_count > 0) return "warn";
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
        /* NOT "Pool (live)" any more -- as of C2 the ordinary load reads a
         * STORED measurement, not a live one. Calling it "live" here would
         * be exactly the kind of unlabelled staleness this endpoint exists
         * to rule out; the age in `poolNote` is what tells the truth about
         * how fresh the figure is instead. */
        label="Pool"
        value={formatOpsMoney(position.pool_balance)}
        /* A failed read shows the reason, never a number: formatOpsMoney(null)
         * is UNKNOWN_AMOUNT, never "TZS 0". */
        note={poolNote(position)}
        severity={poolSeverity(position)}
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
