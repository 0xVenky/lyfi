"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PoolListItem } from "@/lib/types";
import { formatTvl, formatApr, formatUsd, formatProtocolName, formatYieldSource } from "@/lib/utils";
import { SimulationTooltip } from "./SimulationTooltip";
import { ChainDot } from "./ChainDot";

export function VaultRow({ pool }: { pool: PoolListItem }) {
  const router = useRouter();

  const organicPct =
    pool.yield.apr_total > 0
      ? Math.round(
          ((pool.yield.apr_base ?? 0) / pool.yield.apr_total) * 100,
        )
      : 0;

  return (
    <div
      className="group flex items-center gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-white via-white to-violet-50/60 border border-gray-100 hover:border-violet-200 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => router.push(`/pool/${pool.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/pool/${pool.id}`);
      }}
    >
      {/* Token icon area */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-violet-50 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-violet-500">
          {pool.symbol.charAt(0)}
        </span>
      </div>

      {/* Name + protocol */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 truncate">
            {pool.symbol}
          </span>
          {pool.exposure.category === "stablecoin" && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              Stable
            </span>
          )}
          {pool.exposure.category === "blue_chip" && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              Blue Chip
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
          <span>{formatProtocolName(pool.protocol)}</span>
          {pool.yield.apr_reward !== null && pool.yield.apr_reward > 0 && (
            <>
              <span className="text-gray-300">&middot;</span>
              <span className="text-violet-400">{organicPct}% organic</span>
            </>
          )}
        </div>
      </div>

      {/* APY */}
      <div className="w-20 text-right shrink-0">
        <div className="relative group/apr">
          <span className="text-lg font-semibold text-violet-600">
            {formatApr(pool.yield.apr_total)}
          </span>
          {pool.yield.is_estimated && (
            <span className="ml-0.5 text-[10px] text-amber-500">~</span>
          )}
          {(pool.yield.apr_base !== null ||
            pool.yield.apr_reward !== null) && (
            <div className="absolute hidden group-hover/apr:block bottom-full right-0 mb-2 z-20 w-48 rounded-xl border border-gray-100 bg-white p-3 shadow-lg text-left text-xs">
              <div className="flex justify-between mb-1.5">
                <span className="text-gray-500">
                  {formatYieldSource(pool.yield_source)}
                </span>
                <span className="font-medium text-emerald-600">
                  {formatApr(pool.yield.apr_base)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rewards</span>
                <span className="font-medium text-violet-600">
                  {formatApr(pool.yield.apr_reward)}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="text-[10px] text-gray-400 md:hidden">APY</div>
      </div>

      {/* TVL */}
      <div className="w-24 text-right shrink-0 hidden md:block">
        <span className="text-sm font-medium text-gray-600">
          {formatTvl(pool.tvl_usd)}
        </span>
      </div>

      {/* Daily / $1K */}
      <div className="w-20 text-right shrink-0 hidden md:block">
        <SimulationTooltip aprTotal={pool.yield.apr_total}>
          <span className="text-sm text-gray-500 cursor-help border-b border-dotted border-gray-200">
            {formatUsd(pool.simulation.daily_earnings_per_1k)}
          </span>
        </SimulationTooltip>
      </div>

      {/* Chain */}
      <div className="w-10 justify-center shrink-0 hidden md:flex">
        <ChainDot chain={pool.chain} />
      </div>

      {/* Zap In button */}
      {pool.is_transactional && (
        <Link
          href={`/pool/${pool.id}?deposit=1`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1.5 text-xs font-medium hover:bg-emerald-100 hover:border-emerald-200 transition-colors hidden md:block"
        >
          Zap In &rarr;
        </Link>
      )}
    </div>
  );
}
