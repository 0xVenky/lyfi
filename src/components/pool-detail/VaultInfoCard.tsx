import type { PoolDetail } from "@/lib/types";
import { ChainDot, ChainBadge } from "@/components/ChainDot";

export function VaultInfoCard({ pool }: { pool: PoolDetail }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
      <h2
        className="text-sm font-medium uppercase tracking-wider mb-4 font-[family-name:var(--font-manrope)]"
        style={{ color: "var(--on-surface-variant)" }}
      >
        Vault Info
      </h2>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <dt style={{ color: "var(--on-surface-variant)" }}>Chain</dt>
          <dd>
            <ChainBadge
              chain={pool.chain}
              className="px-2.5 py-0.5"
              style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface)" }}
            />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--on-surface-variant)" }}>Type</dt>
          <dd style={{ color: "var(--on-surface)" }}>
            {pool.pool_type === "vault" ? "Single-asset vault" : "LP (multi-asset)"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt style={{ color: "var(--on-surface-variant)" }}>Stability</dt>
          <dd style={{ color: "var(--on-surface)" }}>
            {pool.exposure.category
              ? pool.exposure.category.charAt(0).toUpperCase() + pool.exposure.category.slice(1)
              : "Unknown"}
          </dd>
        </div>
        {pool.exposure.underlying_tokens.length > 0 && (
          <div>
            <dt className="mb-2" style={{ color: "var(--on-surface-variant)" }}>Underlying tokens</dt>
            <dd className="flex flex-wrap gap-2">
              {pool.exposure.underlying_tokens.map((t) => (
                <span
                  key={t.address}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface)" }}
                >
                  {t.symbol}
                </span>
              ))}
            </dd>
          </div>
        )}
        {pool.yield.apr_reward !== null && pool.yield.apr_reward > 0 && (
          <div className="flex justify-between">
            <dt style={{ color: "var(--on-surface-variant)" }}>Reward APY</dt>
            <dd className="tabular-nums font-medium" style={{ color: "var(--primary)" }}>
              {pool.yield.apr_reward.toFixed(2)}%
            </dd>
          </div>
        )}
        {pool.yield.apr_base_7d !== null && (
          <div className="flex justify-between">
            <dt style={{ color: "var(--on-surface-variant)" }}>7d Avg APY</dt>
            <dd className="tabular-nums font-medium" style={{ color: "var(--on-surface)" }}>
              {pool.yield.apr_base_7d.toFixed(2)}%
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
