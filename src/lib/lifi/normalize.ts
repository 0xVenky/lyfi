import type { LifiVaultRaw } from "./schemas";
import type { PoolListItem } from "@/lib/types";
import { CHAIN_BY_ID, MAX_REASONABLE_APY } from "@/lib/constants";

/**
 * Validate that a protocol URL is safe to render as a CTA link.
 * Only allows https:// URLs. Rejects javascript:, data:, etc.
 */
function safeProtocolUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * Derive pool_type from LI.FI tags.
 * "single" → vault, "multi" or "il-risk" → amm_lp, default → vault
 */
function derivePoolType(tags: string[]): string {
  if (tags.includes("multi") || tags.includes("il-risk")) return "amm_lp";
  return "vault";
}

/**
 * Derive exposure category from tags + underlying tokens.
 */
function deriveExposureCategory(tags: string[], tokens: { symbol: string }[]): string | null {
  if (tags.includes("stablecoin")) return "stablecoin";
  const symbols = tokens.map(t => t.symbol.toUpperCase());
  const blueChips = ["ETH", "WETH", "STETH", "WSTETH", "CBETH", "RETH", "WBTC", "TBTC", "CBBTC"];
  if (symbols.every(s => blueChips.includes(s))) return "blue_chip";
  if (symbols.length > 0) return "volatile";
  return null;
}

/**
 * Cap APY at MAX_REASONABLE_APY. Negative → 0.
 */
function capApy(apy: number | null): number | null {
  if (apy === null) return null;
  if (apy < 0) return 0;
  return Math.min(apy, MAX_REASONABLE_APY);
}

/**
 * Normalize a single LI.FI vault into PoolListItem shape.
 *
 * Field names say apr_* but values are APY per Decision H1.
 * YIELD_UNIT = "APY" in constants makes this explicit.
 */
export function normalizeVault(raw: LifiVaultRaw): PoolListItem {
  const tvl = parseFloat(raw.analytics.tvl.usd);
  const tvlSafe = isNaN(tvl) || tvl < 0 ? 0 : tvl;

  const apyTotal = capApy(raw.analytics.apy.total) ?? 0;
  const apyBase = capApy(raw.analytics.apy.base) ?? 0;
  const apyReward = capApy(raw.analytics.apy.reward);

  const chainInfo = CHAIN_BY_ID[raw.chainId];
  const chainName = chainInfo?.network ?? raw.network.toLowerCase();

  const poolType = derivePoolType(raw.tags);
  const exposureCategory = deriveExposureCategory(raw.tags, raw.underlyingTokens);

  // Simulation based on APY (Decision H1)
  const daily = 1000 * (apyTotal / 100) / 365;

  return {
    id: raw.slug,
    chain: chainName,
    protocol: raw.protocol.name,
    protocol_url: safeProtocolUrl(raw.protocol.url),
    pool_type: poolType,
    yield_source: "strategy_returns",
    symbol: raw.name,
    tvl_usd: tvlSafe,
    yield: {
      apr_total: apyTotal,
      apr_base: apyBase,
      apr_reward: apyReward,
      apr_base_7d: capApy(raw.analytics.apy7d),
      il_7d: null,
      is_estimated: false,
    },
    exposure: {
      type: poolType === "amm_lp" ? "multi" : "single",
      category: exposureCategory,
      asset_class: exposureCategory === "stablecoin" ? "usd_stable" : null,
      has_yield_bearing_token: false,
      underlying_tokens: raw.underlyingTokens.map(t => ({
        address: t.address,
        symbol: t.symbol,
        decimals: t.decimals,
        chain: chainName,
        is_stable: raw.tags.includes("stablecoin"),
        asset_class: null,
        is_yield_bearing: false,
        base_token: null,
      })),
    },
    risk: {
      contract_age_days: null,
      is_audited: null,
      is_verified: null,
      top_lp_concentration: null,
      underlying_depeg_risk: null,
    },
    incentives_summary: {
      count: apyReward && apyReward > 0 ? 1 : 0,
      nearest_expiry_days: null,
      total_daily_rewards_usd: null,
      sources: apyReward && apyReward > 0 ? ["lifi"] : [],
    },
    simulation: {
      daily_earnings_per_1k: Math.round(daily * 100) / 100,
      monthly_earnings_per_1k: Math.round(daily * 30 * 100) / 100,
      yearly_earnings_per_1k: Math.round(1000 * (apyTotal / 100) * 100) / 100,
    },
    vault_address: raw.address,
    vault_chain_id: raw.chainId,
    is_transactional: raw.isTransactional,
    is_redeemable: raw.isRedeemable,
  };
}

/**
 * Normalize all vaults, filtering out invalid ones.
 */
export function normalizeVaults(raws: LifiVaultRaw[]): PoolListItem[] {
  return raws.map(normalizeVault);
}
