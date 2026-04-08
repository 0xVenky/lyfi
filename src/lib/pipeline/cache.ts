// Stub cache — will be replaced with LI.FI Earn data in Step 2-3
import type { PoolListItem, AssetClassBenchmark } from "@/lib/types";

let cachedPools: PoolListItem[] = [];
let cachedBenchmarks: Record<string, AssetClassBenchmark> = {};
let lastRefreshed: Date | null = null;

export function getCachedPools(): PoolListItem[] {
  return cachedPools;
}

export function getCachedBenchmarks(): Record<string, AssetClassBenchmark> {
  return cachedBenchmarks;
}

export function getLastRefreshed(): Date | null {
  return lastRefreshed;
}

export async function refreshCache(): Promise<{ count: number; errors: string[] }> {
  // TODO: Replace with LI.FI Earn fetch + normalize
  console.log("Cache refresh stub — LI.FI integration pending");
  lastRefreshed = new Date();
  return { count: 0, errors: [] };
}

export async function ensureCachePopulated(): Promise<void> {
  if (cachedPools.length === 0) {
    await refreshCache();
  }
}
