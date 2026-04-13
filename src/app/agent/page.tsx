"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface VaultAction {
  type: string;
  vault_name?: string;
  protocol?: string;
  chain?: string;
  amount_usd?: number;
  vault_apy_total?: number;
  vault_apy_base?: number;
  organic_ratio?: number;
  from_vault?: string;
  to_vault?: string;
  improvement_base?: number;
  simulated_gas_usd?: number;
  gas_recoup_days?: number;
}

interface PositionSummary {
  vault_name: string;
  chain: string;
  current_apy: number;
  value_usd: number;
  earnings_usd: number;
}

interface LogEntry {
  timestamp: string;
  cycle: number;
  type: string;
  portfolio_value_usd: number;
  earnings_since_last_usd?: number;
  positions?: PositionSummary[];
  actions: VaultAction[];
  reasoning: string;
}

interface Position {
  vault_slug: string;
  vault_name: string;
  protocol: string;
  protocol_url: string;
  chain: string;
  chain_id: number;
  deposit_amount_usd: number;
  entry_apy: number;
  current_apy: number;
  simulated_earnings_usd: number;
  current_value_usd: number;
}

interface Portfolio {
  starting_capital_usd: number;
  started_at: string;
  positions: Position[];
  idle_usd: number;
  total_value_usd: number;
  total_earnings_usd: number;
  total_simulated_gas_usd: number;
  total_rebalances: number;
  total_checks: number;
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  initial_allocation: { label: "Initial Allocation", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  check: { label: "Check", bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
  rebalance: { label: "Rebalance", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  user_deposit: { label: "Deposit", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  idle_allocation: { label: "Idle Allocated", bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
};

export default function AgentDashboard() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/agent");
      const data = await res.json();
      setPortfolio(data.portfolio);
      setLog(data.log ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30_000); // refresh every 30s
    return () => clearInterval(iv);
  }, [fetchData]);

  async function handleDeposit() {
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) return;
    setDepositing(true);
    try {
      await fetch("/api/v1/agent/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      setDepositAmount("");
      await fetchData();
    } finally {
      setDepositing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400 text-sm">Loading agent data...</div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Yield Agent</h1>
        <p className="text-gray-500 mb-6">
          The agent hasn't started yet. Run it with:
        </p>
        <code className="bg-gray-100 px-4 py-2 rounded-lg text-sm text-gray-700 font-mono">
          cd lyfi/agent && npx tsx src/index.ts
        </code>
      </div>
    );
  }

  const started = new Date(portfolio.started_at);
  const runningHours = (Date.now() - started.getTime()) / (1000 * 60 * 60);
  const pctReturn = portfolio.starting_capital_usd > 0
    ? (portfolio.total_earnings_usd / portfolio.starting_capital_usd) * 100
    : 0;

  // Chart data — portfolio value over time from log entries
  const chartData = log
    .filter((e) => e.portfolio_value_usd > 0)
    .map((e) => ({
      time: formatTs(e.timestamp),
      value: e.portfolio_value_usd,
      type: e.type,
    }));

  // Find rebalance points for reference lines
  const rebalancePoints = log
    .filter((e) => e.type === "rebalance" || e.type === "idle_allocation" || e.type === "user_deposit")
    .map((e) => formatTs(e.timestamp));

  // Calculate Y-axis domain with padding
  const values = chartData.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = Math.max((maxVal - minVal) * 0.15, 10);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">AI Yield Agent</h1>
          <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">
            Simulation
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Managing ${fmt(portfolio.starting_capital_usd, 0)} USDC across Base & Arbitrum &mdash; running for {fmt(runningHours, 1)}h
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Portfolio Value"
          value={`$${fmt(portfolio.total_value_usd)}`}
          sub={`+$${fmt(portfolio.total_earnings_usd)} (${fmt(pctReturn, 4)}%)`}
          positive
        />
        <StatCard label="Checks" value={String(portfolio.total_checks)} sub={`${portfolio.total_rebalances} rebalances`} />
        <StatCard
          label="Idle Funds"
          value={`$${fmt(portfolio.idle_usd)}`}
          sub={portfolio.idle_usd > 100 ? "Pending allocation" : "Fully allocated"}
          highlight={portfolio.idle_usd > 100}
        />
        <StatCard
          label="Gas Spent"
          value={`$${fmt(portfolio.total_simulated_gas_usd)}`}
          sub="Simulated"
        />
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Portfolio Value</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis
                domain={[minVal - padding, maxVal + padding]}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}K`}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: unknown) => [`$${fmt(Number(value ?? 0))}`, "Value"]}
              />
              {rebalancePoints.map((t, i) => (
                <ReferenceLine key={i} x={t} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
              ))}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: { type: string } };
                  const isEvent = payload.type !== "check";
                  return isEvent ? (
                    <circle cx={cx} cy={cy} r={4} fill="#7c3aed" stroke="#fff" strokeWidth={2} />
                  ) : (
                    <circle cx={cx} cy={cy} r={2} fill="#7c3aed" />
                  );
                }}
                activeDot={{ r: 5, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-violet-600 inline-block" /> Value
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 border-t border-dashed border-amber-400 inline-block" /> Rebalance / Deposit
            </span>
          </div>
        </div>
      )}

      {/* Current positions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Current Positions</h2>
        <div className="space-y-3">
          {portfolio.positions.map((pos, i) => {
            const pctOfPortfolio = (pos.current_value_usd / portfolio.total_value_usd) * 100;
            return (
              <div key={`${pos.vault_slug}-${i}`} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {pos.protocol_url ? (
                      <a href={pos.protocol_url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-violet-700 hover:underline">
                        {pos.vault_name}
                      </a>
                    ) : (
                      <span className="font-medium text-sm text-gray-900">{pos.vault_name}</span>
                    )}
                    <span className="text-xs text-gray-400">{pos.protocol}</span>
                    <ChainBadge chain={pos.chain} />
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>${fmt(pos.current_value_usd)} ({fmt(pctOfPortfolio, 1)}%)</span>
                    <span className="text-green-600">+${fmt(pos.simulated_earnings_usd)} earned</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{fmt(pos.current_apy)}%</div>
                  <div className="text-xs text-gray-400">APY</div>
                </div>
                {/* Allocation bar */}
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pctOfPortfolio}%` }} />
                </div>
              </div>
            );
          })}
          {portfolio.idle_usd > 100 && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div className="flex-1">
                <span className="font-medium text-sm text-amber-800">Idle USDC</span>
                <div className="text-xs text-amber-600 mt-0.5">
                  Pending — will be allocated on next agent cycle
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-amber-800">${fmt(portfolio.idle_usd)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulate Deposit */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Simulate Deposit</h2>
        <p className="text-xs text-gray-400 mb-3">
          Funds go idle on deposit. The agent picks them up on its next cycle and allocates to the best vault.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="10,000"
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <button
            onClick={handleDeposit}
            disabled={depositing || !depositAmount || parseFloat(depositAmount) <= 0}
            className="px-5 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {depositing ? "Depositing..." : "Deposit USDC"}
          </button>
        </div>
        <div className="flex gap-2 mt-2">
          {[1000, 5000, 10000, 50000].map((amt) => (
            <button
              key={amt}
              onClick={() => setDepositAmount(String(amt))}
              className="px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              ${(amt / 1000).toFixed(0)}K
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Activity Timeline
          <span className="text-xs font-normal text-gray-400 ml-2">{log.length} entries</span>
        </h2>
        <div className="space-y-0">
          {[...log].reverse().map((entry, i) => {
            const style = TYPE_STYLES[entry.type] ?? TYPE_STYLES.check;
            return (
              <div key={i} className="relative pl-6 pb-6 last:pb-0">
                {/* Timeline line */}
                {i < log.length - 1 && (
                  <div className="absolute left-[7px] top-3 bottom-0 w-px bg-gray-200" />
                )}
                {/* Dot */}
                <div className={`absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-white ${style.dot}`} />

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      Cycle {entry.cycle} &mdash; {formatTs(entry.timestamp)} ({relTime(entry.timestamp)})
                    </span>
                  </div>

                  {/* Actions summary */}
                  <div className="space-y-1">
                    {entry.actions.map((a, j) => (
                      <ActionLine key={j} action={a} entryType={entry.type} />
                    ))}
                  </div>

                  {/* Positions at this point */}
                  {entry.positions && entry.positions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {entry.positions.map((p, k) => (
                        <span key={k} className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                          {p.vault_name} ({p.chain}) ${fmt(p.value_usd, 0)} @ {fmt(p.current_apy)}%
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reasoning */}
                  <p className="text-xs text-gray-500 leading-relaxed mt-1">
                    {entry.reasoning}
                  </p>

                  {/* Earnings badge */}
                  {entry.earnings_since_last_usd != null && entry.earnings_since_last_usd > 0 && (
                    <span className="inline-block text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded mt-1">
                      +${fmt(entry.earnings_since_last_usd)} this cycle
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 pb-8">
        Lyfi AI Agent &mdash; Simulation mode. No real funds at risk. Data refreshes every 30s.
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  positive,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className={`text-xs mt-0.5 ${positive ? "text-green-600" : highlight ? "text-amber-600" : "text-gray-400"}`}>
        {sub}
      </div>
    </div>
  );
}

function ChainBadge({ chain }: { chain: string }) {
  const colors: Record<string, string> = {
    base: "bg-blue-50 text-blue-600",
    arbitrum: "bg-sky-50 text-sky-600",
    ethereum: "bg-indigo-50 text-indigo-600",
  };
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colors[chain.toLowerCase()] ?? "bg-gray-100 text-gray-500"}`}>
      {chain}
    </span>
  );
}

function ActionLine({ action, entryType }: { action: VaultAction; entryType: string }) {
  if (action.type === "hold") {
    return <div className="text-xs text-gray-500">No action needed &mdash; all positions optimal</div>;
  }

  if (action.type === "rebalance") {
    return (
      <div className="text-xs">
        <span className="text-amber-700 font-medium">{action.from_vault}</span>
        <span className="text-gray-400 mx-1">&rarr;</span>
        <span className="text-amber-700 font-medium">{action.to_vault}</span>
        <span className="text-gray-400 mx-1">on {action.chain}</span>
        {action.improvement_base != null && (
          <span className="text-green-600 ml-1">+{fmt(action.improvement_base)}% APY</span>
        )}
        {action.simulated_gas_usd != null && (
          <span className="text-gray-400 ml-1">(gas: ${fmt(action.simulated_gas_usd)})</span>
        )}
      </div>
    );
  }

  if (action.type === "deposit") {
    if (entryType === "user_deposit") {
      return (
        <div className="text-xs text-green-700 font-medium">
          +${fmt(action.amount_usd ?? 0)} USDC deposited &mdash; awaiting agent allocation
        </div>
      );
    }
    return (
      <div className="text-xs">
        <span className="text-violet-700 font-medium">${fmt(action.amount_usd ?? 0)}</span>
        <span className="text-gray-400 mx-1">&rarr;</span>
        <span className="text-violet-700 font-medium">{action.vault_name}</span>
        <span className="text-gray-400 ml-1">({action.protocol}, {action.chain})</span>
        {action.vault_apy_base != null && (
          <span className="text-green-600 ml-1">{fmt(action.vault_apy_base)}% base APY</span>
        )}
      </div>
    );
  }

  return null;
}
