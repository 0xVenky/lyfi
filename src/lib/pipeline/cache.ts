import type { PoolListItem, AssetClassBenchmark } from "@/lib/types";
import { fetchAllVaults } from "@/lib/lifi/client";
import { normalizeVaults } from "@/lib/lifi/normalize";

// Module-level cache
let cachedPools: PoolListItem[] = [];
let cachedBenchmarks: Record<string, AssetClassBenchmark> = {};
let lastRefreshed: Date | null = null;
let refreshPromise: Promise<{ count: number; errors: string[] }> | null = null;

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function getCachedPools(): PoolListItem[] {
  return cachedPools;
}

export function getCachedBenchmarks(): Record<string, AssetClassBenchmark> {
  return cachedBenchmarks;
}

export function getLastRefreshed(): Date | null {
  return lastRefreshed;
}

/**
 * Fetch all vaults from LI.FI, normalize, and cache.
 * Returns count of cached vaults and any errors.
 */
export async function refreshCache(): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];

  try {
    console.log("[cache] Refreshing from LI.FI Earn API...");
    const rawVaults = await fetchAllVaults();
    const normalized = normalizeVaults(rawVaults);

    cachedPools = normalized;
    lastRefreshed = new Date();
    console.log(`[cache] Cached ${normalized.length} vaults at ${lastRefreshed.toISOString()}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    console.error("[cache] Refresh failed:", msg);
    // Keep stale data if we have any — stale-but-correct > empty
  }

  return { count: cachedPools.length, errors };
}

/**
 * Ensure cache is populated. Deduplicates concurrent calls.
 * Auto-refreshes if data is stale (> 15 min).
 */
export async function ensureCachePopulated(): Promise<void> {
  const isStale = lastRefreshed && Date.now() - lastRefreshed.getTime() > REFRESH_INTERVAL_MS;

  if (cachedPools.length === 0 || isStale) {
    // Deduplicate: if a refresh is already in flight, wait for it
    if (!refreshPromise) {
      refreshPromise = refreshCache().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
  }
}
