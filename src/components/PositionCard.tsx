"use client";

import Link from "next/link";
import { ChainDot } from "./ChainDot";
import { CHAIN_BY_ID } from "@/lib/constants";
import { formatProtocolName } from "@/lib/utils";

export type Position = {
  chainId: number;
  protocolName: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  balanceUsd: number;
  balanceNative: number;
  // Matched vault data (from cache lookup)
  vaultSlug: string | null;
  chainNetwork: string | null;
  isRedeemable: boolean;
  underlyingTokenAddress: string | null;
  underlyingTokenDecimals: number | null;
};

function formatBalance(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd > 0) return `$${usd.toPrecision(3)}`;
  return "$0.00";
}

export function PositionCard({
  position,
  onWithdraw,
}: {
  position: Position;
  onWithdraw?: (position: Position) => void;
}) {
  const chain = CHAIN_BY_ID[position.chainId];
  const chainName = chain?.name ?? `Chain ${position.chainId}`;
  const network = chain?.network ?? "unknown";

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/80 p-4 space-y-3">
      {/* Header: chain + protocol */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <ChainDot chain={network} />
          <span className="text-zinc-400">{chainName}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-300 font-medium">
            {formatProtocolName(position.protocolName)}
          </span>
        </div>
      </div>

      {/* Asset + balance */}
      <div>
        <p className="text-2xl font-bold text-zinc-100">
          {formatBalance(position.balanceUsd)}
        </p>
        <p className="text-sm text-zinc-500 mt-0.5">
          {position.balanceNative.toFixed(
            position.balanceNative >= 1 ? 4 : 6,
          )}{" "}
          {position.asset.symbol}
        </p>
        <p className="text-xs text-zinc-600 mt-0.5">{position.asset.name}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {position.vaultSlug && (
          <Link
            href={`/pool/${position.vaultSlug}`}
            className="flex-1 rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            View Vault
          </Link>
        )}
        {position.vaultSlug && (
          <Link
            href={`/pool/${position.vaultSlug}?deposit=1`}
            className="flex-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 px-3 py-2 text-center text-sm font-medium text-white transition-colors"
          >
            Deposit More
          </Link>
        )}
        {position.isRedeemable && onWithdraw && (
          <button
            onClick={() => onWithdraw(position)}
            className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors"
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}
