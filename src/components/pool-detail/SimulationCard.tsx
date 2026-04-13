import type { PoolDetail } from "@/lib/types";
import { formatUsd } from "@/lib/utils";

export function SimulationCard({ pool }: { pool: PoolDetail }) {
  const { simulation } = pool;

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
      <h2
        className="text-sm font-medium uppercase tracking-wider mb-4 font-[family-name:var(--font-manrope)]"
        style={{ color: "var(--on-surface-variant)" }}
      >
        Simulation &mdash; $1,000 Deposit
      </h2>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-xl font-bold tabular-nums font-medium" style={{ color: "var(--on-surface)" }}>
            {formatUsd(simulation.daily_earnings_per_1k)}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--outline)" }}>per day</div>
        </div>
        <div>
          <div className="text-xl font-bold tabular-nums font-medium" style={{ color: "var(--on-surface)" }}>
            {formatUsd(simulation.monthly_earnings_per_1k)}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--outline)" }}>per month</div>
        </div>
        <div>
          <div className="text-xl font-bold tabular-nums font-medium" style={{ color: "var(--on-surface)" }}>
            {formatUsd(simulation.yearly_earnings_per_1k)}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--outline)" }}>per year</div>
        </div>
      </div>
      <p className="text-xs mt-4" style={{ color: "var(--outline)" }}>
        Estimates based on current APY. Actual returns may vary.
      </p>
    </div>
  );
}
