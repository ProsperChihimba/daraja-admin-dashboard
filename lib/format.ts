const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatNumber(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? num.format(v) : "0";
}

/** "TZS 1,250,000" */
export function formatMoney(n: number | string): string {
  return `TZS ${formatNumber(n)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
