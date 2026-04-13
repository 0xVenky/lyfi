"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAccount, useEnsAddress } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { PositionCard, type Position } from "@/components/PositionCard";
import { WithdrawFlow } from "@/components/WithdrawFlow";
import { ChainDot } from "@/components/ChainDot";
import { CHAIN_BY_ID } from "@/lib/constants";
import type { PoolListItem } from "@/lib/types";

// --- Types ---

type RawPosition = {
  chainId: number;
  protocolName: string;
  asset: { address: string; name: string; symbol: string; decimals: number };
  balanceUsd: string;
  balanceNative: string;
};

type TokenBalance = {
  address: string;
  symbol: string;
  balance: string;
  balanceUsd: number;
  priceUsd: number;
};

type ChainBalances = {
  chainId: number;
  name: string;
  tokens: TokenBalance[];
  totalUsd: number;
};

type BalancesData = { chains: ChainBalances[]; totalUsd: number };

type YieldInsight = {
  tokenSymbol: string;
  balanceUsd: number;
  vaultSymbol: string;
  vaultProtocol: string;
  apr: number;
  yearlyEarnings: number;
  vaultId: string;
};

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const ENS_RE = /^[a-zA-Z0-9-]+\.eth$/;

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toPrecision(3)}`;
  return "$0";
}

function fmtBal(val: string): string {
  const n = parseFloat(val);
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  if (n === 0) return "0";
  return n.toPrecision(4);
}

function fmtApr(n: number): string {
  if (n >= 10) return `${n.toFixed(1)}%`;
  return `${n.toFixed(2)}%`;
}

function fmtProtocol(s: string): string {
  return s.replace(/-v\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Insight computation ---

function computeInsights(
  balances: BalancesData,
  pools: PoolListItem[],
): YieldInsight[] {
  // Group user tokens by symbol (aggregate across chains)
  const bySymbol = new Map<string, number>();
  for (const chain of balances.chains) {
    for (const token of chain.tokens) {
      const sym = token.symbol.toUpperCase();
      bySymbol.set(sym, (bySymbol.get(sym) ?? 0) + token.balanceUsd);
    }
  }

  // Also match WETH to ETH vaults and vice versa
  const ethTotal = (bySymbol.get("ETH") ?? 0) + (bySymbol.get("WETH") ?? 0);
  if (ethTotal > 0) bySymbol.set("ETH_GROUP", ethTotal);

  const depositable = pools.filter((p) => p.is_transactional && p.tvl_usd >= 50000);
  const insights: YieldInsight[] = [];
  const usedSymbols = new Set<string>();

  for (const [sym, usdVal] of bySymbol) {
    if (usdVal < 5 || sym === "ETH_GROUP") continue;
    const searchSyms = sym === "ETH" || sym === "WETH"
      ? ["ETH", "WETH", "STETH", "WSTETH"]
      : [sym];

    const matching = depositable.filter((p) =>
      p.exposure.underlying_tokens.some((ut) =>
        searchSyms.includes(ut.symbol.toUpperCase()),
      ),
    );
    if (matching.length === 0) continue;

    const best = matching.sort((a, b) => b.yield.apr_total - a.yield.apr_total)[0];
    const effectiveUsd = sym === "ETH" || sym === "WETH" ? ethTotal : usdVal;
    const groupKey = sym === "WETH" ? "ETH" : sym;
    if (usedSymbols.has(groupKey)) continue;
    usedSymbols.add(groupKey);

    insights.push({
      tokenSymbol: groupKey,
      balanceUsd: effectiveUsd,
      vaultSymbol: best.symbol,
      vaultProtocol: best.protocol,
      apr: best.yield.apr_total,
      yearlyEarnings: effectiveUsd * (best.yield.apr_total / 100),
      vaultId: best.id,
    });
  }

  return insights.sort((a, b) => b.yearlyEarnings - a.yearlyEarnings).slice(0, 5);
}

// --- Component ---

export default function PortfolioPage() {
  const { address: walletAddress, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [inputAddr, setInputAddr] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [balances, setBalances] = useState<BalancesData | null>(null);
  const [allPools, setAllPools] = useState<PoolListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<Position | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // ENS
  const isEnsInput = ENS_RE.test(inputAddr);
  const { data: ensResolved, isLoading: ensLoading } = useEnsAddress({
    name: isEnsInput ? inputAddr : undefined,
    chainId: 1,
    query: { enabled: isEnsInput },
  });

  const resolvedAddr = isEnsInput ? (ensResolved ?? "") : inputAddr;
  const queryAddress = ADDRESS_RE.test(resolvedAddr)
    ? resolvedAddr
    : walletAddress ?? "";
  const isValidQuery = ADDRESS_RE.test(queryAddress);

  useEffect(() => {
    if (walletAddress && !inputAddr) setInputAddr(walletAddress);
  }, [walletAddress, inputAddr]);

  const fetchAll = useCallback(async () => {
    if (!isValidQuery) return;
    setLoading(true);
    setError(null);

    try {
      const [posRes, poolsRes, balRes] = await Promise.all([
        fetch(`/api/v1/portfolio/${queryAddress}`),
        fetch("/api/v1/pools?limit=500"),
        fetch(`/api/v1/balances/${queryAddress}`),
      ]);

      // --- Pools (used for both position matching + insights) ---
      let pools: PoolListItem[] = [];
      if (poolsRes.ok) {
        const d = await poolsRes.json();
        pools = d.data ?? [];
      }
      setAllPools(pools);

      // --- Positions ---
      let enrichedPositions: Position[] = [];
      if (posRes.ok) {
        const posData = await posRes.json();
        const raw: RawPosition[] = posData.positions ?? [];
        const poolMap = new Map(
          pools.map((p) => [
            `${p.vault_chain_id}-${p.vault_address.toLowerCase()}`,
            p,
          ]),
        );

        enrichedPositions = raw
          .map((r) => {
            const m = poolMap.get(
              `${r.chainId}-${r.asset.address.toLowerCase()}`,
            );
            return {
              chainId: r.chainId,
              protocolName: r.protocolName,
              asset: r.asset,
              balanceUsd: parseFloat(r.balanceUsd) || 0,
              balanceNative: parseFloat(r.balanceNative) || 0,
              vaultSlug: m?.id ?? null,
              chainNetwork: m?.chain ?? null,
              isRedeemable: m?.is_redeemable ?? false,
              underlyingTokenAddress:
                m?.exposure.underlying_tokens[0]?.address ?? null,
              underlyingTokenDecimals:
                m?.exposure.underlying_tokens[0]?.decimals ?? null,
            };
          })
          .filter((p) => p.balanceUsd > 0.01)
          .sort((a, b) => b.balanceUsd - a.balanceUsd);
      }

      // --- Balances ---
      let balData: BalancesData | null = null;
      if (balRes.ok) balData = await balRes.json();

      setPositions(enrichedPositions);
      setBalances(balData);
      setHasFetched(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load portfolio",
      );
    } finally {
      setLoading(false);
    }
  }, [queryAddress, isValidQuery]);

  useEffect(() => {
    if (isConnected && walletAddress && !hasFetched) fetchAll();
  }, [isConnected, walletAddress, hasFetched, fetchAll]);

  const isOwnWallet =
    isConnected &&
    walletAddress?.toLowerCase() === queryAddress.toLowerCase();

  // --- Filter balances to only tokens with yield opportunities ---
  const yieldableSymbols = useMemo(() => {
    if (allPools.length === 0) return new Set<string>();
    const depositable = allPools.filter((p) => p.is_transactional && p.tvl_usd >= 50000);
    const syms = new Set<string>();
    for (const p of depositable) {
      for (const ut of p.exposure.underlying_tokens) {
        syms.add(ut.symbol.toUpperCase());
      }
    }
    // Also add wrapped variants
    if (syms.has("WETH")) syms.add("ETH");
    if (syms.has("ETH")) syms.add("WETH");
    return syms;
  }, [allPools]);

  const filteredBalances: BalancesData | null = useMemo(() => {
    if (!balances || yieldableSymbols.size === 0) return balances;
    const chains: ChainBalances[] = [];
    for (const chain of balances.chains) {
      const tokens = chain.tokens.filter((t) =>
        yieldableSymbols.has(t.symbol.toUpperCase()),
      );
      if (tokens.length > 0) {
        chains.push({
          ...chain,
          tokens,
          totalUsd: tokens.reduce((s, t) => s + t.balanceUsd, 0),
        });
      }
    }
    return {
      chains,
      totalUsd: chains.reduce((s, c) => s + c.totalUsd, 0),
    };
  }, [balances, yieldableSymbols]);

  // --- Yield insights ---
  const insights = useMemo(() => {
    if (!filteredBalances || allPools.length === 0) return [];
    return computeInsights(filteredBalances, allPools);
  }, [filteredBalances, allPools]);

  const totalYearlyPotential = insights.reduce(
    (s, i) => s + i.yearlyEarnings,
    0,
  );

  // --- Persist insights to localStorage for AI chat context ---
  useEffect(() => {
    if (insights.length > 0 && filteredBalances) {
      try {
        localStorage.setItem(
          "yeelds:portfolio-insights",
          JSON.stringify({
            totalIdleUsd: filteredBalances.totalUsd,
            totalYearlyPotential,
            insights: insights.map((i) => ({
              token: i.tokenSymbol,
              balanceUsd: i.balanceUsd,
              vault: i.vaultProtocol,
              apr: i.apr,
              yearlyEarnings: i.yearlyEarnings,
              vaultId: i.vaultId,
            })),
            updatedAt: Date.now(),
          }),
        );
      } catch {
        // localStorage not available — skip
      }
    }
  }, [insights, filteredBalances, totalYearlyPotential]);

  // --- Withdraw modal ---
  if (withdrawTarget) {
    return (
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <button
          onClick={() => setWithdrawTarget(null)}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
        >
          &larr; Back to portfolio
        </button>
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Withdraw from {withdrawTarget.asset.name}
        </h2>
        <WithdrawFlow
          position={withdrawTarget}
          onDone={() => {
            setWithdrawTarget(null);
            fetchAll();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Portfolio</h1>

      {/* Address input */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0x... or name.eth"
            value={inputAddr}
            onChange={(e) => {
              setInputAddr(e.target.value.trim());
              setHasFetched(false);
              setPositions([]);
              setBalances(null);
            }}
            className="flex-1 rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 font-mono"
          />
          <button
            onClick={fetchAll}
            disabled={!isValidQuery || loading}
            className="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-gray-200 disabled:text-gray-400 px-5 py-3 text-sm font-medium text-white transition-colors shrink-0"
          >
            {loading ? "Loading..." : "View"}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          {!isConnected && (
            <button
              onClick={() => openConnectModal?.()}
              className="text-xs text-violet-500 hover:text-violet-600 font-medium"
            >
              Or connect wallet &rarr;
            </button>
          )}
          {isConnected &&
            walletAddress &&
            inputAddr.toLowerCase() !== walletAddress.toLowerCase() && (
              <button
                onClick={() => {
                  setInputAddr(walletAddress);
                  setHasFetched(false);
                  setPositions([]);
                  setBalances(null);
                }}
                className="text-xs text-violet-500 hover:text-violet-600 font-medium"
              >
                Use connected wallet ({walletAddress.slice(0, 6)}...
                {walletAddress.slice(-4)})
              </button>
            )}
          {isEnsInput && ensLoading && (
            <span className="text-xs text-gray-400">Resolving ENS...</span>
          )}
          {isEnsInput && !ensLoading && ensResolved && (
            <span className="text-xs text-gray-400 font-mono">
              {ensResolved.slice(0, 6)}...{ensResolved.slice(-4)}
            </span>
          )}
          {isEnsInput && !ensLoading && !ensResolved && (
            <span className="text-xs text-red-400">ENS name not found</span>
          )}
          {inputAddr && !ADDRESS_RE.test(inputAddr) && !isEnsInput && (
            <span className="text-xs text-red-400">Invalid address</span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-100 rounded w-1/4 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchAll}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && hasFetched && (
        <div className="space-y-4">
          {/* ── Side-by-side cards ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: Portfolio Value */}
            <div className="rounded-2xl p-5 flex flex-col" style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider font-[family-name:var(--font-manrope)]" style={{ color: "var(--on-surface-variant)" }}>
                  Yield-Eligible Tokens
                </h2>
                {filteredBalances && (
                  <span className="text-xl font-bold" style={{ color: "var(--on-surface)" }}>
                    {fmtUsd(filteredBalances.totalUsd)}
                  </span>
                )}
              </div>

              {(!filteredBalances || filteredBalances.chains.length === 0) && (
                <p className="text-sm py-4 text-center flex-1 flex items-center justify-center" style={{ color: "var(--outline)" }}>
                  No yield-eligible tokens found
                </p>
              )}

              {filteredBalances && filteredBalances.chains.length > 0 && (
                <div className="flex-1 overflow-y-auto max-h-72 space-y-3">
                  {filteredBalances.chains.map((chain) => (
                    <div key={chain.chainId}>
                      <div className="flex items-center gap-2 mb-1">
                        <ChainDot
                          chain={
                            CHAIN_BY_ID[chain.chainId]?.network ?? "ethereum"
                          }
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--on-surface-variant)" }}>
                          {chain.name}
                        </span>
                        <span className="text-xs" style={{ color: "var(--outline)" }}>
                          {fmtUsd(chain.totalUsd)}
                        </span>
                      </div>
                      <div className="pl-5 space-y-0.5">
                        {chain.tokens.map((token) => (
                          <div
                            key={token.address}
                            className="flex items-center justify-between text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: "var(--on-surface)" }}>
                                {token.symbol}
                              </span>
                              <span className="text-xs" style={{ color: "var(--outline)" }}>
                                {fmtBal(token.balance)}
                              </span>
                            </div>
                            <span style={{ color: "var(--on-surface-variant)" }}>
                              {fmtUsd(token.balanceUsd)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 2: Earning Yield */}
            <div className="rounded-2xl p-5 flex flex-col" style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider font-[family-name:var(--font-manrope)]" style={{ color: "var(--on-surface-variant)" }}>
                  Earning Yield
                </h2>
                {positions.length > 0 && (
                  <span className="text-xl font-bold" style={{ color: "var(--on-surface)" }}>
                    {fmtUsd(
                      positions.reduce((s, p) => s + p.balanceUsd, 0),
                    )}
                  </span>
                )}
              </div>

              {positions.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm mb-3" style={{ color: "var(--outline)" }}>
                    No vault positions
                  </p>
                  <Link
                    href="/zap"
                    className="rounded-full gradient-primary hover:opacity-90 px-5 py-2 text-xs font-medium text-white transition-opacity"
                  >
                    Start earning &rarr;
                  </Link>
                </div>
              )}

              {positions.length > 0 && (
                <div className="flex-1 overflow-y-auto max-h-72 space-y-3">
                  {positions.map((pos, i) => (
                    <PositionCard
                      key={`${pos.chainId}-${pos.asset.address}-${i}`}
                      position={pos}
                      onWithdraw={
                        isOwnWallet ? setWithdrawTarget : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── AI Yield Insight ── */}
          {insights.length > 0 && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--primary-container)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: "var(--on-primary-container)" }}>
                  &#x1F4A1;
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold font-[family-name:var(--font-manrope)]" style={{ color: "var(--on-primary)" }}>
                    Yield Opportunity
                  </h3>
                  <p className="text-sm mt-1" style={{ color: "var(--on-primary-container)" }}>
                    {fmtUsd(filteredBalances?.totalUsd ?? 0)} in idle tokens could
                    earn{" "}
                    <span className="font-semibold" style={{ color: "var(--on-primary)" }}>
                      ~{fmtUsd(totalYearlyPotential)}/year
                    </span>{" "}
                    at current rates.
                  </p>

                  <div className="mt-3 space-y-2">
                    {insights.map((ins) => (
                      <Link
                        key={ins.vaultId}
                        href={`/pool/${ins.vaultId}?deposit=1`}
                        className="flex items-center justify-between rounded-xl px-3 py-2 transition-opacity hover:opacity-80 group"
                        style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                      >
                        <div className="text-sm">
                          <span className="font-medium" style={{ color: "var(--on-primary)" }}>
                            {ins.tokenSymbol}
                          </span>
                          <span className="mx-1.5" style={{ color: "var(--on-primary-container)" }}>&rarr;</span>
                          <span style={{ color: "var(--on-primary-container)" }}>
                            {fmtProtocol(ins.vaultProtocol)}{" "}
                            <span className="font-medium" style={{ color: "var(--secondary-container)" }}>
                              {fmtApr(ins.apr)}
                            </span>
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-medium" style={{ color: "var(--secondary-container)" }}>
                            +{fmtUsd(ins.yearlyEarnings)}/yr
                          </span>
                          <span className="ml-2 transition-opacity group-hover:opacity-100 opacity-60" style={{ color: "var(--on-primary-container)" }}>
                            &rarr;
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <Link
                    href="/zap"
                    className="inline-flex items-center gap-1 mt-3 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ color: "var(--on-primary)" }}
                  >
                    Zap into vaults &rarr;
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Viewing notice */}
          {!isOwnWallet && (
            <p className="text-center text-xs text-gray-400">
              Viewing {queryAddress.slice(0, 6)}...{queryAddress.slice(-4)}{" "}
              &middot; Connect wallet to deposit or withdraw
            </p>
          )}
        </div>
      )}
    </div>
  );
}
