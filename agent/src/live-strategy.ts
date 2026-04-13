import { CONFIG } from "./config.js";
import { fetchUsdcVaults, vaultMetrics } from "./lifi-client.js";
import { readLivePortfolio } from "./live-portfolio.js";
import {
  getWalletAddress,
  getUsdcBalance,
  getComposerQuote,
  approveTokenIfNeeded,
  executeTransaction,
} from "./executor.js";
import { appendLog, getLastCycle } from "./logger.js";
import type {
  AlternativeVault,
  VaultAction,
  LogEntry,
  LifiVault,
} from "./types.js";

function fmt(n: number, d = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function round(n: number, d = 2): number {
  return Math.round(n * 10 ** d) / 10 ** d;
}

function toAlternative(v: LifiVault): AlternativeVault {
  const m = vaultMetrics(v);
  const chain = CONFIG.LIVE_CHAINS.find((c) => c.chainId === v.chainId);
  return {
    vault: v.name,
    slug: v.slug,
    chain: chain?.name ?? String(v.chainId),
    chain_id: v.chainId,
    protocol: v.protocol.name,
    protocol_url: v.protocol.url,
    apy_total: round(m.apyTotal),
    apy_base: round(m.apyBase),
    organic: m.organicRatio,
    tvl_usd: Math.round(m.tvl),
  };
}

export async function runLiveCycle(): Promise<LogEntry> {
  const cycle = getLastCycle() + 1;
  const now = new Date().toISOString();
  const walletAddress = getWalletAddress();

  // Read real portfolio state
  const portfolio = await readLivePortfolio();
  console.log(`  💰 Portfolio: $${fmt(portfolio.total_value_usd)} (${portfolio.positions.length} positions, $${fmt(portfolio.idle_usd)} idle)`);

  // Safety: refuse if total > MAX_POSITION_USD
  if (portfolio.total_value_usd > CONFIG.MAX_POSITION_USD) {
    console.log(`  🛑 Total value $${fmt(portfolio.total_value_usd)} exceeds safety cap $${CONFIG.MAX_POSITION_USD}. Skipping.`);
    const entry: LogEntry = {
      timestamp: now, cycle, mode: "live", type: "check", wallet: walletAddress,
      portfolio_value_usd: round(portfolio.total_value_usd),
      actions: [{ type: "hold" }],
      reasoning: `Safety cap exceeded ($${fmt(portfolio.total_value_usd)} > $${CONFIG.MAX_POSITION_USD}). No action taken.`,
    };
    appendLog(entry);
    return entry;
  }

  // Scan vaults on live chains
  const allAlternatives: AlternativeVault[] = [];
  for (const chain of CONFIG.LIVE_CHAINS) {
    try {
      const vaults = await fetchUsdcVaults(chain.chainId, chain.usdcAddress);
      for (const v of vaults) allAlternatives.push(toAlternative(v));
      console.log(`  🔍 ${chain.name}: ${vaults.length} USDC vaults`);
    } catch (err) {
      console.log(`  ⚠️  ${chain.name}: ${(err as Error).message}`);
    }
  }

  const actions: VaultAction[] = [];
  const reasonParts: string[] = [];

  // If idle USDC exists, deposit into best vault
  if (portfolio.idle_usd > 1) {
    const result = await executeDeposit(walletAddress, allAlternatives);
    if (result) {
      actions.push(result.action);
      reasonParts.push(result.reasoning);
    }
  }

  // TODO: Evaluate rebalances for existing positions (withdraw + deposit)
  // For v1 of live mode, focus on initial deposit flow.
  // Rebalance requires: read vault shares → quote withdraw → execute → quote deposit → execute
  // This is complex and risky for a hackathon demo — better to show clean initial deposit.

  if (portfolio.positions.length > 0 && actions.length === 0) {
    reasonParts.push(`${portfolio.positions.length} active position(s). Monitoring — rebalance evaluation in next cycle.`);
    actions.push({ type: "hold" });
  }

  if (actions.length === 0) {
    actions.push({ type: "hold" });
    reasonParts.push("No idle funds and no positions. Fund the wallet with USDC.");
  }

  const entry: LogEntry = {
    timestamp: now,
    cycle,
    mode: "live",
    type: actions.some((a) => a.type === "deposit") ? "initial_allocation" : "check",
    wallet: walletAddress,
    portfolio_value_usd: round(portfolio.total_value_usd),
    actions,
    reasoning: reasonParts.join(" "),
  };

  appendLog(entry);
  printLiveSummary(entry);
  return entry;
}

async function executeDeposit(
  walletAddress: string,
  alternatives: AlternativeVault[]
): Promise<{ action: VaultAction; reasoning: string } | null> {
  // Find which chain has idle USDC
  for (const chain of CONFIG.LIVE_CHAINS) {
    let balance: { raw: bigint; formatted: number };
    try {
      balance = await getUsdcBalance(chain.chainId);
    } catch {
      continue;
    }

    if (balance.formatted < 1) continue;

    // Safety: cap single tx
    if (balance.formatted > CONFIG.MAX_SINGLE_TX_USD) {
      console.log(`  🛑 USDC balance $${fmt(balance.formatted)} exceeds tx cap $${CONFIG.MAX_SINGLE_TX_USD} on ${chain.name}. Limiting.`);
      // We'll still deposit but only up to MAX_SINGLE_TX_USD worth
    }

    // Find best vault on this chain
    const candidates = alternatives
      .filter((a) => a.chain_id === chain.chainId)
      .filter((a) => a.organic >= CONFIG.MIN_ORGANIC_RATIO && a.tvl_usd >= CONFIG.MIN_TVL_USD)
      .sort((a, b) => b.apy_base - a.apy_base);

    if (candidates.length === 0) {
      console.log(`  No qualifying vaults on ${chain.name}`);
      continue;
    }

    const best = candidates[0];
    console.log(`  🎯 Best vault: ${best.vault} (${best.protocol}) on ${chain.name} — ${fmt(best.apy_base)}% base APY`);

    // The vault slug is "chainId-address", extract the address
    const vaultAddress = best.slug.split("-").slice(1).join("-");

    try {
      // Get deposit quote from Composer
      console.log(`  📝 Getting deposit quote...`);
      const quote = await getComposerQuote({
        fromChain: chain.chainId,
        toChain: chain.chainId,
        fromToken: chain.usdcAddress,
        toToken: vaultAddress,
        fromAmount: balance.raw.toString(),
        fromAddress: walletAddress,
      });

      // Approve USDC for LI.FI Router if needed
      let approvalTx: string | null = null;
      if (quote.estimate.approvalAddress) {
        approvalTx = await approveTokenIfNeeded(
          chain.chainId,
          chain.usdcAddress,
          quote.estimate.approvalAddress,
          balance.raw
        );
      }

      // Execute deposit
      console.log(`  ⚡ Executing deposit: $${fmt(balance.formatted)} → ${best.vault}...`);
      const result = await executeTransaction(chain.chainId, quote.transactionRequest);
      console.log(`     TX: ${result.hash} ✓ (gas: ${result.gasCostEth.toFixed(6)} ETH)`);
      console.log(`     Explorer: ${result.explorerLink}`);

      const action: VaultAction = {
        type: "deposit",
        vault_name: best.vault,
        protocol: best.protocol,
        chain: chain.name,
        amount_usd: round(balance.formatted),
        vault_apy_total: best.apy_total,
        vault_apy_base: best.apy_base,
        organic_ratio: best.organic,
        tvl_usd: best.tvl_usd,
        approval_tx: approvalTx ?? undefined,
        deposit_tx: result.hash,
        gas_cost_usd: round(result.gasCostEth * 2000, 4), // rough ETH price
        explorer_link: result.explorerLink,
      };

      const reasoning = `Deposited $${fmt(balance.formatted)} USDC into ${best.vault} (${best.protocol}) on ${chain.name}. ${fmt(best.apy_base)}% base APY, ${best.organic}% organic, $${fmt(best.tvl_usd / 1e6)}M TVL. TX: ${result.hash}`;

      return { action, reasoning };
    } catch (err) {
      console.log(`  ❌ Deposit failed: ${(err as Error).message}`);
      console.log(`     Skipping — will retry next cycle.`);
      return null;
    }
  }

  return null;
}

function printLiveSummary(entry: LogEntry): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  📊 LIVE Cycle ${entry.cycle} @ ${entry.timestamp}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  💰 Portfolio: $${fmt(entry.portfolio_value_usd)}`);

  for (const a of entry.actions) {
    if (a.type === "deposit" && a.deposit_tx) {
      console.log(`\n  ⚡ DEPOSIT: $${fmt(a.amount_usd!)} → ${a.vault_name} (${a.protocol}, ${a.chain})`);
      console.log(`     APY: ${fmt(a.vault_apy_base!)}% base (${a.organic_ratio}% organic)`);
      console.log(`     TX: ${a.deposit_tx}`);
      if (a.explorer_link) console.log(`     Explorer: ${a.explorer_link}`);
      if (a.gas_cost_usd) console.log(`     Gas: ~$${fmt(a.gas_cost_usd, 4)}`);
    } else if (a.type === "hold") {
      console.log(`\n  ✅ HOLD — no action needed`);
    }
  }

  console.log(`\n  💬 ${entry.reasoning}`);
  console.log(`  📝 Logged entry #${entry.cycle}\n`);
}
