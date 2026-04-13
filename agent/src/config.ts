import type { ChainConfig, LiveChainConfig } from "./types.js";

export const CONFIG = {
  // Mode: "simulation" uses virtual portfolio, "live" uses real transactions
  MODE: (process.env.MODE ?? "simulation") as "simulation" | "live",
  STARTING_CAPITAL_USD: 1_000_000,

  // Schedule
  CHECK_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes

  // Operating chains — all LI.FI Earn chains with USDC vaults
  CHAINS: [
    { chainId: 1, name: "Ethereum", network: "ethereum", usdcAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", estimatedGasUsd: 2.00 },
    { chainId: 8453, name: "Base", network: "base", usdcAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", estimatedGasUsd: 0.03 },
    { chainId: 42161, name: "Arbitrum", network: "arbitrum", usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", estimatedGasUsd: 0.10 },
    { chainId: 10, name: "Optimism", network: "optimism", usdcAddress: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", estimatedGasUsd: 0.03 },
    { chainId: 137, name: "Polygon", network: "polygon", usdcAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", estimatedGasUsd: 0.01 },
    { chainId: 43114, name: "Avalanche", network: "avalanche", usdcAddress: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", estimatedGasUsd: 0.05 },
    { chainId: 59144, name: "Linea", network: "linea", usdcAddress: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff", estimatedGasUsd: 0.05 },
    { chainId: 130, name: "Unichain", network: "unichain", usdcAddress: "0x078d782b760474a361dda0af3839290b0ef57ad6", estimatedGasUsd: 0.03 },
    { chainId: 100, name: "Gnosis", network: "gnosis", usdcAddress: "0x2a22f9c3b484c3629090feed35f17ff8f88f76f0", estimatedGasUsd: 0.01 },
    { chainId: 534352, name: "Scroll", network: "scroll", usdcAddress: "0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4", estimatedGasUsd: 0.05 },
    { chainId: 143, name: "Monad", network: "monad", usdcAddress: "0x754704bc059f8c67012fed69bc8a327a5aafb603", estimatedGasUsd: 0.01 },
  ] satisfies ChainConfig[],

  // Cross-chain costs (simulated)
  CROSS_CHAIN_GAS_USD: 3.00,

  // Rebalance thresholds
  SAME_CHAIN_MIN_APY_IMPROVEMENT: 0.3,
  CROSS_CHAIN_MIN_APY_IMPROVEMENT: 0.8,
  MAX_GAS_RECOUP_DAYS: 7,
  MIN_ORGANIC_RATIO: 50,
  MIN_TVL_USD: 10_000_000,
  MIN_TVL_USD_CROSS_CHAIN: 10_000_000,

  // Allocation strategy
  MAX_SINGLE_VAULT_PCT: 60,
  MIN_VAULTS: 2,
  MAX_VAULTS: 4,

  // LI.FI
  EARN_API_URL: "https://earn.li.fi",
  COMPOSER_URL: "https://li.quest",
  LIFI_API_KEY: process.env.LIFI_API_KEY,
  LIFI_ROUTER: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE" as const,

  // Live mode
  AGENT_PRIVATE_KEY: process.env.AGENT_PRIVATE_KEY,
  MAX_POSITION_USD: 200,
  MAX_SINGLE_TX_USD: 150,
  MIN_GAS_BALANCE_USD: 0.20,

  LIVE_CHAINS: [
    {
      chainId: 8453,
      name: "Base",
      network: "base",
      rpcUrl: "https://mainnet.base.org",
      usdcAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      usdcDecimals: 6,
      explorerUrl: "https://basescan.org",
      nativeSymbol: "ETH",
    },
    {
      chainId: 42161,
      name: "Arbitrum",
      network: "arbitrum",
      rpcUrl: "https://arb1.arbitrum.io/rpc",
      usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      usdcDecimals: 6,
      explorerUrl: "https://arbiscan.io",
      nativeSymbol: "ETH",
    },
  ] satisfies LiveChainConfig[],

  // Files — live mode uses separate data dir
  PORTFOLIO_FILE: new URL(
    `../${process.env.MODE === "live" ? "data-live" : "data"}/portfolio.json`,
    import.meta.url
  ).pathname,
  LOG_FILE: new URL(
    `../${process.env.MODE === "live" ? "data-live" : "data"}/activity-log.json`,
    import.meta.url
  ).pathname,
} as const;
