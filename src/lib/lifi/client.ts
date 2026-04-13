import { LIFI_EARN_BASE_URL, SUPPORTED_CHAINS } from "@/lib/constants";
import {
  LifiVaultsResponseSchema,
  LifiChainsResponseSchema,
  LifiProtocolsResponseSchema,
  LifiPortfolioResponseSchema,
  type LifiVaultRaw,
  type LifiPosition,
} from "./schemas";

const BASE_URL = process.env.LIFI_EARN_URL ?? LIFI_EARN_BASE_URL;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 }, // no Next.js cache — we manage our own
  });
  if (!res.ok) {
    throw new Error(`LI.FI API ${res.status}: ${url}`);
  }
  return res.json();
}

/**
 * Fetch vaults for a single request URL, Zod-validated.
 */
async function fetchVaultPage(url: string): Promise<{ vaults: LifiVaultRaw[]; total: number }> {
  try {
    const raw = await fetchJson(url);
    const parsed = LifiVaultsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`[lifi] Validation failed for ${url}:`, parsed.error.issues.slice(0, 2));
      return { vaults: [], total: 0 };
    }
    return { vaults: parsed.data.data, total: parsed.data.total };
  } catch (err) {
    console.error(`[lifi] Fetch failed for ${url}:`, err);
    return { vaults: [], total: 0 };
  }
}

/**
 * Fetch ALL vaults across all supported chains.
 *
 * GOTCHA: LI.FI API max limit=100, cursor pagination is broken (loops forever).
 * Strategy: fetch per-chain (limit=100 each). For chains with >100 vaults,
 * also fetch with tag filters to maximize coverage.
 */
export async function fetchAllVaults(): Promise<LifiVaultRaw[]> {
  const allVaults: LifiVaultRaw[] = [];
  const chainIds = SUPPORTED_CHAINS.map(c => c.chainId);
  let requests = 0;

  for (const chainId of chainIds) {
    const baseUrl = `${BASE_URL}/v1/earn/vaults?limit=100&chainId=${chainId}`;
    const { vaults, total } = await fetchVaultPage(baseUrl);
    allVaults.push(...vaults);
    requests++;

    // If chain has more than 100 vaults, fetch with tag filters for broader coverage
    if (total > 100) {
      for (const tag of ["stablecoin", "multi", "il-risk"]) {
        const tagUrl = `${BASE_URL}/v1/earn/vaults?limit=100&chainId=${chainId}&tags=${tag}`;
        const { vaults: tagVaults } = await fetchVaultPage(tagUrl);
        allVaults.push(...tagVaults);
        requests++;
      }
    }
  }

  // Deduplicate by slug
  const seen = new Set<string>();
  const deduped = allVaults.filter(v => {
    if (seen.has(v.slug)) return false;
    seen.add(v.slug);
    return true;
  });

  console.log(`[lifi] Fetched ${deduped.length} unique vaults (${requests} requests, ${allVaults.length} raw)`);
  return deduped;
}

/**
 * Fetch a single vault by chain network + address.
 * Endpoint: GET /v1/earn/vaults/:network/:address
 */
export async function fetchVaultBySlug(network: string, address: string): Promise<LifiVaultRaw | null> {
  try {
    const url = `${BASE_URL}/v1/earn/vaults/${network}/${address}`;
    const raw = await fetchJson(url);
    // Single vault response — validate with the vault schema directly
    const { LifiVaultSchema } = await import("./schemas");
    const parsed = LifiVaultSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[lifi] Single vault validation failed:", parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.error("[lifi] Failed to fetch vault:", err);
    return null;
  }
}

/**
 * Fetch supported chains.
 */
export async function fetchChains(): Promise<{ chainId: number; name: string; network: string }[]> {
  try {
    const raw = await fetchJson(`${BASE_URL}/v1/earn/chains`);
    const parsed = LifiChainsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[lifi] Chains validation failed:", parsed.error.issues.slice(0, 3));
      return [];
    }
    return parsed.data.data;
  } catch (err) {
    console.error("[lifi] Failed to fetch chains:", err);
    return [];
  }
}

/**
 * Fetch supported protocols.
 */
export async function fetchProtocols(): Promise<{ name: string; url?: string }[]> {
  try {
    const raw = await fetchJson(`${BASE_URL}/v1/earn/protocols`);
    const parsed = LifiProtocolsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[lifi] Protocols validation failed:", parsed.error.issues.slice(0, 3));
      return [];
    }
    return parsed.data.data;
  } catch (err) {
    console.error("[lifi] Failed to fetch protocols:", err);
    return [];
  }
}

/**
 * Fetch portfolio positions for a wallet address.
 * Endpoint: GET /v1/earn/portfolio/{address}/positions
 */
export async function fetchPortfolio(address: string): Promise<LifiPosition[]> {
  try {
    const raw = await fetchJson(`${BASE_URL}/v1/earn/portfolio/${address}/positions`);
    const parsed = LifiPortfolioResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[lifi] Portfolio validation failed:", parsed.error.issues.slice(0, 3));
      return [];
    }
    return parsed.data.positions;
  } catch (err) {
    console.error("[lifi] Failed to fetch portfolio:", err);
    return [];
  }
}
