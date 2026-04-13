import { CONFIG } from "./config.js";
import { getWalletAddress, getUsdcBalance } from "./executor.js";
import type { Portfolio, Position } from "./types.js";

interface LifiPosition {
  chainId: number;
  protocolName: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  balanceUsd: string;
  balanceNative: string;
}

/**
 * Read real positions from LI.FI portfolio API + on-chain USDC balances.
 * Returns a Portfolio object matching the simulation shape.
 */
export async function readLivePortfolio(): Promise<Portfolio> {
  const address = getWalletAddress();

  // Fetch LI.FI positions
  const url = `${CONFIG.EARN_API_URL}/v1/earn/portfolio/${address}/positions`;
  let positions: LifiPosition[] = [];
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) positions = data;
    }
  } catch {
    console.log("  ⚠️  Failed to fetch LI.FI portfolio positions");
  }

  // Map to our Position shape
  const mapped: Position[] = positions.map((p) => {
    const chain = CONFIG.LIVE_CHAINS.find((c) => c.chainId === p.chainId);
    const balUsd = parseFloat(p.balanceUsd) || 0;
    return {
      vault_slug: `${p.chainId}-${p.asset.address}`,
      vault_name: p.asset.symbol,
      protocol: p.protocolName,
      protocol_url: "",
      chain: chain?.name.toLowerCase() ?? String(p.chainId),
      chain_id: p.chainId,
      deposited_at: "",
      deposit_amount_usd: balUsd,
      entry_apy: 0,
      current_apy: 0,
      simulated_earnings_usd: 0,
      current_value_usd: balUsd,
      last_updated_at: new Date().toISOString(),
    };
  });

  // Check idle USDC on each live chain
  let idleUsd = 0;
  for (const chain of CONFIG.LIVE_CHAINS) {
    try {
      const bal = await getUsdcBalance(chain.chainId);
      idleUsd += bal.formatted;
    } catch {
      // skip
    }
  }

  const totalPositionsUsd = mapped.reduce((s, p) => s + p.current_value_usd, 0);

  return {
    starting_capital_usd: 0, // unknown in live mode
    started_at: "",
    positions: mapped,
    idle_usd: idleUsd,
    total_value_usd: totalPositionsUsd + idleUsd,
    total_earnings_usd: 0,
    total_simulated_gas_usd: 0,
    total_rebalances: 0,
    total_checks: 0,
  };
}

/**
 * Get on-chain balance of a vault share token for the agent wallet.
 */
export async function getVaultShareBalance(
  chainId: number,
  vaultAddress: string,
  decimals: number = 18
): Promise<{ raw: bigint; formatted: number }> {
  // Reuse the generic token balance function from executor
  const { getTokenBalance } = await import("./executor.js");
  return getTokenBalance(chainId, vaultAddress, decimals);
}
