import { CONFIG } from "./config.js";
import { fetchUsdcVaults, fetchVaultBySlug, vaultMetrics } from "./lifi-client.js";
import {
  loadPortfolio,
  savePortfolio,
  createInitialPortfolio,
  updateEarnings,
  addPosition,
  removePosition,
  recalcTotals,
} from "./portfolio.js";
import { appendLog, getLastCycle } from "./logger.js";
import type {
  Portfolio,
  LifiVault,
  AlternativeVault,
  VaultAction,
  LogEntry,
  PositionSummary,
} from "./types.js";

function chainName(chainId: number): string {
  return CONFIG.CHAINS.find((c) => c.chainId === chainId)?.name ?? String(chainId);
}

function chainGas(chainId: number): number {
  return CONFIG.CHAINS.find((c) => c.chainId === chainId)?.estimatedGasUsd ?? 0.05;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function toAlternative(v: LifiVault): AlternativeVault {
  const m = vaultMetrics(v);
  return {
    vault: v.name,
    slug: v.slug,
    chain: chainName(v.chainId),
    chain_id: v.chainId,
    protocol: v.protocol.name,
    protocol_url: v.protocol.url,
    apy_total: round(m.apyTotal),
    apy_base: round(m.apyBase),
    organic: m.organicRatio,
    tvl_usd: Math.round(m.tvl),
  };
}

function round(n: number, d = 2): number {
  return Math.round(n * 10 ** d) / 10 ** d;
}

/**
 * Run one strategy cycle. Returns the log entry.
 */
export async function runCycle(): Promise<LogEntry> {
  let portfolio = loadPortfolio();
  const cycle = getLastCycle() + 1;
  const now = new Date().toISOString();

  // Fresh start — create portfolio and do initial allocation
  if (!portfolio) {
    portfolio = createInitialPortfolio();
    return await initialAllocation(portfolio, cycle, now);
  }

  // Update earnings based on elapsed time
  const earningsBefore = portfolio.total_earnings_usd;
  updateEarnings(portfolio);
  const earningsSinceLast = portfolio.total_earnings_usd - earningsBefore;

  // Scan alternatives on all chains
  const allAlternatives: AlternativeVault[] = [];
  for (const chain of CONFIG.CHAINS) {
    try {
      const vaults = await fetchUsdcVaults(chain.chainId, chain.usdcAddress);
      for (const v of vaults) {
        allAlternatives.push(toAlternative(v));
      }
      console.log(`  🔍 Scanned ${chainName(chain.chainId)}: ${vaults.length} USDC vaults`);
    } catch (err) {
      console.log(`  ⚠️  Failed to scan ${chainName(chain.chainId)}: ${(err as Error).message}`);
    }
  }

  // Update current APYs from live data
  for (const pos of portfolio.positions) {
    const alt = allAlternatives.find((a) => a.slug === pos.vault_slug);
    if (alt) {
      pos.current_apy = alt.apy_total;
    } else {
      // Try direct fetch
      try {
        const vault = await fetchVaultBySlug(pos.vault_slug);
        if (vault) {
          pos.current_apy = vault.analytics.apy.total ?? pos.current_apy;
        }
      } catch {
        // Keep existing APY
      }
    }
  }

  // Evaluate rebalances
  const actions: VaultAction[] = [];
  const positionsBefore: Array<{ vault: string; chain: string; apy: number; value_usd: number }> = [];
  const positionsAfter: Array<{ vault: string; chain: string; apy_base: number; value_usd: number }> = [];
  const reasonParts: string[] = [];

  for (const pos of [...portfolio.positions]) {
    const posChainId = pos.chain_id;
    const posApyBase = allAlternatives.find((a) => a.slug === pos.vault_slug)?.apy_base ?? pos.current_apy;

    // Find best alternative on same chain
    const sameChainAlts = allAlternatives
      .filter((a) => a.chain_id === posChainId && a.slug !== pos.vault_slug)
      .filter((a) => a.organic >= CONFIG.MIN_ORGANIC_RATIO && a.tvl_usd >= CONFIG.MIN_TVL_USD)
      .sort((a, b) => b.apy_base - a.apy_base);

    // Find best alternative on other chains
    const crossChainAlts = allAlternatives
      .filter((a) => a.chain_id !== posChainId)
      .filter((a) => a.organic >= CONFIG.MIN_ORGANIC_RATIO && a.tvl_usd >= CONFIG.MIN_TVL_USD_CROSS_CHAIN)
      .sort((a, b) => b.apy_base - a.apy_base);

    let bestAction: VaultAction | null = null;
    let bestReason = "";

    // Check same-chain rebalance
    if (sameChainAlts.length > 0) {
      const best = sameChainAlts[0];
      const improvement = best.apy_base - posApyBase;
      if (improvement >= CONFIG.SAME_CHAIN_MIN_APY_IMPROVEMENT) {
        const gas = chainGas(posChainId);
        const dailyGain = pos.current_value_usd * (improvement / 100) / 365;
        const recoupDays = dailyGain > 0 ? gas / dailyGain : Infinity;

        if (recoupDays <= CONFIG.MAX_GAS_RECOUP_DAYS) {
          bestAction = {
            type: "rebalance",
            from_vault: pos.vault_name,
            to_vault: best.vault,
            chain: chainName(posChainId),
            amount_usd: round(pos.current_value_usd),
            apy_before_base: round(posApyBase),
            apy_after_base: round(best.apy_base),
            improvement_base: round(improvement),
            simulated_gas_usd: gas,
            gas_recoup_days: round(recoupDays, 3),
            vault_apy_total: best.apy_total,
            vault_apy_base: best.apy_base,
            organic_ratio: best.organic,
            tvl_usd: best.tvl_usd,
            protocol: best.protocol,
          };
          bestReason = `${pos.vault_name} base APY at ${fmt(posApyBase)}%. ${best.vault} (${best.protocol}) offers ${fmt(best.apy_base)}% base (+${fmt(improvement)}%, ${best.organic}% organic, $${fmt(best.tvl_usd / 1e6)}M TVL). Same-chain on ${chainName(posChainId)}: gas $${fmt(gas)}, recoup in ${recoupDays < 1 ? "<1 hour" : fmt(recoupDays) + " days"}.`;
        }
      }
    }

    // Check cross-chain rebalance (only if no same-chain or cross-chain is much better)
    if (crossChainAlts.length > 0 && !bestAction) {
      const best = crossChainAlts[0];
      const improvement = best.apy_base - posApyBase;
      if (improvement >= CONFIG.CROSS_CHAIN_MIN_APY_IMPROVEMENT) {
        const gas = CONFIG.CROSS_CHAIN_GAS_USD;
        const dailyGain = pos.current_value_usd * (improvement / 100) / 365;
        const recoupDays = dailyGain > 0 ? gas / dailyGain : Infinity;

        if (recoupDays <= CONFIG.MAX_GAS_RECOUP_DAYS) {
          bestAction = {
            type: "rebalance",
            from_vault: pos.vault_name,
            to_vault: best.vault,
            chain: `${chainName(posChainId)} → ${best.chain}`,
            amount_usd: round(pos.current_value_usd),
            apy_before_base: round(posApyBase),
            apy_after_base: round(best.apy_base),
            improvement_base: round(improvement),
            simulated_gas_usd: gas,
            gas_recoup_days: round(recoupDays, 3),
            vault_apy_total: best.apy_total,
            vault_apy_base: best.apy_base,
            organic_ratio: best.organic,
            tvl_usd: best.tvl_usd,
            protocol: best.protocol,
          };
          bestReason = `Cross-chain opportunity: ${best.vault} on ${best.chain} at ${fmt(best.apy_base)}% base (+${fmt(improvement)}% vs ${pos.vault_name}). Bridge cost ~$${fmt(gas)}, recoup in ${fmt(recoupDays)} days.`;
        }
      }
    }

    if (bestAction) {
      positionsBefore.push({
        vault: pos.vault_name,
        chain: pos.chain,
        apy: round(posApyBase),
        value_usd: round(pos.current_value_usd),
      });

      // Execute simulated rebalance
      const value = pos.current_value_usd;
      removePosition(portfolio, pos.vault_slug);

      // Find the target vault details
      const target = allAlternatives.find((a) => a.vault === bestAction!.to_vault && (bestAction!.chain?.includes(a.chain) ?? true));
      if (target) {
        addPosition(portfolio, {
          vault_slug: target.slug,
          vault_name: target.vault,
          protocol: target.protocol,
          protocol_url: target.protocol_url,
          chain: target.chain.toLowerCase(),
          chain_id: target.chain_id,
          amount_usd: value - (bestAction.simulated_gas_usd ?? 0),
          apy: target.apy_total,
        });
        portfolio.total_simulated_gas_usd += bestAction.simulated_gas_usd ?? 0;
        portfolio.total_rebalances++;

        positionsAfter.push({
          vault: target.vault,
          chain: target.chain,
          apy_base: target.apy_base,
          value_usd: round(value - (bestAction.simulated_gas_usd ?? 0)),
        });
      }

      actions.push(bestAction);
      reasonParts.push(bestReason);
    } else {
      // Hold
      const holdReason = buildHoldReason(pos.vault_name, posApyBase, pos.chain, sameChainAlts, crossChainAlts);
      reasonParts.push(holdReason);
    }
  }

  // Allocate idle funds if above threshold ($100)
  const IDLE_THRESHOLD = 100;
  if (portfolio.idle_usd >= IDLE_THRESHOLD && allAlternatives.length > 0) {
    const idleActions = allocateIdleFunds(portfolio, allAlternatives);
    actions.push(...idleActions.actions);
    reasonParts.push(idleActions.reasoning);
  }

  portfolio.total_checks++;
  recalcTotals(portfolio);
  savePortfolio(portfolio);

  const hasRebalance = actions.some((a) => a.type === "rebalance");
  const hasDeposit = actions.some((a) => a.type === "deposit");
  const entryType = hasRebalance ? "rebalance" as const : hasDeposit ? "idle_allocation" as const : "check" as const;

  const positions: PositionSummary[] = portfolio.positions.map((p) => ({
    vault_name: p.vault_name,
    chain: p.chain,
    current_apy: round(p.current_apy),
    value_usd: round(p.current_value_usd),
    earnings_usd: round(p.simulated_earnings_usd),
  }));

  // Top 3 alternatives per chain for the log
  const topAlternatives = allAlternatives
    .filter((a) => !portfolio!.positions.some((p) => p.vault_slug === a.slug))
    .sort((a, b) => b.apy_base - a.apy_base)
    .slice(0, 6);

  const entry: LogEntry = {
    timestamp: now,
    cycle,
    type: entryType,
    portfolio_value_usd: round(portfolio.total_value_usd),
    earnings_since_last_usd: round(earningsSinceLast),
    positions,
    alternatives_checked: topAlternatives,
    actions: actions.length > 0 ? actions : [{ type: "hold" }],
    reasoning: reasonParts.join(" "),
  };

  if (hasRebalance) {
    entry.positions_before = positionsBefore;
    entry.positions_after = positionsAfter;
  }

  appendLog(entry);
  printCycleSummary(entry, portfolio);

  return entry;
}

async function initialAllocation(
  portfolio: Portfolio,
  cycle: number,
  now: string
): Promise<LogEntry> {
  console.log("  📋 Fresh portfolio — running initial allocation...\n");

  // Fetch vaults from all chains
  const chainVaults: Map<number, LifiVault[]> = new Map();

  for (const chain of CONFIG.CHAINS) {
    try {
      const vaults = await fetchUsdcVaults(chain.chainId, chain.usdcAddress);
      chainVaults.set(chain.chainId, vaults);
      console.log(`  🔍 ${chain.name}: found ${vaults.length} USDC vaults (TVL > $${CONFIG.MIN_TVL_USD / 1e6}M)`);
    } catch (err) {
      console.log(`  ⚠️  Failed to fetch ${chain.name}: ${(err as Error).message}`);
      chainVaults.set(chain.chainId, []);
    }
  }

  // Rank all vaults by base APY (organic yield), weighted by TVL for safety
  const ranked: Array<{ vault: LifiVault; chain: typeof CONFIG.CHAINS[number] }> = [];
  for (const chain of CONFIG.CHAINS) {
    const vaults = chainVaults.get(chain.chainId) ?? [];
    for (const v of vaults) {
      const m = vaultMetrics(v);
      if (m.organicRatio >= CONFIG.MIN_ORGANIC_RATIO) {
        ranked.push({ vault: v, chain });
      }
    }
  }

  ranked.sort((a, b) => {
    const mA = vaultMetrics(a.vault);
    const mB = vaultMetrics(b.vault);
    // Primary: base APY. Tiebreaker: TVL
    return mB.apyBase - mA.apyBase || mB.tvl - mA.tvl;
  });

  if (ranked.length === 0) {
    console.log("  ❌ No suitable USDC vaults found. Keeping idle.");
    savePortfolio(portfolio);
    const entry: LogEntry = {
      timestamp: now,
      cycle,
      type: "initial_allocation",
      portfolio_value_usd: portfolio.total_value_usd,
      actions: [{ type: "hold" }],
      reasoning: "No suitable USDC vaults found meeting criteria (TVL > $${CONFIG.MIN_TVL_USD / 1e6}M, organic ratio > 50%). Keeping funds idle.",
    };
    appendLog(entry);
    return entry;
  }

  // Allocate across top vaults
  // Strategy: pick best from each chain first, then fill
  const picks: Array<{ vault: LifiVault; chain: typeof CONFIG.CHAINS[number]; pct: number }> = [];

  // Best per chain
  const seenChains = new Set<number>();
  for (const r of ranked) {
    if (!seenChains.has(r.chain.chainId) && picks.length < CONFIG.MAX_VAULTS) {
      picks.push({ ...r, pct: 0 });
      seenChains.add(r.chain.chainId);
    }
    if (seenChains.size >= CONFIG.CHAINS.length) break;
  }

  // If we only have 1 pick, try to add a second from the same chain
  if (picks.length < CONFIG.MIN_VAULTS && ranked.length > 1) {
    const second = ranked.find((r) => r.vault.slug !== picks[0].vault.slug);
    if (second) picks.push({ ...second, pct: 0 });
  }

  // Assign allocation percentages
  if (picks.length === 1) {
    picks[0].pct = 100;
  } else if (picks.length === 2) {
    // Higher APY gets more, but capped at MAX_SINGLE_VAULT_PCT
    picks[0].pct = CONFIG.MAX_SINGLE_VAULT_PCT;
    picks[1].pct = 100 - CONFIG.MAX_SINGLE_VAULT_PCT;
  } else if (picks.length === 3) {
    picks[0].pct = 50;
    picks[1].pct = 30;
    picks[2].pct = 20;
  } else {
    picks[0].pct = 40;
    picks[1].pct = 30;
    picks[2].pct = 20;
    picks[3].pct = 10;
  }

  const actions: VaultAction[] = [];
  const reasonParts: string[] = [
    `Initial allocation of $${fmt(CONFIG.STARTING_CAPITAL_USD)} USDC. Split across ${picks.length} vault${picks.length > 1 ? "s" : ""} on ${seenChains.size} chain${seenChains.size > 1 ? "s" : ""} for diversification.`,
  ];

  for (const pick of picks) {
    const m = vaultMetrics(pick.vault);
    const amount = Math.round(CONFIG.STARTING_CAPITAL_USD * pick.pct / 100);
    const gas = pick.chain.estimatedGasUsd;

    addPosition(portfolio, {
      vault_slug: pick.vault.slug,
      vault_name: pick.vault.name,
      protocol: pick.vault.protocol.name,
      protocol_url: pick.vault.protocol.url,
      chain: pick.chain.name.toLowerCase(),
      chain_id: pick.chain.chainId,
      amount_usd: amount - gas,
      apy: m.apyTotal,
    });
    portfolio.total_simulated_gas_usd += gas;

    actions.push({
      type: "deposit",
      vault_name: pick.vault.name,
      protocol: pick.vault.protocol.name,
      chain: pick.chain.name,
      amount_usd: amount,
      vault_apy_total: round(m.apyTotal),
      vault_apy_base: round(m.apyBase),
      organic_ratio: m.organicRatio,
      tvl_usd: Math.round(m.tvl),
      simulated_gas_usd: gas,
    });

    reasonParts.push(
      `${pick.chain.name}: ${pick.vault.name} (${pick.vault.protocol.name}) — ${fmt(m.apyBase)}% base APY, ${m.organicRatio}% organic, $${fmt(m.tvl / 1e6)}M TVL, ${pick.pct}% allocation.`
    );
  }

  portfolio.total_checks++;
  recalcTotals(portfolio);
  savePortfolio(portfolio);

  const entry: LogEntry = {
    timestamp: now,
    cycle,
    type: "initial_allocation",
    portfolio_value_usd: round(portfolio.total_value_usd),
    actions,
    reasoning: reasonParts.join(" "),
  };

  appendLog(entry);
  printInitialSummary(entry, portfolio);

  return entry;
}

function buildHoldReason(
  vaultName: string,
  currentApyBase: number,
  chain: string,
  sameChainAlts: AlternativeVault[],
  crossChainAlts: AlternativeVault[]
): string {
  const parts: string[] = [`${chain}: ${vaultName} at ${fmt(currentApyBase)}% base.`];

  if (sameChainAlts.length > 0) {
    const best = sameChainAlts[0];
    const diff = best.apy_base - currentApyBase;
    if (diff > 0) {
      parts.push(
        `Best alternative: ${best.vault} at ${fmt(best.apy_base)}% (+${fmt(diff)}%) — below threshold. Holding.`
      );
    } else {
      parts.push("Current position is the best on this chain. Holding.");
    }
  } else {
    parts.push("No qualifying alternatives on this chain.");
  }

  return parts.join(" ");
}

function allocateIdleFunds(
  portfolio: Portfolio,
  allAlternatives: AlternativeVault[]
): { actions: VaultAction[]; reasoning: string } {
  const idle = portfolio.idle_usd;
  const actions: VaultAction[] = [];

  // Find best vault across all chains (prefer existing position chain for lower gas)
  const existingChains = new Set(portfolio.positions.map((p) => p.chain_id));
  const candidates = allAlternatives
    .filter((a) => a.organic >= CONFIG.MIN_ORGANIC_RATIO && a.tvl_usd >= CONFIG.MIN_TVL_USD)
    .sort((a, b) => {
      // Prefer existing chains (lower gas), then by base APY
      const aExisting = existingChains.has(a.chain_id) ? 1 : 0;
      const bExisting = existingChains.has(b.chain_id) ? 1 : 0;
      if (aExisting !== bExisting) return bExisting - aExisting;
      return b.apy_base - a.apy_base;
    });

  if (candidates.length === 0) return { actions: [], reasoning: "" };

  const best = candidates[0];
  const gas = existingChains.has(best.chain_id) ? chainGas(best.chain_id) : CONFIG.CROSS_CHAIN_GAS_USD;
  const depositAmount = idle - gas;

  if (depositAmount <= 0) return { actions: [], reasoning: "" };

  // Check if we already have a position in this vault — add to it
  const existingPos = portfolio.positions.find((p) => p.vault_slug === best.slug);
  if (existingPos) {
    existingPos.deposit_amount_usd += depositAmount;
    existingPos.current_value_usd += depositAmount;
    portfolio.idle_usd = 0;
    portfolio.total_simulated_gas_usd += gas;
  } else {
    addPosition(portfolio, {
      vault_slug: best.slug,
      vault_name: best.vault,
      protocol: best.protocol,
      protocol_url: best.protocol_url,
      chain: best.chain.toLowerCase(),
      chain_id: best.chain_id,
      amount_usd: depositAmount,
      apy: best.apy_total,
    });
    portfolio.total_simulated_gas_usd += gas;
  }

  actions.push({
    type: "deposit",
    vault_name: best.vault,
    protocol: best.protocol,
    chain: best.chain,
    amount_usd: round(depositAmount),
    vault_apy_total: best.apy_total,
    vault_apy_base: best.apy_base,
    organic_ratio: best.organic,
    tvl_usd: best.tvl_usd,
    simulated_gas_usd: gas,
  });

  const reasoning = `Idle funds: $${fmt(idle)} allocated to ${best.vault} (${best.protocol}, ${best.chain}) at ${fmt(best.apy_base)}% base APY, ${best.organic}% organic. Gas: $${fmt(gas)}.`;
  return { actions, reasoning };
}

/**
 * Simulate a user deposit. Adds funds as idle — next cycle will allocate them.
 */
export function simulateDeposit(amountUsd: number): { success: boolean; portfolio: Portfolio | null; logEntry: LogEntry | null } {
  const portfolio = loadPortfolio();
  if (!portfolio) return { success: false, portfolio: null, logEntry: null };

  portfolio.idle_usd += amountUsd;
  recalcTotals(portfolio);
  savePortfolio(portfolio);

  const cycle = getLastCycle() + 1;
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    cycle,
    type: "user_deposit",
    portfolio_value_usd: round(portfolio.total_value_usd),
    actions: [{ type: "deposit", amount_usd: amountUsd }],
    reasoning: `User deposited $${fmt(amountUsd)} USDC. Funds are idle — will be allocated to the best vault on the next agent cycle.`,
  };

  appendLog(entry);
  console.log(`\n  💵 User deposit: $${fmt(amountUsd)} USDC added as idle funds`);
  console.log(`  💬 Will be allocated on next cycle\n`);

  return { success: true, portfolio, logEntry: entry };
}

function printInitialSummary(entry: LogEntry, portfolio: Portfolio): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  🚀 INITIAL ALLOCATION — Cycle ${entry.cycle}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  💰 Portfolio: $${fmt(portfolio.total_value_usd)}`);
  console.log(`  📍 Positions:`);
  for (const a of entry.actions) {
    if (a.type === "deposit") {
      console.log(`     • ${a.vault_name} (${a.protocol}, ${a.chain}) — $${fmt(a.amount_usd!)} @ ${fmt(a.vault_apy_total!)}% APY (${a.organic_ratio}% organic)`);
    }
  }
  console.log(`  ⛽ Simulated gas: $${fmt(portfolio.total_simulated_gas_usd)}`);
  console.log(`\n  💬 ${entry.reasoning}\n`);
}

function printCycleSummary(entry: LogEntry, portfolio: Portfolio): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  📊 Cycle ${entry.cycle} @ ${entry.timestamp}`);
  console.log(`${"═".repeat(60)}`);
  const pctReturn = portfolio.starting_capital_usd > 0
    ? (portfolio.total_earnings_usd / portfolio.starting_capital_usd) * 100
    : 0;
  console.log(`  💰 Portfolio: $${fmt(portfolio.total_value_usd)} (+$${fmt(portfolio.total_earnings_usd)} earned, +${fmt(pctReturn, 4)}%)`);
  console.log(`  📈 This cycle: +$${fmt(entry.earnings_since_last_usd ?? 0)}`);
  console.log(`  📍 Positions:`);
  for (const p of entry.positions ?? []) {
    console.log(`     • ${p.vault_name} (${p.chain}) — $${fmt(p.value_usd)} @ ${fmt(p.current_apy)}% APY (+$${fmt(p.earnings_usd)} earned)`);
  }

  for (const a of entry.actions) {
    if (a.type === "rebalance") {
      console.log(`\n  ⚡ REBALANCE: ${a.from_vault} → ${a.to_vault} on ${a.chain}`);
      console.log(`     APY improvement: +${fmt(a.improvement_base!)}% base (${fmt(a.apy_before_base!)}% → ${fmt(a.apy_after_base!)}%)`);
      console.log(`     Gas estimate: $${fmt(a.simulated_gas_usd!)} | Recoup: ${a.gas_recoup_days! < 1 ? "<1 day" : fmt(a.gas_recoup_days!) + " days"}`);
    } else if (a.type === "deposit") {
      console.log(`\n  💵 ALLOCATED IDLE: $${fmt(a.amount_usd!)} → ${a.vault_name} (${a.protocol}, ${a.chain})`);
      console.log(`     APY: ${fmt(a.vault_apy_base!)}% base (${a.organic_ratio}% organic)`);
    } else if (a.type === "hold") {
      console.log(`\n  ✅ HOLD — all positions optimal`);
    }
  }

  console.log(`\n  💬 ${entry.reasoning}`);
  console.log(`  📝 Logged entry #${entry.cycle}\n`);
}
