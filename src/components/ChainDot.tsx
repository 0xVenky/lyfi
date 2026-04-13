"use client";

import { useState } from "react";

// Chain ID mapping for logo URLs
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  optimism: 10,
  bsc: 56,
  gnosis: 100,
  unichain: 130,
  polygon: 137,
  monad: 143,
  sonic: 146,
  mantle: 5000,
  base: 8453,
  arbitrum: 42161,
  celo: 42220,
  avalanche: 43114,
  linea: 59144,
  berachain: 80094,
  scroll: 534352,
  katana: 747474,
};

export const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627EEA",
  optimism: "#FF0420",
  bsc: "#F0B90B",
  gnosis: "#04795B",
  unichain: "#FF007A",
  polygon: "#8247E5",
  monad: "#836EF9",
  sonic: "#5B6DEF",
  mantle: "#000000",
  base: "#0052FF",
  arbitrum: "#12AAFF",
  celo: "#FCFF52",
  avalanche: "#E84142",
  linea: "#61DFFF",
  berachain: "#CC7722",
  scroll: "#FFEEDA",
  katana: "#FF4444",
};

function chainLogoUrl(chain: string): string | null {
  const id = CHAIN_IDS[chain];
  if (!id) return null;
  return `https://assets.smold.app/api/chain/${id}/logo-128.png`;
}

/**
 * Small round chain icon (24x24) with logo image and letter fallback.
 */
export function ChainDot({ chain, size = 24 }: { chain: string; size?: number }) {
  const name = chain.charAt(0).toUpperCase() + chain.slice(1);
  const letter = chain.charAt(0).toUpperCase();
  const logoUrl = chainLogoUrl(chain);
  const color = CHAIN_COLORS[chain] ?? "#9ca3af";
  const [imgError, setImgError] = useState(false);

  return (
    <span
      className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
      title={name}
      aria-label={name}
    >
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={name}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-white font-bold" style={{ fontSize: size * 0.42 }}>
          {letter}
        </span>
      )}
    </span>
  );
}

/**
 * Chain badge with logo + name text, for use in strategy cards and pool detail.
 */
export function ChainBadge({
  chain,
  className = "",
  style,
}: {
  chain: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const name = chain.charAt(0).toUpperCase() + chain.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${className}`}
      style={style}
    >
      <ChainDot chain={chain} size={16} />
      {name}
    </span>
  );
}
