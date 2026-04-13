import type { PoolDetail } from "@/lib/types";
import { formatApr, formatYieldSource } from "@/lib/utils";
import { YieldBreakdownExpanded } from "@/components/YieldBreakdown";

export function YieldCard({ pool }: { pool: PoolDetail }) {
  const { yield: y } = pool;

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
      <h2
        className="text-sm font-medium uppercase tracking-wider mb-4 font-[family-name:var(--font-manrope)]"
        style={{ color: "var(--on-surface-variant)" }}
      >
        Yield Breakdown
      </h2>
      <div
        className="text-3xl font-bold tabular-nums font-medium mb-1"
        style={{ color: "var(--secondary)" }}
      >
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
            <dt style={{ color: "var(--on-surface-variant)" }}>7d Avg {formatYieldSource(pool.yield_source)}</dt>
            <dd className="tabular-nums font-medium" style={{ color: "var(--on-surface)" }}>
              {formatApr(y.apr_base_7d)}
            </dd>
          </div>
        )}
        {y.il_7d !== null && (
          <div className="flex justify-between">
            <dt style={{ color: "var(--on-surface-variant)" }}>IL 7d</dt>
            <dd className="tabular-nums font-medium text-red-500 dark:text-red-400/70">
              {formatApr(y.il_7d)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
