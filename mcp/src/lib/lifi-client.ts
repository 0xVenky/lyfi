import { CHAIN_MAP, type LifiVault, type VaultsResponse } from "./types.js";
import { toSmallestUnit } from "./format.js";

const EARN_BASE = "https://earn.li.fi";
const COMPOSER_BASE = "https://li.quest";

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LI.FI API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

/**
 * Validate that a raw response looks like a VaultsResponse.
 * Not full Zod — just enough to catch error objects and malformed responses.
 */
function assertVaultsResponse(raw: unknown): VaultsResponse {
  if (
    typeof raw !== "object" || raw === null ||
    !("data" in raw) || !Array.isArray((raw as VaultsResponse).data)
  ) {
    throw new Error(`Unexpected vaults response shape: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  return raw as VaultsResponse;
}

/**
 * Validate that a raw response looks like a single vault.
 */
function assertVault(raw: unknown): LifiVault {
  if (
    typeof raw !== "object" || raw === null ||
    !("address" in raw) || !("analytics" in raw) || !("slug" in raw)
  ) {
    throw new Error(`Unexpected vault response shape: ${JSON.stringify(raw).slice(0, 200)}`);
  }
  return raw as LifiVault;
}

/**
 * Fetch vaults for a single chain (max 100 per request).
 */
async function fetchChainVaults(chainId: number, tag?: string): Promise<LifiVault[]> {
  const url = new URL(`${EARN_BASE}/v1/earn/vaults`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("chainId", String(chainId));
  if (tag) {
    url.searchParams.set("tags", tag);
  }
  try {
    const raw = await fetchJson(url.toString());
    return assertVaultsResponse(raw).data;
  } catch {
    // One chain failing shouldn't break the whole search
    return [];
  }
}

/**
 * Search vaults with optional filters.
 * When no chain is specified, fetches across all 17 supported chains in parallel.
 */
export async function searchVaults(params: {
  chainId?: number;
  token?: string;
  minApy?: number;
  minTvl?: number;
  tag?: string;
  sortBy?: "apy" | "tvl";
  limit?: number;
}): Promise<LifiVault[]> {
  const limit = Math.min(params.limit ?? 10, 25);
  const sortBy = params.sortBy ?? "tvl";

  let allVaults: LifiVault[];

  if (params.chainId) {
    // Single chain — one request
    allVaults = await fetchChainVaults(params.chainId, params.tag);
  } else {
    // No chain filter — fetch all supported chains in parallel
    const chainIds = Object.keys(CHAIN_MAP).map(Number);
    const results = await Promise.all(
      chainIds.map((id) => fetchChainVaults(id, params.tag))
    );
    // Flatten and dedup by slug
    const seen = new Set<string>();
    allVaults = results.flat().filter((v) => {
      if (seen.has(v.slug)) return false;
      seen.add(v.slug);
      return true;
    });
  }

  let vaults = allVaults;

  // Filter by token symbol (case-insensitive)
  if (params.token) {
    const tokenLower = params.token.toLowerCase();
    vaults = vaults.filter((v) =>
      v.underlyingTokens.some((t) => t.symbol.toLowerCase() === tokenLower)
    );
  }

  // Filter by min APY
  if (params.minApy !== undefined) {
    vaults = vaults.filter((v) => v.analytics.apy.total >= params.minApy!);
  }

  // Filter by min TVL
  if (params.minTvl !== undefined) {
    vaults = vaults.filter(
      (v) => parseFloat(v.analytics.tvl.usd) >= params.minTvl!
    );
  }

  // Sort
  if (sortBy === "apy") {
    vaults.sort((a, b) => b.analytics.apy.total - a.analytics.apy.total);
  } else {
    vaults.sort(
      (a, b) =>
        parseFloat(b.analytics.tvl.usd) - parseFloat(a.analytics.tvl.usd)
    );
  }

  return vaults.slice(0, limit);
}

/**
 * Fetch a single vault by slug (format: "chainId-address").
 */
export async function getVaultDetails(slug: string): Promise<LifiVault> {
  const dashIdx = slug.indexOf("-");
  if (dashIdx === -1) throw new Error(`Invalid slug format: ${slug}`);

  const chainId = Number(slug.substring(0, dashIdx));
  const address = slug.substring(dashIdx + 1).toLowerCase();
  const url = `${EARN_BASE}/v1/earn/vaults/${chainId}/${address}`;
  const raw = await fetchJson(url);
  return assertVault(raw);
}

/**
 * Look up token decimals from LI.FI's token registry.
 * Caches per chain to avoid repeated calls.
 */
const tokenCache = new Map<number, Map<string, number>>();

async function resolveDecimals(chainId: number, tokenAddress: string): Promise<number> {
  const addrLower = tokenAddress.toLowerCase();

  // Check cache
  let chainTokens = tokenCache.get(chainId);
  if (chainTokens) {
    const cached = chainTokens.get(addrLower);
    if (cached !== undefined) return cached;
  }

  // Fetch chain's tokens from LI.FI
  const url = `${COMPOSER_BASE}/v1/tokens?chains=${chainId}`;
  try {
    const raw = await fetchJson(url) as { tokens?: Record<string, Array<{ address: string; decimals: number }>> };
    const tokens = raw.tokens?.[String(chainId)] ?? [];
    chainTokens = new Map<string, number>();
    for (const t of tokens) {
      chainTokens.set(t.address.toLowerCase(), t.decimals);
    }
    tokenCache.set(chainId, chainTokens);
    return chainTokens.get(addrLower) ?? 18;
  } catch {
    // Fallback: native = 18, common stables = 6, default = 18
    return 18;
  }
}

/**
 * Get a deposit quote from LI.FI Composer.
 * Automatically resolves token decimals if not provided.
 */
export async function getDepositQuote(params: {
  vaultAddress: string;
  vaultChainId: number;
  fromToken: string;
  fromChainId: number;
  amount: string;
  fromTokenDecimals?: number;
  userAddress: string;
}): Promise<unknown> {
  const decimals = params.fromTokenDecimals ?? await resolveDecimals(params.fromChainId, params.fromToken);
  const fromAmount = toSmallestUnit(params.amount, decimals);

  const url = new URL(`${COMPOSER_BASE}/v1/quote`);
  url.searchParams.set("fromChain", String(params.fromChainId));
  url.searchParams.set("toChain", String(params.vaultChainId));
  url.searchParams.set("fromToken", params.fromToken);
  url.searchParams.set("toToken", params.vaultAddress);
  url.searchParams.set("fromAddress", params.userAddress);
  url.searchParams.set("fromAmount", fromAmount);

  const headers: Record<string, string> = {};
  const apiKey = process.env.LIFI_API_KEY ?? process.env.LIFI_COMPOSER_API_KEY;
  if (apiKey) {
    headers["x-lifi-api-key"] = apiKey;
  }

  return fetchJson(url.toString(), headers);
}
