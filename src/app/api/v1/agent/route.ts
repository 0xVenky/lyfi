import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const AGENT_DIR = process.env.AGENT_DATA_DIR || resolve(process.cwd(), "agent/data");

export async function GET() {
  const portfolioPath = resolve(AGENT_DIR, "portfolio.json");
  const logPath = resolve(AGENT_DIR, "activity-log.json");

  const portfolio = existsSync(portfolioPath)
    ? JSON.parse(readFileSync(portfolioPath, "utf-8"))
    : null;

  const log = existsSync(logPath)
    ? JSON.parse(readFileSync(logPath, "utf-8"))
    : [];

  return NextResponse.json({ portfolio, log });
}
