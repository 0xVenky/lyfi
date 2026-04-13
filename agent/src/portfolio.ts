import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CONFIG } from "./config.js";
import type { Portfolio, Position } from "./types.js";

export function loadPortfolio(): Portfolio | null {
  if (!existsSync(CONFIG.PORTFOLIO_FILE)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG.PORTFOLIO_FILE, "utf-8")) as Portfolio;
  } catch {
    return null;
  }
}

export function savePortfolio(portfolio: Portfolio): void {
  writeFileSync(CONFIG.PORTFOLIO_FILE, JSON.stringify(portfolio, null, 2));
}

export function createInitialPortfolio(): Portfolio {
  return {
    starting_capital_usd: CONFIG.STARTING_CAPITAL_USD,
    started_at: new Date().toISOString(),
    positions: [],
    idle_usd: CONFIG.STARTING_CAPITAL_USD,
    total_value_usd: CONFIG.STARTING_CAPITAL_USD,
    total_earnings_usd: 0,
    total_simulated_gas_usd: 0,
    total_rebalances: 0,
    total_checks: 0,
  };
}

/**
 * Update simulated earnings for all positions based on elapsed time and current APY.
 */
export function updateEarnings(portfolio: Portfolio): void {
  const now = new Date();

  for (const pos of portfolio.positions) {
    const lastUpdate = new Date(pos.last_updated_at);
    const hoursElapsed = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed <= 0) continue;

    // earnings = value * (apy / 100) / 8760 * hours
    const periodEarnings =
      pos.current_value_usd * (pos.current_apy / 100) / 8760 * hoursElapsed;

    pos.simulated_earnings_usd += periodEarnings;
    pos.current_value_usd = pos.deposit_amount_usd + pos.simulated_earnings_usd;
    pos.last_updated_at = now.toISOString();
  }

  recalcTotals(portfolio);
}

export function recalcTotals(portfolio: Portfolio): void {
  portfolio.total_value_usd =
    portfolio.positions.reduce((sum, p) => sum + p.current_value_usd, 0) +
    portfolio.idle_usd;
  portfolio.total_earnings_usd =
    portfolio.positions.reduce((sum, p) => sum + p.simulated_earnings_usd, 0);
}

export function addPosition(
  portfolio: Portfolio,
  opts: {
    vault_slug: string;
    vault_name: string;
    protocol: string;
    protocol_url: string;
    chain: string;
    chain_id: number;
    amount_usd: number;
    apy: number;
  }
): void {
  const now = new Date().toISOString();
  portfolio.positions.push({
    vault_slug: opts.vault_slug,
    vault_name: opts.vault_name,
    protocol: opts.protocol,
    protocol_url: opts.protocol_url,
    chain: opts.chain,
    chain_id: opts.chain_id,
    deposited_at: now,
    deposit_amount_usd: opts.amount_usd,
    entry_apy: opts.apy,
    current_apy: opts.apy,
    simulated_earnings_usd: 0,
    current_value_usd: opts.amount_usd,
    last_updated_at: now,
  });
  portfolio.idle_usd -= opts.amount_usd;
  recalcTotals(portfolio);
}

export function removePosition(portfolio: Portfolio, vaultSlug: string): Position | null {
  const idx = portfolio.positions.findIndex((p) => p.vault_slug === vaultSlug);
  if (idx === -1) return null;
  const [removed] = portfolio.positions.splice(idx, 1);
  portfolio.idle_usd += removed.current_value_usd;
  recalcTotals(portfolio);
  return removed;
}
