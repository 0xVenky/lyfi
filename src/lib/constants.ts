// Yield unit — LI.FI returns APY natively (Decision H1)
export const YIELD_UNIT = "APY" as const;

// LI.FI Earn supported chains (17 chains)
export const SUPPORTED_CHAINS = [
  { chainId: 1, name: "Ethereum", network: "ethereum", color: "#627EEA", explorer: "https://etherscan.io" },
  { chainId: 10, name: "Optimism", network: "optimism", color: "#FF0420", explorer: "https://optimistic.etherscan.io" },
  { chainId: 56, name: "BSC", network: "bsc", color: "#F0B90B", explorer: "https://bscscan.com" },
  { chainId: 100, name: "Gnosis", network: "gnosis", color: "#04795B", explorer: "https://gnosisscan.io" },
  { chainId: 130, name: "Unichain", network: "unichain", color: "#FF007A", explorer: "https://unichain.blockscout.com" },
  { chainId: 137, name: "Polygon", network: "polygon", color: "#8247E5", explorer: "https://polygonscan.com" },
  { chainId: 143, name: "Monad", network: "monad", color: "#836EF9", explorer: "https://explorer.monad.xyz" },
  { chainId: 146, name: "Sonic", network: "sonic", color: "#5B6DEF", explorer: "https://sonicscan.org" },
  { chainId: 5000, name: "Mantle", network: "mantle", color: "#000000", explorer: "https://mantlescan.xyz" },
  { chainId: 8453, name: "Base", network: "base", color: "#0052FF", explorer: "https://basescan.org" },
  { chainId: 42161, name: "Arbitrum", network: "arbitrum", color: "#12AAFF", explorer: "https://arbiscan.io" },
  { chainId: 42220, name: "Celo", network: "celo", color: "#FCFF52", explorer: "https://celoscan.io" },
  { chainId: 43114, name: "Avalanche", network: "avalanche", color: "#E84142", explorer: "https://snowtrace.io" },
  { chainId: 59144, name: "Linea", network: "linea", color: "#61DFFF", explorer: "https://lineascan.build" },
  { chainId: 80094, name: "Berachain", network: "berachain", color: "#CC7722", explorer: "https://berascan.com" },
  { chainId: 534352, name: "Scroll", network: "scroll", color: "#FFEEDA", explorer: "https://scrollscan.com" },
  { chainId: 747474, name: "Katana", network: "katana", color: "#FF4444", explorer: "https://katana.blockscout.com" },
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

// Native token zero address (used by LI.FI Composer for native gas tokens)
export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type CommonToken = {
  address: string;
  symbol: string;
  decimals: number;
};

// Native gas tokens per chain
export const NATIVE_TOKENS: Record<number, CommonToken> = {
  1:      { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH",  decimals: 18 },
  10:     { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH",  decimals: 18 },
  56:     { address: NATIVE_TOKEN_ADDRESS, symbol: "BNB",  decimals: 18 },
  100:    { address: NATIVE_TOKEN_ADDRESS, symbol: "xDAI", decimals: 18 },
  130:    { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH",  decimals: 18 },
  137:    { address: NATIVE_TOKEN_ADDRESS, symbol: "POL",  decimals: 18 },
  143:    { address: NATIVE_TOKEN_ADDRESS, symbol: "MON",  decimals: 18 },
  146:    { address: NATIVE_TOKEN_ADDRESS, symbol: "S",    decimals: 18 },
  5000:   { address: NATIVE_TOKEN_ADDRESS, symbol: "MNT",  decimals: 18 },
  8453:   { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH",  decimals: 18 },
  42161:  { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH",  decimals: 18 },
  42220:  { address: NATIVE_TOKEN_ADDRESS, symbol: "CELO", decimals: 18 },
  43114:  { address: NATIVE_TOKEN_ADDRESS, symbol: "AVAX", decimals: 18 },
  59144:  { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH",  decimals: 18 },
  80094:  { address: NATIVE_TOKEN_ADDRESS, symbol: "BERA", decimals: 18 },
  534352: { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH",  decimals: 18 },
  747474: { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH",  decimals: 18 },
};

// Well-known ERC20 tokens per chain (for zap-in token selection)
export const ERC20_TOKENS_BY_CHAIN: Record<number, CommonToken[]> = {
  1: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI",  decimals: 18 },
  ],
  10: [
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  ],
  56: [
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 },
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18 },
  ],
  137: [
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6 },
    { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18 },
  ],
  8453: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  ],
  42161: [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
  ],
  43114: [
    { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC", decimals: 6 },
    { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", symbol: "USDT", decimals: 6 },
  ],
  59144: [
    { address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", symbol: "USDC", decimals: 6 },
  ],
  534352: [
    { address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4", symbol: "USDC", decimals: 6 },
  ],
};

// ---------------------------------------------------------------------------
// Aave V3 — Pool contract addresses & ABI fragments
// ---------------------------------------------------------------------------

export const AAVE_V3_POOL: Record<number, string> = {
  1:     "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Ethereum
  8453:  "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Base
  42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Arbitrum
};

export const AAVE_V3_CHAINS = Object.keys(AAVE_V3_POOL).map(Number);

// Minimal ABI — only the functions we need
export const AAVE_POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Aave V3 UI Pool Data Provider — for per-reserve user data
export const AAVE_V3_UI_POOL_DATA_PROVIDER: Record<number, string> = {
  1:     "0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d",
  8453:  "0x174446a6741300cD2E7C1b1A636Fee99c8F83502",
  42161: "0x145dE30c929a065582da84Cf96F88460dB9745A7",
};

export const AAVE_UI_POOL_DATA_PROVIDER_ABI = [
  {
    name: "getUserReservesData",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "provider", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "underlyingAsset", type: "address" },
          { name: "scaledATokenBalance", type: "uint256" },
          { name: "usageAsCollateralEnabledOnUser", type: "bool" },
          { name: "stableBorrowRate", type: "uint256" },
          { name: "scaledVariableBorrowBalance", type: "uint256" },  // non-zero = has debt
          { name: "principalStableDebt", type: "uint256" },
          { name: "stableBorrowLastUpdateTimestamp", type: "uint256" },
        ],
      },
      { name: "", type: "uint256" },
    ],
  },
] as const;

// Aave V3 Pool Address Provider (needed as input to UI data provider)
export const AAVE_V3_POOL_ADDRESS_PROVIDER: Record<number, string> = {
  1:     "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
  8453:  "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D",
  42161: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
};
