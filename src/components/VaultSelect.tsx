"use client";

import { useState, useEffect, useMemo } from "react";
import { ChainDot } from "./ChainDot";
import { SUPPORTED_CHAINS, CHAIN_BY_ID } from "@/lib/constants";
import { formatProtocolName } from "@/lib/utils";

export type VaultOption = {
  id: string;
  symbol: string;
  protocol: string;
  chain: string;
  chainId: number;
  address: string;
  apr: number;
  tvl: number;
  underlying_tokens: { address: string; symbol: string; decimals: number }[];
  isRedeemable?: boolean;
};

function formatApr(n: number): string {
  if (n >= 100) return `${Math.round(n)}%`;
  if (n >= 10) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}

function formatTvl(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

export function VaultSelect({
  selected,
  onSelect,
  redeemableOnly = false,
  externalVaults,
  emptyMessage,
}: {
  selected: VaultOption | null;
  onSelect: (vault: VaultOption) => void;
  redeemableOnly?: boolean;
  /** When provided, skip API fetch and use these vaults directly. */
  externalVaults?: VaultOption[];
  /** Message shown when no vaults are available. */
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const [vaults, setVaults] = useState<VaultOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Use external vaults if provided
  useEffect(() => {
    if (externalVaults) {
      setVaults(externalVaults);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const query = redeemableOnly
      ? "/api/v1/pools?redeemable=true&limit=500&sort=apr_total&order=desc"
      : "/api/v1/pools?depositable=true&limit=500&sort=apr_total&order=desc";
    fetch(query)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const pools = (data.data ?? []) as Array<{
          id: string;
          symbol: string;
          protocol: string;
          chain: string;
          vault_chain_id: number;
          vault_address: string;
          is_redeemable: boolean;
          yield: { apr_total: number };
          tvl_usd: number;
          exposure: {
            underlying_tokens: {
              address: string;
              symbol: string;
              decimals: number;
            }[];
          };
        }>;
        const filtered = redeemableOnly ? pools.filter((p) => p.is_redeemable) : pools;
        setVaults(
          filtered.map((p) => ({
            id: p.id,
            symbol: p.symbol,
            protocol: p.protocol,
            chain: p.chain,
            chainId: p.vault_chain_id,
            address: p.vault_address,
            apr: p.yield.apr_total,
            tvl: p.tvl_usd,
            underlying_tokens: p.exposure.underlying_tokens,
          })),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [externalVaults, redeemableOnly]);

  const chains = useMemo(() => {
    const counts = new Map<number, number>();
    for (const v of vaults) {
      counts.set(v.chainId, (counts.get(v.chainId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => CHAIN_BY_ID[id])
      .filter(Boolean);
  }, [vaults]);

  const filtered = useMemo(() => {
    let list = vaults;
    if (chainFilter) list = list.filter((v) => v.chainId === chainFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.symbol.toLowerCase().includes(q) ||
          v.protocol.toLowerCase().includes(q),
      );
    }
    return list;
  }, [vaults, search, chainFilter]);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors"
        style={{ backgroundColor: "var(--surface-container-low)" }}
      >
        {selected ? (
          <div className="flex items-center gap-3 min-w-0">
            <ChainDot chain={selected.chain} />
            <div className="min-w-0">
              <span className="font-semibold text-sm truncate block" style={{ color: "var(--on-surface)" }}>
                {selected.symbol}
              </span>
              <span className="text-xs" style={{ color: "var(--outline)" }}>
                {formatProtocolName(selected.protocol)}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-sm" style={{ color: "var(--outline)" }}>Select vault</span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {selected && (
            <span className="text-sm font-bold" style={{ color: "var(--secondary)" }}>
              {formatApr(selected.apr)}
            </span>
          )}
          <span style={{ color: "var(--outline)" }}>&#x25BE;</span>
        </div>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
              <h3 className="text-base font-bold font-[family-name:var(--font-manrope)]" style={{ color: "var(--on-surface)" }}>
                Select a vault
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 transition-colors"
                style={{ color: "var(--outline)" }}
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pb-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px]" style={{ color: "var(--outline)" }}>search</span>
                <input
                  type="text"
                  placeholder="Search by name, protocol..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm border-none focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  style={{ backgroundColor: "var(--surface-container-low)", color: "var(--on-surface)" }}
                  autoFocus
                />
              </div>
            </div>

            {/* Chain filter pills */}
            {chains.length > 1 && (
              <div className="px-6 pb-3 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                <button
                  onClick={() => setChainFilter(null)}
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all"
                  style={
                    chainFilter === null
                      ? { background: "linear-gradient(135deg, #630ed4, #7c3aed)", color: "#fff" }
                      : { backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }
                  }
                >
                  All
                </button>
                {chains.map((c) => (
                  <button
                    key={c.chainId}
                    onClick={() =>
                      setChainFilter(
                        chainFilter === c.chainId ? null : c.chainId,
                      )
                    }
                    className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all"
                    style={
                      chainFilter === c.chainId
                        ? { background: "linear-gradient(135deg, #630ed4, #7c3aed)", color: "#fff" }
                        : { backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }
                    }
                  >
                    <ChainDot chain={c.network} size={14} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Vault list */}
            <div className="max-h-80 overflow-y-auto" style={{ borderTop: "1px solid var(--surface-container-high)" }}>
              {loading && (
                <div className="py-8 text-center text-sm" style={{ color: "var(--outline)" }}>
                  Loading vaults...
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="py-8 text-center text-sm" style={{ color: "var(--outline)" }}>
                  {emptyMessage ?? "No vaults found"}
                </div>
              )}
              {filtered.map((vault) => (
                <button
                  key={vault.id}
                  onClick={() => {
                    onSelect(vault);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-3 px-6 py-3 transition-colors text-left"
                  style={{
                    backgroundColor: selected?.id === vault.id ? "var(--surface-container-low)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (selected?.id !== vault.id) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-bright)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = selected?.id === vault.id ? "var(--surface-container-low)" : "transparent";
                  }}
                >
                  <ChainDot chain={vault.chain} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate" style={{ color: "var(--on-surface)" }}>
                        {vault.symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: "var(--outline)" }}>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}>
                        {formatProtocolName(vault.protocol)}
                      </span>
                      <span>&middot;</span>
                      <span className="inline-flex items-center gap-1">
                        <ChainDot chain={vault.chain} size={14} />
                        {vault.chain.charAt(0).toUpperCase() + vault.chain.slice(1)}
                      </span>
                      <span>&middot;</span>
                      <span>{formatTvl(vault.tvl)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold shrink-0" style={{ color: "var(--secondary)" }}>
                    {formatApr(vault.apr)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
