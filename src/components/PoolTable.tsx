import type { PaginatedResponse, PoolListItem } from "@/lib/types";
import { VaultRow } from "./VaultRow";

export function PoolTable({ data }: { data: PaginatedResponse<PoolListItem> }) {
  const pools = data.data;

  if (pools.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: "var(--outline)" }}>
        <p className="text-lg font-medium">No vaults found matching your filters.</p>
        <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-8 py-2">
      {/* Column headers */}
      <div
        className="hidden md:flex items-center gap-4 px-5 py-2 text-[11px] uppercase tracking-wider font-semibold"
        style={{ color: "var(--on-surface-variant)" }}
      >
        <div className="w-10" />
        <div className="flex-1">Strategy</div>
        <div className="w-20 text-right">APY</div>
        <div className="w-24 text-right">TVL</div>
        <div className="w-20 text-right">Daily / $1K</div>
        <div className="w-10 text-center">Chain</div>
        <div className="w-20" />
      </div>

      {/* Vault rows */}
      <div className="space-y-2">
        {pools.map((pool) => (
          <VaultRow key={pool.id} pool={pool} />
        ))}
      </div>
    </div>
  );
}
