"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PoolListItem } from "@/lib/types";
import { formatTvl, formatApr, formatUsd, formatProtocolName, formatYieldSource } from "@/lib/utils";
import { SimulationTooltip } from "./SimulationTooltip";
import { ChainDot } from "./ChainDot";
import { ProtocolLogo } from "./ProtocolLogo";

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
      className="group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer hover:scale-[1.005]"
      style={{ backgroundColor: "var(--surface-container-lowest)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-bright)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-container-lowest)";
      }}
      onClick={() => router.push(`/pool/${pool.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/pool/${pool.id}`);
      }}
    >
      {/* Protocol logo */}
      <ProtocolLogo protocol={pool.protocol} symbol={pool.symbol} />

      {/* Name + protocol */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate" style={{ color: "var(--on-surface)" }}>
            {pool.symbol}
          </span>
          {pool.exposure.category === "stablecoin" && (
            <span
              className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--secondary-container)", color: "var(--on-secondary-container)" }}
            >
              Stable
            </span>
          )}
          {pool.exposure.category === "blue_chip" && (
            <span
              className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}
            >
              Blue Chip
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: "var(--outline)" }}>
          <span>{formatProtocolName(pool.protocol)}</span>
          {pool.yield.apr_reward !== null && pool.yield.apr_reward > 0 && (
            <>
              <span style={{ color: "var(--outline-variant)" }}>&middot;</span>
              <span style={{ color: "var(--primary)" }}>{organicPct}% organic</span>
            </>
          )}
        </div>
      </div>

      {/* APY */}
      <div className="w-20 text-right shrink-0">
        <div className="relative group/apr">
          <span className="text-lg font-bold" style={{ color: "var(--secondary)" }}>
            {formatApr(pool.yield.apr_total)}
          </span>
          {pool.yield.is_estimated && (
            <span className="ml-0.5 text-[10px] text-amber-500">~</span>
          )}
          {(pool.yield.apr_base !== null ||
            pool.yield.apr_reward !== null) && (
            <div
              className="absolute hidden group-hover/apr:block bottom-full right-0 mb-2 z-20 w-48 rounded-2xl p-4 shadow-lg text-left text-xs"
              style={{
                backgroundColor: "var(--surface-container-lowest)",
                boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)",
              }}
            >
              <div className="flex justify-between mb-1.5">
                <span style={{ color: "var(--on-surface-variant)" }}>
                  {formatYieldSource(pool.yield_source)}
                </span>
                <span className="font-bold" style={{ color: "var(--secondary)" }}>
                  {formatApr(pool.yield.apr_base)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--on-surface-variant)" }}>Rewards</span>
                <span className="font-bold" style={{ color: "var(--primary)" }}>
                  {formatApr(pool.yield.apr_reward)}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="text-[10px] md:hidden" style={{ color: "var(--outline)" }}>APY</div>
      </div>

      {/* TVL */}
      <div className="w-24 text-right shrink-0 hidden md:block">
        <span className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>
          {formatTvl(pool.tvl_usd)}
        </span>
      </div>

      {/* Daily / $1K */}
      <div className="w-20 text-right shrink-0 hidden md:block">
        <SimulationTooltip aprTotal={pool.yield.apr_total}>
          <span
            className="text-sm cursor-help border-b border-dotted tabular-nums"
            style={{ color: "var(--on-surface-variant)", borderColor: "var(--outline-variant)" }}
          >
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
          className="shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all hidden md:block hover:opacity-90"
          style={{ backgroundColor: "var(--secondary-container)", color: "var(--on-secondary-container)" }}
        >
          Zap In &rarr;
        </Link>
      )}
    </div>
  );
}
