"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface DateRange {
  /** Inclusive lower bound, YYYY-MM-DD (empty = unset). */
  after: string;
  /** Inclusive upper bound, YYYY-MM-DD (empty = unset). */
  before: string;
}

export const EMPTY_RANGE: DateRange = { after: "", before: "" };

/** From/To native date pickers that drive the backend `created_after` /
 *  `created_before` params. Styled with Daraja tokens via the ported Input. */
export function DateRangeFilter({
  value,
  onChange,
  label = "Created",
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
  label?: string;
}) {
  const dirty = Boolean(value.after || value.before);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-text-faint">
        {label}
      </span>
      <Input
        type="date"
        aria-label={`${label} from`}
        value={value.after}
        max={value.before || undefined}
        onChange={(e) => onChange({ ...value, after: e.target.value })}
        className="w-[8.5rem]"
      />
      <span className="text-text-faint">–</span>
      <Input
        type="date"
        aria-label={`${label} to`}
        value={value.before}
        min={value.after || undefined}
        onChange={(e) => onChange({ ...value, before: e.target.value })}
        className="w-[8.5rem]"
      />
      {dirty ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(EMPTY_RANGE)}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}
