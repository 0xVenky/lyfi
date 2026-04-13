import type { NextRequest } from "next/server";
import { SUPPORTED_CHAINS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, YIELD_SOURCE_TYPES } from "@/lib/constants";

const VALID_CHAIN_NAMES: string[] = SUPPORTED_CHAINS.map(c => c.network);

export type PoolQueryParams = {
  search?: string;
  chain?: string;
  pool_type?: string;
  protocol?: string;
  exposure?: string;
  exposure_category?: string;
  asset_class?: string;
  yield_source?: string;
  yield_bearing?: boolean;
  min_tvl?: number;
  min_apr?: number;
  max_apr?: number;
  has_incentives?: boolean;
  depositable?: boolean;
  view?: string;
  sort?: string;
  order: "asc" | "desc";
  page: number;
  limit: number;
};

const VALID_POOL_TYPES = ["lending", "amm_lp", "vault", "staking"];
const VALID_EXPOSURE_CATEGORIES = ["stablecoin", "blue_chip", "volatile", "mixed"];
const VALID_ASSET_CLASSES = ["usd_stable", "eur_stable", "eth_class", "btc_class", "rwa", "mixed", "stablecoin"];

function validateChain(val: string | null): string | undefined {
  if (val && VALID_CHAIN_NAMES.includes(val)) return val;
  return undefined;
}

function validatePoolType(val: string | null): string | undefined {
  if (val && VALID_POOL_TYPES.includes(val)) return val;
  return undefined;
}

function validateExposureCategory(val: string | null): string | undefined {
  if (val && VALID_EXPOSURE_CATEGORIES.includes(val)) return val;
  return undefined;
}

function validateAssetClass(val: string | null): string | undefined {
  if (val && VALID_ASSET_CLASSES.includes(val)) return val;
  return undefined;
}

function validateYieldSource(val: string | null): string | undefined {
  if (val && (YIELD_SOURCE_TYPES as readonly string[]).includes(val)) return val;
  return undefined;
}

function parsePositiveNumber(val: string | null): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val);
  if (isNaN(n) || n < 0) return undefined;
  return n;
}

export function parsePoolParams(req: NextRequest): PoolQueryParams {
  const sp = req.nextUrl.searchParams;

  return {
    search: sp.get("search")?.trim() || undefined,
    chain: validateChain(sp.get("chain")),
    pool_type: validatePoolType(sp.get("pool_type")),
    protocol: sp.get("protocol") ?? undefined,
    exposure: sp.get("exposure") ?? undefined,
    exposure_category: validateExposureCategory(sp.get("exposure_category")),
    asset_class: validateAssetClass(sp.get("asset_class")),
    yield_source: validateYieldSource(sp.get("yield_source")),
    yield_bearing: sp.get("yield_bearing") === "true" ? true : undefined,
    min_tvl: parsePositiveNumber(sp.get("min_tvl")),
    min_apr: parsePositiveNumber(sp.get("min_apr")),
    max_apr: parsePositiveNumber(sp.get("max_apr")),
    has_incentives: sp.get("has_incentives") === "true" ? true : undefined,
    depositable: sp.get("depositable") === "true" ? true : undefined,
    view: sp.get("view") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    order: sp.get("order") === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1),
    limit: Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(sp.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)),
  };
}
