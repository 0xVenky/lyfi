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
    <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--surface-container-low)" }}>
      {/* Header: chain + protocol */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <ChainDot chain={network} />
          <span style={{ color: "var(--on-surface-variant)" }}>{chainName}</span>
          <span style={{ color: "var(--outline)" }}>/</span>
          <span className="font-medium" style={{ color: "var(--on-surface)" }}>
            {formatProtocolName(position.protocolName)}
          </span>
        </div>
      </div>

      {/* Asset + balance */}
      <div>
        <p className="text-2xl font-bold" style={{ color: "var(--on-surface)" }}>
          {formatBalance(position.balanceUsd)}
        </p>
        <p className="text-sm mt-0.5" style={{ color: "var(--on-surface-variant)" }}>
          {position.balanceNative.toFixed(
            position.balanceNative >= 1 ? 4 : 6,
          )}{" "}
          {position.asset.symbol}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--outline)" }}>{position.asset.name}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {position.vaultSlug && (
          <Link
            href={`/pool/${position.vaultSlug}`}
            className="flex-1 rounded-xl px-3 py-2 text-center text-sm transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}
          >
            View Vault
          </Link>
        )}
        {position.vaultSlug && (
          <Link
            href={`/pool/${position.vaultSlug}?deposit=1`}
            className="flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            Deposit More
          </Link>
        )}
        {position.isRedeemable && onWithdraw && (
          <button
            onClick={() => onWithdraw(position)}
            className="flex-1 rounded-xl px-3 py-2 text-sm transition-colors hover:opacity-80"
            style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}
          >
            Withdraw
          </button>
        )}
      </div>
    </div>
  );
}
