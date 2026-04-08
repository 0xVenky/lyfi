import type { PoolDetail } from "@/lib/types";
import { formatApr, formatYieldSource } from "@/lib/utils";
import { YieldBreakdownExpanded } from "@/components/YieldBreakdown";

export function YieldCard({ pool }: { pool: PoolDetail }) {
  const { yield: y } = pool;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-5">
      <h2 className="text-sm font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-4">
        Yield Breakdown
      </h2>
      <div className="text-3xl font-bold font-[family-name:var(--font-geist-mono)] text-emerald-600 dark:text-emerald-400 mb-1">
        {formatApr(y.apr_total)}
      </div>
      {y.is_estimated && (
        <p className="text-xs text-amber-500 mb-4">
          7-day average unavailable — rate may reflect a temporary spike
        </p>
      )}
      {!y.is_estimated && <div className="mb-4" />}

      {/* APR breakdown bar */}
      <div className="mb-4">
        <YieldBreakdownExpanded yield={{ ...y, yieldSource: pool.yield_source }} />
      </div>

      <dl className="space-y-2 text-sm">
        {y.apr_base_7d !== null && (
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-zinc-400">7d Avg {formatYieldSource(pool.yield_source)}</dt>
            <dd className="font-[family-name:var(--font-geist-mono)] text-gray-700 dark:text-zinc-300">
              {formatApr(y.apr_base_7d)}
            </dd>
          </div>
        )}
        {y.il_7d !== null && (
          <div className="flex justify-between">
            <dt className="text-gray-500 dark:text-zinc-400">IL 7d</dt>
            <dd className="font-[family-name:var(--font-geist-mono)] text-red-500 dark:text-red-400/70">
              {formatApr(y.il_7d)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
