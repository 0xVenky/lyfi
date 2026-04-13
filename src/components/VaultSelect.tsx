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
}: {
  selected: VaultOption | null;
  onSelect: (vault: VaultOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const [vaults, setVaults] = useState<VaultOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch depositable vaults on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/v1/pools?depositable=true&limit=500&sort=apr_total&order=desc")
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
        setVaults(
          pools.map((p) => ({
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
  }, []);

  // Unique chains from vaults (for filter pills)
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

  // Filtered list
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
        className="w-full flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-left hover:border-gray-300 transition-colors"
      >
        {selected ? (
          <div className="flex items-center gap-3 min-w-0">
            <ChainDot chain={selected.chain} />
            <div className="min-w-0">
              <span className="font-semibold text-gray-900 text-sm truncate block">
                {selected.symbol}
              </span>
              <span className="text-xs text-gray-400">
                {formatProtocolName(selected.protocol)}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">Select vault</span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {selected && (
            <span className="text-sm font-semibold text-violet-600">
              {formatApr(selected.apr)}
            </span>
          )}
          <span className="text-gray-400 text-sm">&#x25BE;</span>
        </div>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Select a vault
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pb-3">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, protocol..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg bg-gray-50 border border-gray-200 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Chain filter pills */}
            {chains.length > 1 && (
              <div className="px-5 pb-3 flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setChainFilter(null)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                    chainFilter === null
                      ? "bg-violet-50 text-violet-700 border-violet-200"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
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
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                      chainFilter === c.chainId
                        ? "bg-violet-50 text-violet-700 border-violet-200"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Vault list */}
            <div className="max-h-80 overflow-y-auto border-t border-gray-100">
              {loading && (
                <div className="py-8 text-center text-sm text-gray-400">
                  Loading vaults...
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">
                  No vaults found
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
                  className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left ${
                    selected?.id === vault.id ? "bg-violet-50/50" : ""
                  }`}
                >
                  {/* Chain dot + info */}
                  <ChainDot chain={vault.chain} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {vault.symbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        {formatProtocolName(vault.protocol)}
                      </span>
                      <span>&middot;</span>
                      <span>
                        {vault.chain.charAt(0).toUpperCase() +
                          vault.chain.slice(1)}
                      </span>
                      <span>&middot;</span>
                      <span>{formatTvl(vault.tvl)}</span>
                    </div>
                  </div>
                  {/* APR */}
                  <span className="text-sm font-semibold text-violet-600 shrink-0">
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
