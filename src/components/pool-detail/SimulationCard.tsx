import type { PoolDetail } from "@/lib/types";
import { formatUsd } from "@/lib/utils";

export function SimulationCard({ pool }: { pool: PoolDetail }) {
  const { simulation } = pool;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-5">
      <h2 className="text-sm font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-4">
        Simulation &mdash; $1,000 Deposit
      </h2>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-xl font-bold font-[family-name:var(--font-geist-mono)] text-gray-900 dark:text-zinc-100">
            {formatUsd(simulation.daily_earnings_per_1k)}
          </div>
          <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">per day</div>
        </div>
        <div>
          <div className="text-xl font-bold font-[family-name:var(--font-geist-mono)] text-gray-900 dark:text-zinc-100">
            {formatUsd(simulation.monthly_earnings_per_1k)}
          </div>
          <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">per month</div>
        </div>
        <div>
          <div className="text-xl font-bold font-[family-name:var(--font-geist-mono)] text-gray-900 dark:text-zinc-100">
            {formatUsd(simulation.yearly_earnings_per_1k)}
          </div>
          <div className="text-xs text-gray-400 dark:text-zinc-500 mt-1">per year</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-zinc-600 mt-4">
        Estimates based on current APR. Actual returns may vary.
      </p>
    </div>
  );
}
