import { mkdirSync, existsSync } from "node:fs";
import { runCycle } from "./strategy.js";

// Ensure data directory
const dataDir = new URL("../data/", import.meta.url).pathname;
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

console.log("🤖 Lyfi Yield Agent — Single cycle run\n");
runCycle()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
