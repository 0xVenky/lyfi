import Link from "next/link";
import { notFound } from "next/navigation";
import { formatProtocolName, formatPoolType, formatTvl } from "@/lib/utils";
import { YieldCard } from "@/components/pool-detail/YieldCard";
import { RiskCard } from "@/components/pool-detail/RiskCard";
import { SimulationCard } from "@/components/pool-detail/SimulationCard";
import { queryPoolById } from "@/lib/api/query";

function chainLabel(chain: string): string {
  return chain.charAt(0).toUpperCase() + chain.slice(1);
}

export const dynamic = "force-dynamic";

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pool = await queryPoolById(id);

  if (!pool) {
    notFound();
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors mb-6"
      >
        &larr; Back to vaults
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
            {formatProtocolName(pool.protocol)}{" "}
            <span className="text-gray-400 dark:text-zinc-400 font-normal">{pool.symbol}</span>
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-zinc-500 flex-wrap">
            <span className="rounded bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-gray-600 dark:text-zinc-300">
              {chainLabel(pool.chain)}
            </span>
            <span>{formatPoolType(pool.pool_type)}</span>
            <span>{formatTvl(pool.tvl_usd)} TVL</span>
          </div>
        </div>
        {pool.protocol_url ? (
          <a
            href={pool.protocol_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition-colors text-center sm:text-left"
          >
            Deposit on {formatProtocolName(pool.protocol)} &rarr;
          </a>
        ) : (
          <button
            disabled
            className="rounded-lg bg-gray-100 dark:bg-zinc-800 px-5 py-2.5 text-sm font-medium text-gray-400 dark:text-zinc-500 cursor-not-allowed"
          >
            Link unavailable
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <YieldCard pool={pool} />
        <RiskCard risk={pool.risk_detail} />
      </div>
      <div className="space-y-4">
        <SimulationCard pool={pool} />
      </div>
    </div>
  );
}
