import "dotenv/config";
import { mkdirSync, existsSync } from "node:fs";
import { CONFIG } from "./config.js";
import { runCycle } from "./strategy.js";

// Ensure data directory exists
const dataDir = CONFIG.MODE === "live"
  ? new URL("../data-live/", import.meta.url).pathname
  : new URL("../data/", import.meta.url).pathname;
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

async function bannerSim(): Promise<void> {
  console.log(`
🤖 Lyfi Yield Agent — Simulation Mode ($${CONFIG.STARTING_CAPITAL_USD.toLocaleString()} USDC)
   Chains: ${CONFIG.CHAINS.map((c) => c.name).join(", ")}
   Interval: ${CONFIG.CHECK_INTERVAL_MS / 60000}m
   Mode: simulation
`);
}

async function bannerLive(): Promise<void> {
  const { printWalletStatus } = await import("./executor.js");
  console.log(`
🤖 Lyfi Yield Agent — LIVE MODE`);
  await printWalletStatus();
  console.log(`   Interval: ${CONFIG.CHECK_INTERVAL_MS / 60000}m\n`);
}

async function tick(): Promise<void> {
  try {
    if (CONFIG.MODE === "live") {
      const { runLiveCycle } = await import("./live-strategy.js");
      await runLiveCycle();
    } else {
      await runCycle();
    }
  } catch (err) {
    console.error(`\n  ❌ Cycle failed: ${(err as Error).message}`);
    console.error(`     Stack: ${(err as Error).stack}`);
    console.log("     Will retry next cycle.\n");
  }
}

async function main(): Promise<void> {
  // Validate live mode requirements
  if (CONFIG.MODE === "live") {
    if (!CONFIG.AGENT_PRIVATE_KEY) {
      console.error("❌ AGENT_PRIVATE_KEY is required for live mode.");
      process.exit(1);
    }
    await bannerLive();
  } else {
    await bannerSim();
  }

  // Run first cycle immediately
  await tick();

  // Schedule subsequent cycles
  console.log(`⏰ Next cycle in ${CONFIG.CHECK_INTERVAL_MS / 60000}m...\n`);

  setInterval(async () => {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`  🔄 Starting new cycle...`);
    await tick();
    console.log(`⏰ Next cycle in ${CONFIG.CHECK_INTERVAL_MS / 60000}m...\n`);
  }, CONFIG.CHECK_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
