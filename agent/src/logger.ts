import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CONFIG } from "./config.js";
import type { LogEntry } from "./types.js";

export function readLog(): LogEntry[] {
  if (!existsSync(CONFIG.LOG_FILE)) return [];
  try {
    return JSON.parse(readFileSync(CONFIG.LOG_FILE, "utf-8")) as LogEntry[];
  } catch {
    return [];
  }
}

export function appendLog(entry: LogEntry): void {
  const log = readLog();
  log.push(entry);
  writeFileSync(CONFIG.LOG_FILE, JSON.stringify(log, null, 2));
}

export function getLastCycle(): number {
  const log = readLog();
  return log.length > 0 ? log[log.length - 1].cycle : 0;
}
