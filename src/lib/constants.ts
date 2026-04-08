// Yield unit — LI.FI returns APY natively (Decision H1)
export const YIELD_UNIT = "APY" as const;

// LI.FI Earn supported chains (17 chains)
export const SUPPORTED_CHAINS = [
  { chainId: 1, name: "Ethereum", network: "ethereum", color: "#627EEA" },
  { chainId: 10, name: "Optimism", network: "optimism", color: "#FF0420" },
  { chainId: 56, name: "BSC", network: "bsc", color: "#F0B90B" },
  { chainId: 100, name: "Gnosis", network: "gnosis", color: "#04795B" },
  { chainId: 130, name: "Unichain", network: "unichain", color: "#FF007A" },
  { chainId: 137, name: "Polygon", network: "polygon", color: "#8247E5" },
  { chainId: 143, name: "Monad", network: "monad", color: "#836EF9" },
  { chainId: 146, name: "Sonic", network: "sonic", color: "#5B6DEF" },
  { chainId: 5000, name: "Mantle", network: "mantle", color: "#000000" },
  { chainId: 8453, name: "Base", network: "base", color: "#0052FF" },
  { chainId: 42161, name: "Arbitrum", network: "arbitrum", color: "#12AAFF" },
  { chainId: 42220, name: "Celo", network: "celo", color: "#FCFF52" },
  { chainId: 43114, name: "Avalanche", network: "avalanche", color: "#E84142" },
  { chainId: 59144, name: "Linea", network: "linea", color: "#61DFFF" },
  { chainId: 80094, name: "Berachain", network: "berachain", color: "#CC7722" },
  { chainId: 534352, name: "Scroll", network: "scroll", color: "#FFEEDA" },
  { chainId: 747474, name: "Katana", network: "katana", color: "#FF4444" },
] as const;

export type ChainInfo = (typeof SUPPORTED_CHAINS)[number];

export const CHAIN_BY_ID: Record<number, ChainInfo> = Object.fromEntries(
  SUPPORTED_CHAINS.map(c => [c.chainId, c])
) as Record<number, ChainInfo>;

// Pagination
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// APY bounds (same as before, just renamed)
export const MAX_REASONABLE_APY = 10000;

// LI.FI Earn API
export const LIFI_EARN_BASE_URL = "https://earn.li.fi";
export const LIFI_COMPOSER_BASE_URL = "https://li.quest";

// Yield source types — where the yield comes from
export const YIELD_SOURCE_TYPES = [
  "trading_fees", "lending_interest", "staking_rewards",
  "strategy_returns", "rwa_yield",
] as const;

export type YieldSourceType = (typeof YIELD_SOURCE_TYPES)[number];
