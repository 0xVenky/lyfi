"use client";

import { useState, useEffect, useCallback } from "react";
import type { PoolListItem, PaginatedResponse } from "@/lib/types";
import { formatTvl } from "@/lib/utils";

// Tokens available for the wizard — common deposit tokens
const WIZARD_TOKENS = [
  { symbol: "USDC", label: "USDC" },
  { symbol: "USDT", label: "USDT" },
  { symbol: "ETH", label: "ETH" },
  { symbol: "WETH", label: "WETH" },
  { symbol: "DAI", label: "DAI" },
  { symbol: "WBTC", label: "WBTC" },
  { symbol: "WSTETH", label: "wstETH" },
];

function tagForVault(pool: PoolListItem, index: number): string | null {
  const base = pool.yield.apr_base ?? 0;
  const total = pool.yield.apr_total;
  if (index === 0 && pool.tvl_usd >= 100_000_000) return "Safest";
  if (total > 0 && base / total > 0.8) return "Organic";
  if (index === 0) return "Top pick";
  return null;
}

export default function WizardCardsPrototype() {
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [vaults, setVaults] = useState<PoolListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const hasAmount = amountNum > 0;
  const selectedVault = vaults.find((v) => v.id === selectedVaultId) ?? null;

  // Fetch vaults when token changes
  const fetchVaults = useCallback(async (tokenSymbol: string) => {
    setLoading(true);
    setSelectedVaultId(null);
    try {
      const params = new URLSearchParams({
        exposure: tokenSymbol,
        depositable: "true",
        sort: "apr_total",
        order: "desc",
        min_tvl: "50000",
        limit: "6",
      });
      const res = await fetch(`/api/v1/pools?${params}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json: PaginatedResponse<PoolListItem> = await res.json();
      setVaults(json.data);
    } catch (err) {
      console.error("Wizard vault fetch failed:", err);
      setVaults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVaults(token);
  }, [token, fetchVaults]);

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-10 overflow-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <p className="text-xs font-medium text-violet-600 uppercase tracking-widest mb-2">
          3-Tap Deposit Wizard
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Earn Yield</h1>
        <p className="text-sm text-gray-400 mt-1">
          Pick &rarr; Choose &rarr; Deposit
        </p>
      </div>

      {/* 3-card layout */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

        {/* Card 1: I have... */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">
              1
            </div>
            <h2 className="text-sm font-semibold text-gray-900">I have...</h2>
          </div>

          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              if (/^\d*\.?\d*$/.test(e.target.value)) setAmount(e.target.value);
            }}
            placeholder="1000"
            className="w-full text-3xl font-bold text-gray-900 bg-transparent placeholder:text-gray-200 focus:outline-none mb-2"
            autoFocus
          />

          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-200"
          >
            {WIZARD_TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.label}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
            <span>{vaults.length} vaults available</span>
          </div>
        </div>

        {/* Card 2: Best for me... */}
        <div
          className={`rounded-2xl border shadow-sm p-5 transition-all ${
            hasAmount && vaults.length > 0
              ? "bg-white border-gray-200"
              : "bg-gray-50 border-gray-100"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                hasAmount ? "bg-violet-600 text-white" : "bg-gray-200 text-gray-400"
              }`}
            >
              2
            </div>
            <h2
              className={`text-sm font-semibold transition-colors ${
                hasAmount ? "text-gray-900" : "text-gray-300"
              }`}
            >
              Best for me...
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              Loading vaults...
            </div>
          ) : !hasAmount ? (
            <p className="text-sm text-gray-300 py-8 text-center">
              Enter an amount to see recommendations
            </p>
          ) : vaults.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No vaults found for {token}
            </p>
          ) : (
            <div className="space-y-2">
              {vaults.map((v, i) => {
                const tag = tagForVault(v, i);
                const daily = amountNum * (v.yield.apr_total / 100) / 365;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVaultId(v.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      selectedVaultId === v.id
                        ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                        : "border-gray-100 hover:border-violet-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {v.protocol}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {v.chain}
                        </span>
                        {tag && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium shrink-0 ${
                            tag === "Safest" ? "bg-emerald-50 text-emerald-600"
                              : tag === "Organic" ? "bg-blue-50 text-blue-600"
                              : "bg-violet-50 text-violet-600"
                          }`}>
                            {tag}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-emerald-600 shrink-0 ml-2">
                        {v.yield.apr_total.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      <span>{formatTvl(v.tvl_usd)}</span>
                      <span>{v.pool_type}</span>
                      <span className="ml-auto text-emerald-600 font-medium">
                        ${daily.toFixed(2)}/day
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 3: Vault Detail + Confirm */}
        <div
          className={`rounded-2xl border shadow-sm transition-all ${
            selectedVault
              ? "bg-white border-gray-200"
              : "bg-gray-50 border-gray-100"
          }`}
        >
          <div className="flex items-center gap-2 p-5 pb-0">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                selectedVault ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-400"
              }`}
            >
              3
            </div>
            <h2
              className={`text-sm font-semibold transition-colors ${
                selectedVault ? "text-gray-900" : "text-gray-300"
              }`}
            >
              {selectedVault ? "Vault Detail" : "Select a vault"}
            </h2>
          </div>

          {!selectedVault ? (
            <p className="text-sm text-gray-300 py-10 text-center">
              Select a vault to see details
            </p>
          ) : (
            <VaultDetail vault={selectedVault} amount={amountNum} token={token} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card 3 detail panel ──

function VaultDetail({
  vault,
  amount,
  token,
}: {
  vault: PoolListItem;
  amount: number;
  token: string;
}) {
  const apyTotal = vault.yield.apr_total;
  const apyBase = vault.yield.apr_base ?? 0;
  const apyReward = vault.yield.apr_reward ?? 0;
  const daily = amount * (apyTotal / 100) / 365;

  const tag = tagForVault(vault, 0);

  // Risk color helpers
  const ageDays = vault.risk.contract_age_days;
  const isAudited = vault.risk.is_audited;

  return (
    <div className="p-5 pt-4 space-y-4">
      {/* Vault identity */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-gray-900">
            {vault.protocol}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {vault.chain}
            </span>
            {tag && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                tag === "Safest" ? "bg-emerald-50 text-emerald-600"
                  : tag === "Organic" ? "bg-blue-50 text-blue-600"
                  : "bg-violet-50 text-violet-600"
              }`}>
                {tag}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-emerald-600">{apyTotal.toFixed(1)}%</span>
          <p className="text-[10px] text-gray-400">APY</p>
        </div>
      </div>

      {/* APY breakdown bar */}
      {apyTotal > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>Yield breakdown</span>
            <span>{apyBase.toFixed(1)}% base + {apyReward.toFixed(1)}% reward</span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
            <div
              className="bg-emerald-500 rounded-l-full"
              style={{ width: `${apyTotal > 0 ? (apyBase / apyTotal) * 100 : 0}%` }}
            />
            {apyReward > 0 && (
              <div
                className="bg-violet-500"
                style={{ width: `${(apyReward / apyTotal) * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Base {apyBase.toFixed(1)}%
            </span>
            {apyReward > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
                Reward {apyReward.toFixed(1)}%
              </span>
            )}
          </div>
          {apyReward > 0 && apyTotal > 0 && apyReward / apyTotal > 0.6 && (
            <p className="text-[10px] text-amber-500 mt-1">
              {Math.round((apyReward / apyTotal) * 100)}% of yield is from rewards — may not be sustainable
            </p>
          )}
        </div>
      )}

      <div className="h-px bg-gray-100" />

      {/* Risk signals */}
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Risk</p>
        <div className="flex flex-wrap gap-1.5">
          {ageDays != null && (
            <RiskBadge
              label={`${ageDays}d`}
              color={ageDays > 365 ? "green" : ageDays > 180 ? "yellow" : "red"}
            />
          )}
          {isAudited != null && (
            <RiskBadge
              label={isAudited ? "Audited" : "Unaudited"}
              color={isAudited ? "green" : "red"}
            />
          )}
          <RiskBadge
            label={formatTvl(vault.tvl_usd)}
            color={vault.tvl_usd > 100_000_000 ? "green" : vault.tvl_usd > 10_000_000 ? "yellow" : "red"}
          />
          {vault.pool_type && (
            <RiskBadge label={vault.pool_type} color="green" />
          )}
        </div>
      </div>

      {/* Tokens */}
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Exposure</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {vault.exposure.underlying_tokens.map((t) => (
            <span key={t.address} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {t.symbol}
            </span>
          ))}
          {vault.exposure.category && (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
              vault.exposure.category === "stablecoin"
                ? "bg-emerald-50 text-emerald-600"
                : vault.exposure.category === "blue_chip"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-gray-100 text-gray-500"
            }`}>
              {vault.exposure.category === "stablecoin" ? "Stablecoin"
                : vault.exposure.category === "blue_chip" ? "Blue Chip"
                : vault.exposure.category}
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Earnings simulation */}
      {amount > 0 && (
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">
            Estimated earnings on {amount.toLocaleString()} {token}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <EarningsCell label="Daily" value={`$${daily.toFixed(2)}`} />
            <EarningsCell label="Monthly" value={`$${(daily * 30).toFixed(2)}`} />
            <EarningsCell label="Yearly" value={`$${(amount * (apyTotal / 100)).toFixed(0)}`} />
          </div>
        </div>
      )}

      {/* Confirm */}
      <div className="pt-1">
        <button className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-sm font-semibold text-white transition-colors">
          {amount > 0 ? `Deposit ${amount.toLocaleString()} ${token}` : "Deposit"}
        </button>
        <p className="text-[10px] text-gray-300 text-center mt-2">
          Powered by LI.FI Composer
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──

function RiskBadge({
  label,
  color,
}: {
  label: string;
  color: "green" | "yellow" | "red";
}) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    yellow: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${colors[color]}`}>
      {label}
    </span>
  );
}

function EarningsCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-emerald-50/50 border border-emerald-100/50 p-2.5 text-center">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-bold text-emerald-600 mt-0.5">{value}</p>
    </div>
  );
}
