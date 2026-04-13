import { Suspense } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { PoolTable } from "@/components/PoolTable";
import { Pagination } from "@/components/Pagination";
import { WalletButton } from "@/components/WalletButton";
import { ChainDot, ChainBadge } from "@/components/ChainDot";
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

  // If filters/search active -> show table view
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

  // Landing page -- no filters
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
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]" style={{ color: "var(--on-surface)" }}>
              LyFi - Liquidity Yield Finder
            </h1>
            <p className="mt-2 text-base max-w-md" style={{ color: "var(--on-surface-variant)" }}>
              Discover and deposit into {stats.total_pools}+ yield vaults across {stats.chains_covered} chains.
              One-click cross-chain deposits via LI.FI.
            </p>
          </div>
          <WalletButton />
        </div>

        {/* Stats bento grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <HeroStat label="Total TVL" value={formatTvl(totalTvl)} />
          <HeroStat label="Vaults" value={String(stats.total_pools)} />
          <HeroStat label="Chains" value={String(stats.chains_covered)} />
          <HeroStat label="Protocols" value={String(stats.protocols_covered)} />
        </div>

        <Link
          href="/?view=all"
          className="inline-flex items-center gap-1 mt-6 text-sm font-semibold transition-colors hover:opacity-80"
          style={{ color: "var(--primary)" }}
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
          accentColor="var(--secondary)"
          accentBg="var(--secondary-container)"
          accentText="var(--on-secondary-container)"
        />
      )}

      {/* ETH Strategies */}
      {ethPools.length > 0 && (
        <CategorySection
          title="ETH Strategies"
          subtitle="Maximize yield on ETH, wstETH, cbETH, and LSTs"
          pools={ethPools}
          href="/?exposure=ETH&sort=apr_total&order=desc"
          accentColor="#2563eb"
          accentBg="#dbeafe"
          accentText="#1e40af"
        />
      )}

      {/* BTC Strategies */}
      {btcPools.length > 0 && (
        <CategorySection
          title="BTC Strategies"
          subtitle="Earn on WBTC, tBTC, and Bitcoin derivatives"
          pools={btcPools}
          href="/?exposure=WBTC&sort=apr_total&order=desc"
          accentColor="#ea580c"
          accentBg="#fff7ed"
          accentText="#9a3412"
        />
      )}

      {/* Browse all CTA */}
      <div className="px-6 sm:px-10 py-10 text-center">
        <Link
          href="/?view=all"
          className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-purple-500/20 hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #630ed4, #7c3aed)" }}
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
    <div
      className="rounded-2xl p-5 transition-all hover:brightness-[0.98]"
      style={{ backgroundColor: "var(--surface-container-low)" }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--on-surface-variant)" }}>{label}</p>
      <p className="text-2xl font-black font-[family-name:var(--font-manrope)] mt-1" style={{ color: "var(--on-surface)" }}>{value}</p>
    </div>
  );
}

function CategorySection({
  title,
  subtitle,
  pools,
  href,
  accentColor,
  accentBg,
  accentText,
}: {
  title: string;
  subtitle: string;
  pools: PoolListItem[];
  href: string;
  accentColor: string;
  accentBg: string;
  accentText: string;
}) {
  return (
    <div className="px-6 sm:px-10 py-6">
      <div className="flex items-end justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-7 rounded-full" style={{ background: `linear-gradient(135deg, var(--primary), var(--primary-container))` }} />
          <div>
            <h2 className="text-xl font-bold font-[family-name:var(--font-manrope)] tracking-tight" style={{ color: "var(--on-surface)" }}>{title}</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--on-surface-variant)" }}>{subtitle}</p>
          </div>
        </div>
        <Link href={href} className="text-sm font-semibold transition-colors hover:opacity-80" style={{ color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {pools.map((pool) => (
          <StrategyCard key={pool.id} pool={pool} accentColor={accentColor} accentBg={accentBg} accentText={accentText} />
        ))}
      </div>
    </div>
  );
}

function StrategyCard({
  pool,
  accentColor,
  accentBg,
  accentText,
}: {
  pool: PoolListItem;
  accentColor: string;
  accentBg: string;
  accentText: string;
}) {
  return (
    <div
      className="group rounded-[2rem] hover:scale-[1.02] transition-all duration-300 relative overflow-hidden"
      style={{ backgroundColor: "var(--surface-container-lowest)" }}
    >
      {/* Main content */}
      <Link href={`/pool/${pool.id}`} className="block p-6 pb-3">
        {/* Protocol + chain badge */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-xs font-medium" style={{ color: "var(--on-surface-variant)" }}>
            {formatProtocolName(pool.protocol)}
          </span>
          <ChainBadge
            chain={pool.chain}
            className="px-3 py-1"
            style={{ backgroundColor: accentBg, color: accentText }}
          />
        </div>

        {/* Symbol */}
        <p className="text-sm font-medium mb-1" style={{ color: "var(--on-surface-variant)" }}>{pool.symbol}</p>

        {/* APY */}
        <div className="flex items-baseline gap-1">
          <p className="text-4xl font-extrabold font-[family-name:var(--font-manrope)] tracking-tighter" style={{ color: "var(--on-surface)" }}>
            {formatApr(pool.yield.apr_total)}
          </p>
          <span className="font-bold text-lg font-[family-name:var(--font-manrope)]" style={{ color: accentColor }}>APY</span>
        </div>
      </Link>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 pb-5 pt-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--outline)" }}>TVL</span>
          <p className="text-sm font-bold" style={{ color: "var(--on-surface)" }}>{formatTvl(pool.tvl_usd)}</p>
        </div>
        {pool.is_transactional && (
          <Link
            href={`/pool/${pool.id}?deposit=1`}
            className="rounded-full px-5 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 hover:opacity-90"
            style={{ backgroundColor: accentBg, color: accentText }}
          >
            Zap In <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        )}
      </div>
    </div>
  );
}
