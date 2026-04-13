/**
 * Convert APY (compounded) to APR (non-compounded).
 * Assumes daily compounding (n=365).
 * Input/output are percentages (e.g., 8.5 not 0.085).
 */
export function apyToApr(apy: number): number {
  if (apy === 0) return 0;
  return 365 * (Math.pow(1 + apy / 100, 1 / 365) - 1) * 100;
}

/**
 * Compute simulation earnings for a given APR and deposit amount.
 * Returns values rounded to 2 decimal places.
 */
export function computeSimulation(aprTotal: number, deposit = 1000) {
  const daily = deposit * (aprTotal / 100) / 365;
  return {
    daily_earnings_per_1k: Math.round(daily * 100) / 100,
    monthly_earnings_per_1k: Math.round(daily * 30 * 100) / 100,
    yearly_earnings_per_1k: Math.round(deposit * (aprTotal / 100) * 100) / 100,
  };
}

/**
 * Format protocol slug to display name.
 * "aave-v3" → "Aave V3"
 */
export function formatProtocolName(slug: string): string {
  return PROTOCOL_DISPLAY_NAMES[slug]
    ?? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format TVL with K/M/B suffixes.
 */
export function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(1)}B`;
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(1)}M`;
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(1)}K`;
  return `$${tvl.toFixed(0)}`;
}

/**
 * Format APY to 2 decimal places with % suffix.
 * Field names say apr_* but values are APY per Decision H1.
 */
export function formatApr(apy: number | null): string {
  if (apy === null) return "—";
  return `${apy.toFixed(2)}%`;
}

/**
 * Format USD amount to 2 decimal places with $ prefix.
 */
export function formatUsd(amount: number | null): string {
  if (amount === null) return "—";
  return `$${amount.toFixed(2)}`;
}

/**
 * Format pool type slug to display label.
 */
export function formatPoolType(type: string): string {
  const map: Record<string, string> = {
    amm_lp: "AMM LP",
    lending: "Lending",
    vault: "Vault",
    staking: "Staking",
  };
  return map[type] ?? type;
}

/**
 * Format yield source slug to display label.
 */
export function formatYieldSource(source: string): string {
  const map: Record<string, string> = {
    trading_fees: "Trading fees",
    lending_interest: "Lending interest",
    staking_rewards: "Staking rewards",
    strategy_returns: "Strategy returns",
    rwa_yield: "RWA yield",
  };
  return map[source] ?? "Base";
}

export function getBaseUrl(): string {
  // Vercel provides VERCEL_URL automatically (without protocol)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

const PROTOCOL_DISPLAY_NAMES: Record<string, string> = {
  "aave-v3": "Aave V3",
  "uniswap-v3": "Uniswap V3",
  "compound-v3": "Compound V3",
  "aerodrome": "Aerodrome",
  "morpho": "Morpho",
  "yearn-finance": "Yearn",
  "beefy": "Beefy",
  "spark": "Spark",
  "silo-v2": "Silo V2",
  "lido": "Lido",
};
