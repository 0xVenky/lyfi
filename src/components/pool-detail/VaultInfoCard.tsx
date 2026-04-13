import type { PoolDetail } from "@/lib/types";
import { ChainDot } from "@/components/ChainDot";

export function VaultInfoCard({ pool }: { pool: PoolDetail }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-5">
      <h2 className="text-sm font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-4">
        Vault Info
      </h2>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <dt className="text-gray-500 dark:text-zinc-400">Chain</dt>
          <dd className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
            <ChainDot chain={pool.chain} />
            {pool.chain.charAt(0).toUpperCase() + pool.chain.slice(1)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-zinc-400">Type</dt>
          <dd className="text-gray-700 dark:text-zinc-300">
            {pool.pool_type === "vault" ? "Single-asset vault" : "LP (multi-asset)"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-zinc-400">Stability</dt>
          <dd className="text-gray-700 dark:text-zinc-300">
            {pool.exposure.category
              ? pool.exposure.category.charAt(0).toUpperCase() + pool.exposure.category.slice(1)
              : "Unknown"}
          </dd>
        </div>
        {pool.exposure.underlying_tokens.length > 0 && (
          <div>
            <dt className="text-gray-500 dark:text-zinc-400 mb-2">Underlying tokens</dt>
            <dd className="flex flex-wrap gap-2">
              {pool.exposure.underlying_tokens.map((t) => (
                <span
                  key={t.address}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-gray-700 dark:text-zinc-300"
                >
                  {t.symbol}
                </span>
              ))}
            </dd>
          </div>
        )}
        {pool.yield.apr_reward !== null && pool.yield.apr_reward > 0 && (
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-zinc-400">Reward APY</dt>
            <dd className="font-[family-name:var(--font-geist-mono)] text-blue-500 dark:text-blue-400">
              {pool.yield.apr_reward.toFixed(2)}%
            </dd>
          </div>
        )}
        {pool.yield.apr_base_7d !== null && (
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-zinc-400">7d Avg APY</dt>
            <dd className="font-[family-name:var(--font-geist-mono)] text-gray-700 dark:text-zinc-300">
              {pool.yield.apr_base_7d.toFixed(2)}%
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
