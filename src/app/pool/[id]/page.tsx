import Link from "next/link";
import { notFound } from "next/navigation";
import { formatProtocolName, formatTvl } from "@/lib/utils";
import { YieldCard } from "@/components/pool-detail/YieldCard";
import { VaultInfoCard } from "@/components/pool-detail/VaultInfoCard";
import { SimulationCard } from "@/components/pool-detail/SimulationCard";
import { DepositFlow } from "@/components/DepositFlow";
import { ChainDot } from "@/components/ChainDot";
import { queryPoolById } from "@/lib/api/query";

function chainLabel(chain: string): string {
  return chain.charAt(0).toUpperCase() + chain.slice(1);
}

export const dynamic = "force-dynamic";

export default async function PoolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const autoDeposit = sp.deposit === "1";
  const pool = await queryPoolById(id);

  if (!pool) {
    notFound();
  }

  const organicRatio = pool.yield.apr_total > 0
    ? Math.round(((pool.yield.apr_base ?? 0) / pool.yield.apr_total) * 100)
    : null;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors mb-6"
      >
        &larr; Back to vaults
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
            {formatProtocolName(pool.protocol)}{" "}
            <span className="text-gray-400 dark:text-zinc-400 font-normal">{pool.symbol}</span>
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-zinc-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-gray-600 dark:text-zinc-300">
              <ChainDot chain={pool.chain} />
              {chainLabel(pool.chain)}
            </span>
            <span>{formatTvl(pool.tvl_usd)} TVL</span>
            {organicRatio !== null && (
              <span className="text-xs">
                {organicRatio}% organic
              </span>
            )}
          </div>
        </div>
        <DepositFlow pool={pool} autoOpen={autoDeposit} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <YieldCard pool={pool} />
        <VaultInfoCard pool={pool} />
      </div>
      <div className="space-y-4">
        <SimulationCard pool={pool} />
      </div>
    </div>
  );
}
