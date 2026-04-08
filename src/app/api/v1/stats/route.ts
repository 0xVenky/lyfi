import { NextResponse } from "next/server";
import { ensureCachePopulated, getCachedPools, getCachedBenchmarks, getLastRefreshed } from "@/lib/pipeline/cache";
import type { StatsResponse } from "@/lib/types";

export async function GET() {
  await ensureCachePopulated();
  const pools = getCachedPools();

  const response: StatsResponse = {
    total_pools: pools.length,
    total_tvl_usd: pools.reduce((sum, p) => sum + p.tvl_usd, 0),
    chains_covered: new Set(pools.map(p => p.chain)).size,
    protocols_covered: new Set(pools.map(p => p.protocol)).size,
    last_refreshed: getLastRefreshed()?.toISOString() ?? null,
    refresh_interval_minutes: 15,
    benchmarks: getCachedBenchmarks(),
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
