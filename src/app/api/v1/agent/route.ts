import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Try multiple locations: env override, local agent data, then committed snapshot in public/
function findFile(name: string): string | null {
  const candidates = [
    process.env.AGENT_DATA_DIR && resolve(process.env.AGENT_DATA_DIR, name),
    resolve(process.cwd(), "agent/data", name),
    resolve(process.cwd(), "public/agent-data", name),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function GET() {
  const portfolioPath = findFile("portfolio.json");
  const logPath = findFile("activity-log.json");

  const portfolio = portfolioPath
    ? JSON.parse(readFileSync(portfolioPath, "utf-8"))
    : null;

  const log = logPath
    ? JSON.parse(readFileSync(logPath, "utf-8"))
    : [];

  return NextResponse.json({ portfolio, log });
}
