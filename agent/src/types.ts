export interface ChainConfig {
  chainId: number;
  name: string;
  network: string;
  usdcAddress: string;
  estimatedGasUsd: number;
}

export interface LiveChainConfig {
  chainId: number;
  name: string;
  network: string;
  rpcUrl: string;
  usdcAddress: string;
  usdcDecimals: number;
  explorerUrl: string;
  nativeSymbol: string;
}

export interface Position {
  vault_slug: string;
  vault_name: string;
  protocol: string;
  protocol_url: string;
  chain: string;
  chain_id: number;
  deposited_at: string;
  deposit_amount_usd: number;
  entry_apy: number;
  current_apy: number;
  simulated_earnings_usd: number;
  current_value_usd: number;
  last_updated_at: string;
}

export interface Portfolio {
  starting_capital_usd: number;
  started_at: string;
  positions: Position[];
  idle_usd: number;
  total_value_usd: number;
  total_earnings_usd: number;
  total_simulated_gas_usd: number;
  total_rebalances: number;
  total_checks: number;
}

export interface VaultAction {
  type: "deposit" | "withdraw" | "rebalance" | "hold";
  vault_name?: string;
  protocol?: string;
  chain?: string;
  amount_usd?: number;
  vault_apy_total?: number;
  vault_apy_base?: number;
  organic_ratio?: number;
  tvl_usd?: number;
  simulated_gas_usd?: number;
  // Rebalance-specific
  from_vault?: string;
  to_vault?: string;
  apy_before_base?: number;
  apy_after_base?: number;
  improvement_base?: number;
  gas_recoup_days?: number;
  // Live mode
  approval_tx?: string;
  deposit_tx?: string;
  withdraw_tx?: string;
  gas_cost_usd?: number;
  explorer_link?: string;
}

export interface PositionSummary {
  vault_name: string;
  chain: string;
  current_apy: number;
  value_usd: number;
  earnings_usd: number;
}

export interface AlternativeVault {
  vault: string;
  slug: string;
  chain: string;
  chain_id: number;
  protocol: string;
  protocol_url: string;
  apy_total: number;
  apy_base: number;
  organic: number;
  tvl_usd: number;
}

export interface LogEntry {
  timestamp: string;
  cycle: number;
  mode?: "simulation" | "live";
  type: "initial_allocation" | "check" | "rebalance" | "user_deposit" | "idle_allocation";
  wallet?: string;
  portfolio_value_usd: number;
  earnings_since_last_usd?: number;
  positions?: PositionSummary[];
  positions_before?: Array<{ vault: string; chain: string; apy: number; value_usd: number }>;
  positions_after?: Array<{ vault: string; chain: string; apy_base: number; value_usd: number }>;
  alternatives_checked?: AlternativeVault[];
  actions: VaultAction[];
  reasoning: string;
}

// LI.FI API types
export interface LifiVault {
  name: string;
  slug: string;
  address: string;
  chainId: number;
  network: string;
  tags: string[];
  protocol: { name: string; url: string };
  analytics: {
    apy: { base: number; total: number; reward: number | null };
    tvl: { usd: string };
  };
  isTransactional: boolean;
  underlyingTokens: Array<{ symbol: string; address: string; decimals: number }>;
}

export interface LifiVaultsResponse {
  data: LifiVault[];
  nextCursor: string | null;
  total: number;
}
