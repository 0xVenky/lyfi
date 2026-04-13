import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { PoolTable } from "@/components/PoolTable";
import { Pagination } from "@/components/Pagination";
import { WalletButton } from "@/components/WalletButton";
import { ChainDot } from "@/components/ChainDot";
import { queryPools, queryStats } from "@/lib/api/query";
import { ensureCachePopulated, getCachedPools } from "@/lib/pipeline/cache";
import { formatTvl, formatApr, formatProtocolName } from "@/lib/utils";
import type { PoolListItem } from "@/lib/types";

// --- Category helpers ---

const ETH_SYMBOLS = new Set(["ETH", "WETH", "STETH", "WSTETH", "CBETH", "RETH", "METH", "EETH", "WEETH", "SETH2"]);
const BTC_SYMBOLS = new Set(["WBTC", "TBTC", "CBBTC", "BTC", "SBTC"]);

function isEthPool(p: PoolListItem) {
  return p.exposure.underlying_tokens.some(t => ETH_SYMBOLS.has(t.symbol.toUpperCase()));
}
function isBtcPool(p: PoolListItem) {
  return p.exposure.underlying_tokens.some(t => BTC_SYMBOLS.has(t.symbol.toUpperCase()));
}
function isStablePool(p: PoolListItem) {
  return p.exposure.category === "stablecoin";
}

function topByApy(pools: PoolListItem[], filter: (p: PoolListItem) => boolean, count = 4) {
  return pools
    .filter(filter)
    .filter(p => p.tvl_usd >= 50_000)
    .sort((a, b) => b.yield.apr_total - a.yield.apr_total)
    .slice(0, count);
}

// --- Page ---

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") params[k] = v;
  }

  const hasFilters = Object.keys(params).some(k => !["page", "limit"].includes(k));

  // If filters/search active → show table view
  if (hasFilters) {
    const [pools, stats] = await Promise.all([
      queryPools(params),
      queryStats(),
    ]);

    return (
      <div className="flex-1 flex flex-col">
        <Header stats={stats} />
        <Suspense><FilterBar /></Suspense>
        <div className="flex-1">
          <PoolTable data={pools} />
        </div>
        <Pagination
          page={pools.pagination.page}
          totalPages={pools.pagination.total_pages}
          total={pools.pagination.total}
        />
      </div>
    );
  }

  // Landing page — no filters
  await ensureCachePopulated();
  const allPools = getCachedPools();
  const stats = await queryStats();

  const stables = topByApy(allPools, isStablePool, 4);
  const ethPools = topByApy(allPools, isEthPool, 4);
  const btcPools = topByApy(allPools, isBtcPool, 4);

  const totalTvl = allPools.reduce((s, p) => s + p.tvl_usd, 0);

  return (
    <div className="flex-1 overflow-auto">
      {/* Hero */}
      <div className="px-6 sm:px-10 pt-10 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Yield Discovery
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm max-w-md">
              Discover and deposit into {stats.total_pools}+ yield vaults across {stats.chains_covered} chains.
              One-click cross-chain deposits via LI.FI.
            </p>
          </div>
          <WalletButton />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-10 mt-8">
          <HeroStat label="Total TVL" value={formatTvl(totalTvl)} />
          <HeroStat label="Vaults" value={String(stats.total_pools)} />
          <HeroStat label="Chains" value={String(stats.chains_covered)} />
          <HeroStat label="Protocols" value={String(stats.protocols_covered)} />
        </div>

        <Link
          href="/?view=all"
          className="inline-flex items-center gap-1 mt-6 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
        >
          Explore all vaults &rarr;
        </Link>
      </div>

      {/* Stablecoin Strategies */}
      {stables.length > 0 && (
        <CategorySection
          title="Stablecoin Strategies"
          subtitle="Earn yield on USDC, USDT, DAI, and more"
          pools={stables}
          href="/?exposure_category=stablecoin&sort=apr_total&order=desc"
          accent="emerald"
        />
      )}

      {/* ETH Strategies */}
      {ethPools.length > 0 && (
        <CategorySection
          title="ETH Strategies"
          subtitle="Maximize yield on ETH, wstETH, cbETH, and LSTs"
          pools={ethPools}
          href="/?exposure=ETH&sort=apr_total&order=desc"
          accent="blue"
        />
      )}

      {/* BTC Strategies */}
      {btcPools.length > 0 && (
        <CategorySection
          title="BTC Strategies"
          subtitle="Earn on WBTC, tBTC, and Bitcoin derivatives"
          pools={btcPools}
          href="/?exposure=WBTC&sort=apr_total&order=desc"
          accent="orange"
        />
      )}

      {/* Browse all CTA */}
      <div className="px-6 sm:px-10 py-10 text-center">
        <Link
          href="/?view=all"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 text-sm font-medium transition-colors"
        >
          Browse all {stats.total_pools} vaults &rarr;
        </Link>
      </div>
    </div>
  );
}

// --- Sub-components ---

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

const ACCENT_COLORS = {
  emerald: {
    gradient: "from-emerald-50/80 to-emerald-100/40",
    apy: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
    link: "text-emerald-600 hover:text-emerald-700",
  },
  blue: {
    gradient: "from-blue-50/80 to-blue-100/40",
    apy: "text-blue-600",
    badge: "bg-blue-50 text-blue-700 border-blue-100",
    link: "text-blue-600 hover:text-blue-700",
  },
  orange: {
    gradient: "from-orange-50/80 to-orange-100/40",
    apy: "text-orange-600",
    badge: "bg-orange-50 text-orange-700 border-orange-100",
    link: "text-orange-600 hover:text-orange-700",
  },
} as const;

function CategorySection({
  title,
  subtitle,
  pools,
  href,
  accent,
}: {
  title: string;
  subtitle: string;
  pools: PoolListItem[];
  href: string;
  accent: keyof typeof ACCENT_COLORS;
}) {
  const colors = ACCENT_COLORS[accent];

  return (
    <div className="px-6 sm:px-10 py-6">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <Link href={href} className={`text-sm font-medium ${colors.link} transition-colors`}>
          View all &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {pools.map((pool) => (
          <StrategyCard key={pool.id} pool={pool} colors={colors} />
        ))}
      </div>
    </div>
  );
}

function StrategyCard({
  pool,
  colors,
}: {
  pool: PoolListItem;
  colors: (typeof ACCENT_COLORS)[keyof typeof ACCENT_COLORS];
}) {
  return (
    <div
      className={`group rounded-2xl bg-gradient-to-br ${colors.gradient} border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all`}
    >
      {/* Main content — links to vault detail */}
      <Link href={`/pool/${pool.id}`} className="block p-4 pb-2">
        {/* Protocol + chain badge */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500">
            {formatProtocolName(pool.protocol)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            <ChainDot chain={pool.chain} />
            {pool.chain.charAt(0).toUpperCase() + pool.chain.slice(1)}
          </span>
        </div>

        {/* Symbol */}
        <p className="font-semibold text-gray-900 text-sm truncate mb-1">{pool.symbol}</p>

        {/* APY */}
        <p className={`text-2xl font-bold ${colors.apy}`}>
          {formatApr(pool.yield.apr_total)}
        </p>
        <p className="text-[10px] text-gray-400 -mt-0.5">APY</p>
      </Link>

      {/* Footer — TVL + Zap In */}
      <div className="flex items-center justify-between px-4 pb-3 pt-2 mx-4 border-t border-gray-100/80">
        <div>
          <span className="text-xs text-gray-400">TVL </span>
          <span className="text-xs font-medium text-gray-600">{formatTvl(pool.tvl_usd)}</span>
        </div>
        {pool.is_transactional && (
          <Link
            href={`/pool/${pool.id}?deposit=1`}
            className={`rounded-full ${colors.badge} px-2.5 py-1 text-[10px] font-medium hover:opacity-80 transition-opacity`}
          >
            Zap In &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
