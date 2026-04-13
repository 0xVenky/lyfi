export function formatTvl(usd: string): string {
  const n = parseFloat(usd);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatApy(apy: number | null): string {
  return apy != null ? `${apy.toFixed(2)}%` : "—";
}

/**
 * Convert a human-readable token amount to smallest unit (wei) as a string.
 * Uses string manipulation to avoid float precision loss with 18-decimal tokens.
 */
export function toSmallestUnit(amount: string, decimals: number): string {
  const [whole = "0", frac = ""] = amount.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  const raw = whole + padded;
  // Strip leading zeros but keep at least "0"
  return raw.replace(/^0+/, "") || "0";
}
