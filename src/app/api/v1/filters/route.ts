import { NextResponse } from "next/server";
import { ensureCachePopulated, getCachedPools } from "@/lib/pipeline/cache";
import { formatProtocolName } from "@/lib/utils";
import type { FiltersResponse } from "@/lib/types";

export async function GET() {
  await ensureCachePopulated();
  const pools = getCachedPools();

  // Chains
  const chains = [...new Set(pools.map(p => p.chain))].sort();

  // Protocols with counts
  const protocolCounts = new Map<string, number>();
  pools.forEach(p => protocolCounts.set(p.protocol, (protocolCounts.get(p.protocol) ?? 0) + 1));
  const protocols = [...protocolCounts.entries()]
    .map(([slug, count]) => ({ slug, name: formatProtocolName(slug), pool_count: count }))
    .sort((a, b) => b.pool_count - a.pool_count);

  // Pool types
  const pool_types = [...new Set(pools.map(p => p.pool_type))].sort();

  // Exposure categories (exclude null)
  const exposure_categories = [...new Set(pools.map(p => p.exposure.category).filter(Boolean))] as string[];
  exposure_categories.sort();

  // Tokens from underlying_tokens (top 50 by frequency)
  const tokenCounts = new Map<string, number>();
  pools.forEach(p =>
    p.exposure.underlying_tokens.forEach(t => {
      if (t.symbol !== "UNKNOWN") {
        tokenCounts.set(t.symbol, (tokenCounts.get(t.symbol) ?? 0) + 1);
      }
    })
  );
  const tokens = [...tokenCounts.entries()]
    .map(([symbol, count]) => ({ symbol, pool_count: count }))
    .sort((a, b) => b.pool_count - a.pool_count)
    .slice(0, 50);

  const response: FiltersResponse = { chains, protocols, pool_types, exposure_categories, tokens };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
