import { NextResponse, type NextRequest } from "next/server";
import { ensureCachePopulated, getCachedPools, getLastRefreshed } from "@/lib/pipeline/cache";
import { parsePoolParams } from "@/lib/api/params";
import { filterPools, applyDiscoveryMode, sortPools, paginatePools } from "@/lib/api/pool-query";

export async function GET(req: NextRequest) {
  await ensureCachePopulated();
  const params = parsePoolParams(req);
  let pools = getCachedPools();

  // 1. Apply filters
  pools = filterPools(pools, params);

  // 2. Apply discovery mode OR custom sort
  if (params.view) {
    pools = applyDiscoveryMode(pools, params.view);
  } else {
    pools = sortPools(pools, params.sort ?? "tvl_usd", params.order ?? "desc");
  }

  // 3. Paginate
  const result = paginatePools(pools, params.page, params.limit);

  return NextResponse.json({
    ...result,
    last_refreshed: getLastRefreshed()?.toISOString() ?? null,
  });
}
