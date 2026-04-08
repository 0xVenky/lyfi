import type { StatsResponse } from "@/lib/types";
import { formatTvl } from "@/lib/utils";

export function Header({ stats }: { stats: StatsResponse }) {
  const refreshedAgo = stats.last_refreshed
    ? formatRelativeTime(stats.last_refreshed)
    : null;

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-gray-100 dark:border-zinc-800/50">
      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-zinc-500">
        <span>{stats.total_pools} pools</span>
        <span aria-hidden="true">&middot;</span>
        <span>{formatTvl(stats.total_tvl_usd)} TVL</span>
        <span aria-hidden="true">&middot;</span>
        <span>{stats.chains_covered} chains</span>
        {refreshedAgo && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span>Updated {refreshedAgo}</span>
          </>
        )}
      </div>
      {/* Wallet button will go here */}
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
