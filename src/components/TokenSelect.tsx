"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits, type Address } from "viem";
import {
  NATIVE_TOKEN_ADDRESS,
  NATIVE_TOKENS,
  ERC20_TOKENS_BY_CHAIN,
  type CommonToken,
} from "@/lib/constants";

export type SelectedToken = CommonToken & {
  balance?: string;
  balanceRaw?: bigint;
};

function formatBal(val: string): string {
  const num = parseFloat(val);
  if (num === 0) return "0";
  if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  return num.toPrecision(4);
}

export function TokenSelect({
  chainId,
  vaultUnderlyingTokens,
  selected,
  onSelect,
}: {
  chainId: number;
  vaultUnderlyingTokens: { address: string; symbol: string; decimals: number }[];
  selected: CommonToken;
  onSelect: (token: SelectedToken) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { address: wallet } = useAccount();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Build deduplicated token list: native + underlying + common ERC20s
  const tokens = useMemo(() => {
    const native = NATIVE_TOKENS[chainId];
    const erc20s = ERC20_TOKENS_BY_CHAIN[chainId] ?? [];
    const underlying = vaultUnderlyingTokens.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    }));

    const seen = new Set<string>();
    const result: CommonToken[] = [];
    for (const t of [
      ...(native ? [native] : []),
      ...underlying,
      ...erc20s,
    ]) {
      const key = t.address.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(t);
      }
    }
    return result;
  }, [chainId, vaultUnderlyingTokens]);

  const erc20Tokens = useMemo(
    () => tokens.filter((t) => t.address.toLowerCase() !== NATIVE_TOKEN_ADDRESS),
    [tokens],
  );

  // Native balance
  const { data: nativeBal } = useBalance({ address: wallet, chainId });

  // ERC20 balances via multicall
  const contracts = useMemo(
    () =>
      wallet
        ? erc20Tokens.map((t) => ({
            address: t.address as Address,
            abi: erc20Abi as typeof erc20Abi,
            functionName: "balanceOf" as const,
            args: [wallet] as const,
            chainId,
          }))
        : [],
    [erc20Tokens, wallet, chainId],
  );

  const { data: erc20Bals } = useReadContracts({
    contracts,
    query: { enabled: !!wallet && contracts.length > 0 },
  });

  // Enrich tokens with balances
  const enriched: SelectedToken[] = useMemo(() => {
    return tokens.map((t) => {
      if (t.address.toLowerCase() === NATIVE_TOKEN_ADDRESS) {
        return {
          ...t,
          balance: nativeBal
            ? formatBal(formatUnits(nativeBal.value, nativeBal.decimals))
            : undefined,
          balanceRaw: nativeBal?.value,
        };
      }
      const idx = erc20Tokens.findIndex(
        (e) => e.address.toLowerCase() === t.address.toLowerCase(),
      );
      if (idx >= 0 && erc20Bals?.[idx]?.result !== undefined) {
        const raw = erc20Bals[idx].result as bigint;
        return {
          ...t,
          balance: formatBal(formatUnits(raw, t.decimals)),
          balanceRaw: raw,
        };
      }
      return t;
    });
  }, [tokens, nativeBal, erc20Bals, erc20Tokens]);

  // Sort: tokens with balance first
  const sorted = useMemo(
    () =>
      [...enriched].sort((a, b) => {
        const aHas = (a.balanceRaw ?? BigInt(0)) > BigInt(0) ? 1 : 0;
        const bHas = (b.balanceRaw ?? BigInt(0)) > BigInt(0) ? 1 : 0;
        if (bHas !== aHas) return bHas - aHas;
        return a.symbol.localeCompare(b.symbol);
      }),
    [enriched],
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors"
      >
        {selected.symbol}
        <svg
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 max-h-60 overflow-y-auto rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl">
          {sorted.map((token) => (
            <button
              key={token.address}
              onClick={() => {
                onSelect(token);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-700/50 transition-colors ${
                token.address.toLowerCase() === selected.address.toLowerCase()
                  ? "bg-zinc-700/30 text-emerald-400"
                  : "text-zinc-300"
              }`}
            >
              <span className="font-medium">{token.symbol}</span>
              {token.balance !== undefined && (
                <span className="text-xs text-zinc-500">{token.balance}</span>
              )}
            </button>
          ))}
          {sorted.length === 0 && (
            <div className="px-3 py-2 text-xs text-zinc-500">
              No tokens available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
