import type { PoolListItem } from "@/lib/types";
import type { PoolQueryParams } from "@/lib/api/params";

export function filterPools(pools: PoolListItem[], params: PoolQueryParams): PoolListItem[] {
  let result = pools.filter(p => p.tvl_usd > 0); // always exclude zero-TVL

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(p =>
      p.symbol.toLowerCase().includes(q) ||
      p.protocol.toLowerCase().includes(q)
    );
  }

  if (params.chain) result = result.filter(p => p.chain === params.chain);
  if (params.pool_type) result = result.filter(p => p.pool_type === params.pool_type);
  if (params.protocol) {
    const slugs = params.protocol.split(",");
    result = result.filter(p => slugs.includes(p.protocol));
  }
  if (params.exposure_category) result = result.filter(p => p.exposure.category === params.exposure_category);
  if (params.asset_class) {
    if (params.asset_class === "stablecoin") {
      result = result.filter(p => p.exposure.asset_class === "usd_stable" || p.exposure.asset_class === "eur_stable");
    } else {
      result = result.filter(p => p.exposure.asset_class === params.asset_class);
    }
  }
  if (params.yield_source) result = result.filter(p => p.yield_source === params.yield_source);
  if (params.yield_bearing) result = result.filter(p => p.exposure.has_yield_bearing_token);
  if (params.min_tvl) result = result.filter(p => p.tvl_usd >= params.min_tvl!);
  if (params.min_apr) result = result.filter(p => p.yield.apr_total >= params.min_apr!);
  if (params.max_apr) result = result.filter(p => p.yield.apr_total <= params.max_apr!);
  if (params.has_incentives) result = result.filter(p => (p.yield.apr_reward ?? 0) > 0);
  if (params.exposure) {
    const symbol = params.exposure.toUpperCase();
    result = result.filter(p =>
      p.exposure.underlying_tokens.some(t => t.symbol.toUpperCase() === symbol)
    );
  }

  return result;
}

export function applyDiscoveryMode(pools: PoolListItem[], view: string): PoolListItem[] {
  switch (view) {
    case "highest_yield":
      return pools
        .filter(p => p.tvl_usd >= 50000)
        .sort((a, b) => b.yield.apr_total - a.yield.apr_total);

    case "safest":
      return pools
        .filter(p => p.tvl_usd >= 1000000)
        .filter(p => p.exposure.category === "stablecoin" || p.exposure.category === "blue_chip")
        .sort((a, b) => b.tvl_usd - a.tvl_usd);

    case "best_long_term":
      return pools
        .filter(p => {
          const base = p.yield.apr_base ?? 0;
          return base > p.yield.apr_total * 0.5;
        })
        .sort((a, b) => (b.yield.apr_base ?? 0) - (a.yield.apr_base ?? 0));

    case "trending":
      // TBD — signal undefined. Return by TVL for now.
      return [...pools].sort((a, b) => b.tvl_usd - a.tvl_usd);

    case "all":
    default:
      return [...pools].sort((a, b) => b.tvl_usd - a.tvl_usd);
  }
}

export function sortPools(pools: PoolListItem[], sort: string, order: "asc" | "desc"): PoolListItem[] {
  const sortFns: Record<string, (p: PoolListItem) => number> = {
    apr_total: p => p.yield.apr_total,
    tvl_usd: p => p.tvl_usd,
    apr_base: p => p.yield.apr_base ?? 0,
  };

  const fn = sortFns[sort] ?? sortFns.tvl_usd;
  const mult = order === "asc" ? 1 : -1;
  return [...pools].sort((a, b) => mult * (fn(a) - fn(b)));
}

export function paginatePools(pools: PoolListItem[], page: number, limit: number) {
  const total = pools.length;
  const start = (page - 1) * limit;
  const data = pools.slice(start, start + limit);
  return {
    data,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}
