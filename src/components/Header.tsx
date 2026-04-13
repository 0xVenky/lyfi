import type { StatsResponse } from "@/lib/types";
import { formatTvl } from "@/lib/utils";
import { WalletButton } from "./WalletButton";

export function Header({ stats }: { stats: StatsResponse }) {
  const refreshedAgo = stats.last_refreshed
    ? formatRelativeTime(stats.last_refreshed)
    : null;

  return (
    <div className="px-4 sm:px-6 py-5 border-b border-gray-100">
      <div className="flex items-start justify-between">
        {/* Stats */}
        <div className="flex items-center gap-8">
          <Stat label="Total Vaults" value={String(stats.total_pools)} />
          <Stat label="Total TVL" value={formatTvl(stats.total_tvl_usd)} />
          <Stat label="Chains" value={String(stats.chains_covered)} />
        </div>
        <WalletButton />
      </div>
      {refreshedAgo && (
        <p className="text-[11px] text-gray-300 mt-2">Updated {refreshedAgo}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</p>
      <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
