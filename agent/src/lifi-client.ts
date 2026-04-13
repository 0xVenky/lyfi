import { CONFIG } from "./config.js";
import type { LifiVault, LifiVaultsResponse } from "./types.js";

/**
 * Fetch USDC vaults from LI.FI Earn API for a given chain.
 * Filters: USDC underlying, TVL > threshold, isTransactional.
 */
export async function fetchUsdcVaults(
  chainId: number,
  usdcAddress: string,
  minTvlUsd: number = CONFIG.MIN_TVL_USD
): Promise<LifiVault[]> {
  const url = new URL(`${CONFIG.EARN_API_URL}/v1/earn/vaults`);
  url.searchParams.set("chainId", String(chainId));
  url.searchParams.set("sortBy", "apy");
  url.searchParams.set("limit", "100");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`LI.FI API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as LifiVaultsResponse;

  return json.data.filter((v) => {
    // Must be transactional
    if (!v.isTransactional) return false;

    // Must have USDC as underlying token
    const hasUsdc = v.underlyingTokens.some(
      (t) => t.address.toLowerCase() === usdcAddress.toLowerCase()
    );
    if (!hasUsdc) return false;

    // Must meet TVL threshold
    const tvl = parseFloat(v.analytics.tvl.usd);
    if (isNaN(tvl) || tvl < minTvlUsd) return false;

    return true;
  });
}

/**
 * Fetch a single vault by slug.
 */
export async function fetchVaultBySlug(slug: string): Promise<LifiVault | null> {
  // Slug format: "chainId-address"
  const parts = slug.split("-");
  const chainId = parts[0];
  const address = parts.slice(1).join("-");

  const url = `${CONFIG.EARN_API_URL}/v1/earn/vaults/${chainId}/${address}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  return json as LifiVault;
}

/**
 * Extract key vault metrics for strategy evaluation.
 */
export function vaultMetrics(v: LifiVault) {
  const apyTotal = v.analytics.apy.total ?? 0;
  const apyBase = v.analytics.apy.base ?? 0;
  const apyReward = v.analytics.apy.reward ?? 0;
  const tvl = parseFloat(v.analytics.tvl.usd) || 0;
  const organicRatio = apyTotal > 0 ? Math.round((apyBase / apyTotal) * 100) : 100;

  return { apyTotal, apyBase, apyReward, tvl, organicRatio };
}
