import { formatApr, formatYieldSource } from "@/lib/utils";

type YieldData = {
  apr_total: number;
  apr_base: number | null;
  apr_reward: number | null;
  yieldSource: string;
};

/**
 * Expanded bar for pool detail page (12px height with labels + organic ratio).
 */
export function YieldBreakdownExpanded({ yield: y }: { yield: YieldData }) {
  if (y.apr_total === 0) return null;

  const hasBreakdown = y.apr_base !== null || y.apr_reward !== null;
  const basePct = hasBreakdown
    ? Math.min(((y.apr_base ?? 0) / y.apr_total) * 100, 100)
    : 0;
  const organicRatio = hasBreakdown
    ? Math.round(((y.apr_base ?? 0) / y.apr_total) * 100)
    : null;
  const mostlyIncentivized = hasBreakdown && (y.apr_reward ?? 0) > y.apr_total * 0.7;

  return (
    <div className="space-y-2">
      {/* Bar */}
      {hasBreakdown ? (
        <div
          className="flex h-3 w-full rounded-full overflow-hidden"
          role="img"
          aria-label={`${formatYieldSource(y.yieldSource)} ${formatApr(y.apr_base)}, Incentive rewards ${formatApr(y.apr_reward)}`}
        >
          {basePct > 0 && (
            <div
              className="bg-green-500 rounded-l-full"
              style={{ width: `${basePct}%` }}
            />
          )}
          {basePct < 100 && (
            <div className="bg-blue-500 flex-1 rounded-r-full" />
          )}
        </div>
      ) : (
        <div
          className="h-3 w-full rounded-full bg-gray-200 dark:bg-zinc-600"
          aria-label="APR breakdown unavailable"
        />
      )}

      {/* Labels */}
      {hasBreakdown && (
        <div className="flex justify-between text-xs">
          <span className="text-green-600 dark:text-green-400">
            {formatYieldSource(y.yieldSource)}: {formatApr(y.apr_base)}
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            Incentive rewards: {formatApr(y.apr_reward)}
          </span>
        </div>
      )}

      {/* Organic ratio */}
      {organicRatio !== null && (
        <div className="text-xs text-gray-500 dark:text-zinc-400">
          Organic ratio: {organicRatio}%
        </div>
      )}

      {/* Warning */}
      {mostlyIncentivized && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          Mostly incentivized
        </div>
      )}
    </div>
  );
}
