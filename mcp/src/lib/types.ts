// Chain ID → network name mapping (display names for tool output)
export const CHAIN_MAP: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  56: "bsc",
  100: "gnosis",
  130: "unichain",
  137: "polygon",
  143: "monad",
  146: "sonic",
  5000: "mantle",
  8453: "base",
  42161: "arbitrum",
  42220: "celo",
  43114: "avalanche",
  59144: "linea",
  80094: "berachain",
  534352: "scroll",
  747474: "katana",
};

// Reverse: network name → chain ID
export const NETWORK_TO_CHAIN: Record<string, number> = Object.fromEntries(
  Object.entries(CHAIN_MAP).map(([id, name]) => [name, Number(id)])
);

export type LifiToken = {
  address: string;
  symbol: string;
  decimals: number;
};

export type LifiVault = {
  address: string;
  chainId: number;
  network: string;
  slug: string;
  name: string;
  protocol: { name: string; url: string };
  provider: string;
  tags: string[];
  underlyingTokens: LifiToken[];
  analytics: {
    apy: { base: number; reward: number | null; total: number };
    apy1d: number | null;
    apy7d: number | null;
    apy30d: number | null;
    tvl: { usd: string };
    updatedAt: string;
  };
  depositPacks: { name: string; stepsType: string }[];
  redeemPacks: { name: string; stepsType: string }[];
  isTransactional: boolean;
  isRedeemable: boolean;
  description?: string;
};

export type VaultsResponse = {
  data: LifiVault[];
  nextCursor?: string | null;
  total: number;
};
