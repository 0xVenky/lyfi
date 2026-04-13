import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const AGENT_DIR = process.env.AGENT_DATA_DIR || resolve(process.cwd(), "agent/data");

export async function POST(req: NextRequest) {
  const { amount } = await req.json();

  if (typeof amount !== "number" || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const portfolioPath = resolve(AGENT_DIR, "portfolio.json");
  const logPath = resolve(AGENT_DIR, "activity-log.json");

  if (!existsSync(portfolioPath)) {
    return NextResponse.json({ error: "Agent not running — no portfolio found" }, { status: 404 });
  }

  // Update portfolio
  const portfolio = JSON.parse(readFileSync(portfolioPath, "utf-8"));
  portfolio.idle_usd += amount;
  portfolio.total_value_usd += amount;
  writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));

  // Append to activity log
  const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf-8")) : [];
  const cycle = log.length > 0 ? log[log.length - 1].cycle + 1 : 1;
  const entry = {
    timestamp: new Date().toISOString(),
    cycle,
    type: "user_deposit",
    portfolio_value_usd: Math.round(portfolio.total_value_usd * 100) / 100,
    actions: [{ type: "deposit", amount_usd: amount }],
    reasoning: `User deposited $${amount.toLocaleString()} USDC. Funds are idle — will be allocated to the best vault on the next agent cycle.`,
  };
  log.push(entry);
  writeFileSync(logPath, JSON.stringify(log, null, 2));

  return NextResponse.json({ success: true, entry, portfolio });
}
