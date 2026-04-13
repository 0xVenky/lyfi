// Token info (embedded in pool responses)
export type TokenInfo = {
  address: string;
  symbol: string;
  decimals: number;
  chain: string;
  is_stable: boolean;
  asset_class: string | null;
  is_yield_bearing: boolean;
  base_token: string | null;
};

// Pool as returned by GET /api/v1/pools
export type PoolListItem = {
  id: string;
  chain: string;
  protocol: string;
  protocol_url: string | null;
  pool_type: string;
  yield_source: string;
  symbol: string;
  tvl_usd: number;
  yield: {
    apr_total: number;
    apr_base: number | null;
    apr_reward: number | null;
    apr_base_7d: number | null;
    il_7d: number | null;
    is_estimated: boolean;
  };
  exposure: {
    type: string;
    category: string | null;
    asset_class: string | null;
    has_yield_bearing_token: boolean;
    underlying_tokens: TokenInfo[];
  };
  risk: {
    contract_age_days: number | null;
    is_audited: boolean | null;
    is_verified: boolean | null;
    top_lp_concentration: number | null;
    underlying_depeg_risk: string | null;
  };
  incentives_summary: {
    count: number;
    nearest_expiry_days: number | null;
    total_daily_rewards_usd: number | null;
    sources: string[];
  };
  simulation: {
    daily_earnings_per_1k: number;
    monthly_earnings_per_1k: number;
    yearly_earnings_per_1k: number;
  };
  // LI.FI vault metadata for deposit flow
  vault_address: string;
  vault_chain_id: number;
  is_transactional: boolean;
  is_redeemable: boolean;
};

// Morpho vault allocation breakdown
export type VaultAllocation = {
  loan_asset: { address: string; symbol: string };
  collateral_asset: { address: string; symbol: string } | null;
  lltv: number | null;
  supply_usd: number;
  allocation_pct: number;
  supply_apy: number;
};

export type MorphoVaultData = {
  vault_address: string;
  vault_name: string;
  deposit_asset: { address: string; symbol: string; name: string };
  total_assets_usd: number;
  net_apy: number;
  net_apy_excluding_rewards: number;
  fee_pct: number;
  allocations: VaultAllocation[];
};

// Upshift vault detail
export type UpshiftVaultData = {
  vault_address: string;
  vault_name: string;
  vault_type: string;
  receipt_token_symbol: string;
  apy_total: number;
  apy_underlying: number;
  fee_bps: number;
  launch_date: string | null;
};

// Pool detail — GET /api/v1/pools/:id
export type PoolDetail = PoolListItem & {
  incentive_campaigns: CampaignDetail[];
  risk_detail: RiskDetail;
  morpho_vault: MorphoVaultData | null;
  upshift_vault: UpshiftVaultData | null;
};

export type CampaignDetail = {
  source: string;
  reward_token: { symbol: string; address: string };
  apr_contribution: number;
  daily_rewards_usd: number | null;
  start_date: string;
  end_date: string;
  days_remaining: number;
  status: string;
  is_kpi_based: boolean;
  kpi_details: object | null;
};

export type RiskDetail = {
  contract_age_days: number | null;
  contract_address: string | null;
  is_verified: boolean | null;
  is_audited: boolean | null;
  audit_firms: string[] | null;
  top_lp_concentration: number | null;
  pool_age_days: number | null;
  has_admin_key: boolean | null;
  underlying_depeg_risk: string | null;
  notes: string | null;
};

// Paginated response wrapper
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  last_refreshed: string | null;
};

// Filter options — GET /api/v1/filters
export type FiltersResponse = {
  chains: string[];
  protocols: { slug: string; name: string; pool_count: number }[];
  pool_types: string[];
  exposure_categories: string[];
  tokens: { symbol: string; pool_count: number }[];
};

// Stats — GET /api/v1/stats
export type StatsResponse = {
  total_pools: number;
  total_tvl_usd: number;
  chains_covered: number;
  protocols_covered: number;
  last_refreshed: string | null;
  refresh_interval_minutes: number;
  benchmarks?: Record<string, AssetClassBenchmark>;
};

// Asset-class benchmark — computed during cache refresh
export type AssetClassBenchmark = {
  asset_class: string;
  benchmark_apr: number;
  pool_count: number;
  total_tvl_usd: number;
  apr_range: { min: number; max: number };
  qualifying_pool_count: number;
  top_pools: {
    id: string;
    protocol: string;
    symbol: string;
    apr_total: number;
    tvl_usd: number;
  }[];
  computed_at: string;
};

// Benchmarks API response — GET /api/v1/benchmarks
export type BenchmarksResponse = {
  benchmarks: Record<string, AssetClassBenchmark>;
  last_refreshed: string | null;
};
