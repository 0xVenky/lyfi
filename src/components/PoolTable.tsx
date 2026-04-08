import type { PaginatedResponse, PoolListItem } from "@/lib/types";
import { formatTvl, formatApr, formatUsd, formatPoolType, formatProtocolName, formatYieldSource } from "@/lib/utils";
import { PoolRow } from "./PoolRow";
import { SimulationTooltip } from "./SimulationTooltip";
import { StabilityBadge } from "./StabilityBadge";
import { ShareButton } from "./ShareButton";
import { SortHeader } from "./SortHeader";
import { ChainDot } from "./ChainDot";

export function PoolTable({ data }: { data: PaginatedResponse<PoolListItem> }) {
  const pools = data.data;

  if (pools.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-zinc-500">
        No pools found matching your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-zinc-800 text-left text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
            <th className="sticky top-0 bg-white dark:bg-zinc-950 px-4 py-3 font-medium w-10">
              Chain
            </th>
            <th className="sticky top-0 bg-white dark:bg-zinc-950 px-4 py-3 font-medium">
              Protocol
            </th>
            <th className="sticky top-0 bg-white dark:bg-zinc-950 px-4 py-3 font-medium">
              Action
            </th>
            <SortHeader label="TVL" field="tvl_usd" align="right" />
            <th className="sticky top-0 bg-white dark:bg-zinc-950 px-4 py-3 font-medium hidden md:table-cell">
              Stability
            </th>
            <SortHeader label="APR" field="apr_total" align="right" />
            <th className="sticky top-0 bg-white dark:bg-zinc-950 px-4 py-3 font-medium text-right hidden md:table-cell">
              Daily Rewards
            </th>
            <th className="sticky top-0 bg-white dark:bg-zinc-950 px-4 py-3 font-medium w-20">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/50">
          {pools.map((pool) => (
            <PoolRow key={pool.id} href={`/pool/${pool.id}`}>
              {/* Chain */}
              <td className="px-4 py-3">
                <ChainDot chain={pool.chain} />
              </td>
              {/* Protocol */}
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-zinc-200">
                {formatProtocolName(pool.protocol)}
              </td>
              {/* Action */}
              <td className="px-4 py-3">
                <div className="text-gray-700 dark:text-zinc-300">
                  <span className="text-gray-400 dark:text-zinc-500 text-xs">
                    {formatPoolType(pool.pool_type)}
                  </span>{" "}
                  <span className="font-[family-name:var(--font-geist-mono)]">
                    {pool.symbol}
                  </span>
                </div>
              </td>
              {/* TVL */}
              <td className="px-4 py-3 text-right font-[family-name:var(--font-geist-mono)] text-gray-700 dark:text-zinc-200">
                {formatTvl(pool.tvl_usd)}
              </td>
              {/* Stability */}
              <td className="px-4 py-3 hidden md:table-cell">
                <StabilityBadge category={pool.exposure.category} />
              </td>
              {/* APR */}
              <td className="px-4 py-3 text-right">
                <div className="relative group/apr">
                  <div className="font-[family-name:var(--font-geist-mono)] text-emerald-600 dark:text-emerald-400 font-medium cursor-default">
                    {formatApr(pool.yield.apr_total)}
                    {pool.yield.is_estimated && (
                      <span className="ml-1 text-[10px] text-amber-500" title="7-day average unavailable — rate may reflect a temporary spike">~</span>
                    )}
                  </div>
                  {(pool.yield.apr_base !== null || pool.yield.apr_reward !== null) && (
                    <div className="absolute hidden group-hover/apr:block bottom-full right-0 mb-1.5 z-20 w-44 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-lg text-left text-xs" role="tooltip">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-gray-500 dark:text-zinc-400">{formatYieldSource(pool.yield_source)}</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-green-600 dark:text-green-400">{formatApr(pool.yield.apr_base)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-zinc-400">Incentive rewards</span>
                        <span className="font-[family-name:var(--font-geist-mono)] text-blue-600 dark:text-blue-400">{formatApr(pool.yield.apr_reward)}</span>
                      </div>
                      {pool.incentives_summary.sources.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-zinc-700 text-gray-400 dark:text-zinc-500">
                          via {pool.incentives_summary.sources.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
              {/* Daily Rewards */}
              <td className="px-4 py-3 text-right hidden md:table-cell">
                <SimulationTooltip aprTotal={pool.yield.apr_total}>
                  <span className="cursor-help border-b border-dotted border-gray-300 dark:border-zinc-600 font-[family-name:var(--font-geist-mono)] text-gray-700 dark:text-zinc-300">
                    {formatUsd(pool.simulation.daily_earnings_per_1k)}
                  </span>
                </SimulationTooltip>
              </td>
              {/* Actions */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {/* Star (decorative) */}
                  <span
                    className="p-1.5 rounded text-gray-300 dark:text-zinc-600"
                    aria-label="Bookmark (coming soon)"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <ShareButton poolId={pool.id} />
                </div>
              </td>
            </PoolRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
