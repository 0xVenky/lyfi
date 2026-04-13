"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  parseUnits,
  formatUnits,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  type Hex,
  type Address,
} from "viem";
import type { PoolListItem, PaginatedResponse } from "@/lib/types";
import { formatTvl } from "@/lib/utils";
import {
  CHAIN_BY_ID,
  NATIVE_TOKEN_ADDRESS,
  NATIVE_TOKENS,
  ERC20_TOKENS_BY_CHAIN,
} from "@/lib/constants";

// ── Token config ──

const WIZARD_TOKENS = [
  { symbol: "USDC", label: "USDC" },
  { symbol: "USDT", label: "USDT" },
  { symbol: "ETH", label: "ETH" },
  { symbol: "WETH", label: "WETH" },
  { symbol: "DAI", label: "DAI" },
  { symbol: "WBTC", label: "WBTC" },
  { symbol: "WSTETH", label: "wstETH" },
];

function findTokenAddress(
  symbol: string,
  chainId: number,
): { address: string; decimals: number } | null {
  const upper = symbol.toUpperCase();
  // Native token
  const native = NATIVE_TOKENS[chainId];
  if (native && native.symbol.toUpperCase() === upper) {
    return { address: NATIVE_TOKEN_ADDRESS, decimals: native.decimals };
  }
  // ERC20
  const erc20s = ERC20_TOKENS_BY_CHAIN[chainId] ?? [];
  const match = erc20s.find((t) => t.symbol.toUpperCase() === upper);
  if (match) return { address: match.address, decimals: match.decimals };
  return null;
}

function tagForVault(pool: PoolListItem, index: number): string | null {
  const base = pool.yield.apr_base ?? 0;
  const total = pool.yield.apr_total;
  if (index === 0 && pool.tvl_usd >= 100_000_000) return "Safest";
  if (total > 0 && base / total > 0.8) return "Organic";
  if (index === 0) return "Top pick";
  return null;
}

// ── Deposit state machine ──

type DepositStep =
  | "idle"
  | "quoting"
  | "quoted"
  | "approving"
  | "signing"
  | "pending"
  | "confirmed"
  | "error";

type QuoteResult = {
  toAmount: string;
  toAmountMin: string;
  toTokenDecimals: number;
  toTokenSymbol: string;
  gasCostUSD: string;
  executionTime?: number;
  txTo: string;
  txData: string;
  txValue: string;
  txChainId: number;
  txGasLimit?: string;
  approvalAddress?: string;
};

// ── Page ──

export default function EarnPage() {
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [vaults, setVaults] = useState<PoolListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const hasAmount = amountNum > 0;
  const selectedVault = vaults.find((v) => v.id === selectedVaultId) ?? null;

  // Wallet
  const { address, chainId: walletChainId, isConnected } = useAccount();

  // Resolve from-token on wallet's chain
  const fromTokenInfo = useMemo(() => {
    if (!walletChainId) return null;
    return findTokenAddress(token, walletChainId);
  }, [token, walletChainId]);

  const isNativeFrom =
    fromTokenInfo?.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;

  // Balance
  const { data: nativeBal } = useBalance({
    address,
    chainId: walletChainId,
  });
  const { data: erc20BalRaw } = useReadContract({
    address: fromTokenInfo?.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: walletChainId,
    query: { enabled: !isNativeFrom && !!address && !!fromTokenInfo },
  });

  const balance = useMemo(() => {
    if (!fromTokenInfo) return undefined;
    if (isNativeFrom && nativeBal) {
      return formatUnits(nativeBal.value, nativeBal.decimals);
    }
    if (!isNativeFrom && erc20BalRaw !== undefined) {
      return formatUnits(erc20BalRaw as bigint, fromTokenInfo.decimals);
    }
    return undefined;
  }, [isNativeFrom, nativeBal, erc20BalRaw, fromTokenInfo]);

  // Fetch vaults
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
            <div className="h-6 w-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">1</div>
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
              <option key={t.symbol} value={t.symbol}>{t.label}</option>
            ))}
          </select>

          <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
            <span>{vaults.length} vaults available</span>
            {balance !== undefined && (
              <div>
                <span>Bal: {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} {token}</span>
                <button
                  onClick={() => {
                    const n = parseFloat(balance);
                    setAmount(isNativeFrom && n > 0.01 ? String(n - 0.01) : balance);
                  }}
                  className="text-violet-500 font-semibold ml-2 hover:text-violet-600"
                >
                  Max
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Best for me... */}
        <div
          className={`rounded-2xl border shadow-sm p-5 transition-all ${
            hasAmount && vaults.length > 0 ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"
          }`}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              hasAmount ? "bg-violet-600 text-white" : "bg-gray-200 text-gray-400"
            }`}>2</div>
            <h2 className={`text-sm font-semibold transition-colors ${hasAmount ? "text-gray-900" : "text-gray-300"}`}>
              Best for me...
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              Loading vaults...
            </div>
          ) : !hasAmount ? (
            <p className="text-sm text-gray-300 py-8 text-center">Enter an amount to see recommendations</p>
          ) : vaults.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No vaults found for {token}</p>
          ) : (
            <div className="space-y-2">
              {vaults.map((v, i) => {
                const tag = tagForVault(v, i);
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
                        <span className="text-sm font-semibold text-gray-900 truncate">{v.protocol}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{v.chain}</span>
                        {tag && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium shrink-0 ${
                            tag === "Safest" ? "bg-emerald-50 text-emerald-600"
                              : tag === "Organic" ? "bg-blue-50 text-blue-600"
                              : "bg-violet-50 text-violet-600"
                          }`}>{tag}</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-emerald-600 shrink-0 ml-2">{v.yield.apr_total.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      <span>{formatTvl(v.tvl_usd)}</span>
                      <span>{v.pool_type}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 3: Vault Detail + Deposit */}
        <div className={`rounded-2xl border shadow-sm transition-all ${
          selectedVault ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100"
        }`}>
          <div className="flex items-center gap-2 p-5 pb-0">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              selectedVault ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-400"
            }`}>3</div>
            <h2 className={`text-sm font-semibold transition-colors ${selectedVault ? "text-gray-900" : "text-gray-300"}`}>
              {selectedVault ? "Vault Detail" : "Select a vault"}
            </h2>
          </div>

          {!selectedVault ? (
            <p className="text-sm text-gray-300 py-10 text-center">Select a vault to see details</p>
          ) : (
            <DepositCard vault={selectedVault} amount={amountNum} token={token} />
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Card 3 — Vault detail + full deposit flow
// ══════════════════════════════════════════════════════════════

function DepositCard({
  vault,
  amount,
  token,
}: {
  vault: PoolListItem;
  amount: number;
  token: string;
}) {
  const wagmiConfig = useConfig();
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, reset: resetTx } = useSendTransaction();

  const [step, setStep] = useState<DepositStep>("idle");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();

  // Reset state when vault changes
  useEffect(() => {
    setStep("idle");
    setQuote(null);
    setError(null);
    setTxHash(undefined);
  }, [vault.id]);

  // Resolve from-token on wallet's chain
  const fromTokenInfo = useMemo(() => {
    if (!walletChainId) return null;
    return findTokenAddress(token, walletChainId);
  }, [token, walletChainId]);

  const isNativeFrom =
    fromTokenInfo?.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;

  // Tx confirmation
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => {
    if (step === "pending" && isConfirmed) setStep("confirmed");
  }, [step, isConfirmed]);

  // Quote expiry
  const [quoteAge, setQuoteAge] = useState(0);
  useEffect(() => {
    if (step !== "quoted") { setQuoteAge(0); return; }
    const iv = setInterval(() => setQuoteAge((a) => a + 1), 1000);
    return () => clearInterval(iv);
  }, [step]);

  // Explorer
  const explorerBase = vault.vault_chain_id ? CHAIN_BY_ID[vault.vault_chain_id]?.explorer : null;
  const explorerUrl = txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : null;

  // ── Get quote ──
  const handleGetQuote = useCallback(async () => {
    if (!address || !fromTokenInfo || amount <= 0) return;
    setStep("quoting");
    setError(null);

    try {
      const fromAmount = parseUnits(
        String(amount),
        fromTokenInfo.decimals,
      ).toString();

      const params = new URLSearchParams({
        fromChain: String(walletChainId),
        toChain: String(vault.vault_chain_id),
        fromToken: fromTokenInfo.address,
        toToken: vault.vault_address,
        fromAddress: address,
        fromAmount,
      });

      const res = await fetch(`/api/v1/quote?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Quote failed (${res.status})`);

      const gasCosts: { amountUSD?: string }[] = data.estimate?.gasCosts ?? [];
      const totalGas = gasCosts.reduce(
        (s: number, g: { amountUSD?: string }) => s + parseFloat(g.amountUSD ?? "0"),
        0,
      );

      setQuote({
        toAmount: data.estimate.toAmount,
        toAmountMin: data.estimate.toAmountMin,
        toTokenDecimals: data.action?.toToken?.decimals ?? 18,
        toTokenSymbol: data.action?.toToken?.symbol ?? "shares",
        gasCostUSD: totalGas.toFixed(2),
        executionTime: data.estimate?.executionDuration,
        txTo: data.transactionRequest.to,
        txData: data.transactionRequest.data,
        txValue: data.transactionRequest.value,
        txChainId: data.transactionRequest.chainId,
        txGasLimit: data.transactionRequest.gasLimit,
        approvalAddress: data.estimate?.approvalAddress,
      });
      setStep("quoted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get quote");
      setStep("error");
    }
  }, [address, amount, fromTokenInfo, walletChainId, vault]);

  // ── Execute deposit ──
  const handleDeposit = useCallback(async () => {
    if (!quote || !address || !fromTokenInfo) return;
    try {
      if (walletChainId !== quote.txChainId) {
        setStep("signing");
        await switchChainAsync({ chainId: quote.txChainId });
      }
      // ERC20 approval
      if (!isNativeFrom && quote.approvalAddress) {
        setStep("approving");
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [quote.approvalAddress as Hex, maxUint256],
        });
        const approveHash = await sendTransactionAsync({
          to: fromTokenInfo.address as Hex,
          data: approveData,
          value: BigInt(0),
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      // Send deposit tx
      setStep("signing");
      const hash = await sendTransactionAsync({
        to: quote.txTo as Hex,
        data: quote.txData as Hex,
        value: BigInt(quote.txValue),
        ...(quote.txGasLimit ? { gas: BigInt(quote.txGasLimit) } : {}),
      });
      setTxHash(hash);
      setStep("pending");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      if (msg.includes("rejected") || msg.includes("denied") || msg.includes("User rejected")) {
        setStep("quoted");
        return;
      }
      setError(msg);
      setStep("error");
    }
  }, [quote, address, fromTokenInfo, isNativeFrom, walletChainId, switchChainAsync, sendTransactionAsync, wagmiConfig]);

  const handleReset = () => {
    setStep("idle");
    setQuote(null);
    setError(null);
    setTxHash(undefined);
    resetTx();
  };

  // ── Vault detail (always visible) ──
  const apyTotal = vault.yield.apr_total;
  const apyBase = vault.yield.apr_base ?? 0;
  const apyReward = vault.yield.apr_reward ?? 0;
  const tag = tagForVault(vault, 0);
  const isCrossChain = walletChainId != null && walletChainId !== vault.vault_chain_id;

  return (
    <div className="p-5 pt-4 space-y-4">
      {/* Vault identity */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-base font-bold text-gray-900">{vault.protocol}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">{vault.chain}</span>
            {tag && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                tag === "Safest" ? "bg-emerald-50 text-emerald-600"
                  : tag === "Organic" ? "bg-blue-50 text-blue-600"
                  : "bg-violet-50 text-violet-600"
              }`}>{tag}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-emerald-600">{apyTotal.toFixed(1)}%</span>
          <p className="text-[10px] text-gray-400">APY</p>
        </div>
      </div>

      {/* APY breakdown */}
      {apyTotal > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>Yield breakdown</span>
            <span>{apyBase.toFixed(1)}% base + {apyReward.toFixed(1)}% reward</span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
            <div className="bg-emerald-500 rounded-l-full" style={{ width: `${(apyBase / apyTotal) * 100}%` }} />
            {apyReward > 0 && <div className="bg-violet-500" style={{ width: `${(apyReward / apyTotal) * 100}%` }} />}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Base {apyBase.toFixed(1)}%
            </span>
            {apyReward > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className="h-2 w-2 rounded-full bg-violet-500" /> Reward {apyReward.toFixed(1)}%
              </span>
            )}
          </div>
          {apyReward > 0 && apyTotal > 0 && apyReward / apyTotal > 0.6 && (
            <p className="text-[10px] text-amber-500 mt-1">
              {Math.round((apyReward / apyTotal) * 100)}% from rewards — may not be sustainable
            </p>
          )}
        </div>
      )}

      <div className="h-px bg-gray-100" />

      {/* Risk + Exposure */}
      <div className="flex flex-wrap gap-1.5">
        <RiskBadge label={formatTvl(vault.tvl_usd)} color={vault.tvl_usd > 100_000_000 ? "green" : vault.tvl_usd > 10_000_000 ? "yellow" : "red"} />
        <RiskBadge label={vault.pool_type} color="green" />
        {vault.exposure.underlying_tokens.map((t) => (
          <span key={t.address} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">{t.symbol}</span>
        ))}
        {vault.exposure.category && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            vault.exposure.category === "stablecoin" ? "bg-emerald-50 text-emerald-600"
              : vault.exposure.category === "blue_chip" ? "bg-blue-50 text-blue-600"
              : "bg-gray-100 text-gray-500"
          }`}>
            {vault.exposure.category === "stablecoin" ? "Stablecoin" : vault.exposure.category === "blue_chip" ? "Blue Chip" : vault.exposure.category}
          </span>
        )}
      </div>

      <div className="h-px bg-gray-100" />

      {/* ── Deposit flow ── */}

      {/* Cross-chain indicator */}
      {isCrossChain && step !== "confirmed" && (
        <p className="text-xs text-amber-500 flex items-center gap-1">
          <span>&#x26A1;</span>
          Cross-chain: {CHAIN_BY_ID[walletChainId!]?.name} &rarr; {CHAIN_BY_ID[vault.vault_chain_id]?.name}
        </p>
      )}

      {/* Not connected */}
      {!isConnected && (
        <button
          onClick={() => openConnectModal?.()}
          className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 text-sm font-semibold text-white transition-colors"
        >
          Connect Wallet to Deposit
        </button>
      )}

      {/* Connected — idle */}
      {isConnected && step === "idle" && (
        <button
          onClick={handleGetQuote}
          disabled={amount <= 0 || !fromTokenInfo}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 disabled:text-gray-400 py-3.5 text-sm font-semibold text-white transition-colors"
        >
          {!fromTokenInfo
            ? `${token} not available on this chain`
            : amount <= 0
              ? "Enter amount"
              : `Deposit ${amount.toLocaleString()} ${token}`}
        </button>
      )}

      {/* Quoting */}
      {step === "quoting" && (
        <button disabled className="w-full rounded-xl bg-gray-200 py-3.5 text-sm font-semibold text-gray-500 flex items-center justify-center gap-2">
          <Spinner /> Getting quote...
        </button>
      )}

      {/* Quoted */}
      {step === "quoted" && quote && (
        <>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2 text-sm">
            <Row label="You receive" value={`~${fmtAmt(quote.toAmount, quote.toTokenDecimals)} ${quote.toTokenSymbol}`} />
            <Row label="Gas cost" value={`~$${quote.gasCostUSD}`} />
            {quote.executionTime != null && quote.executionTime > 0 && (
              <Row label="Est. time" value={quote.executionTime < 60 ? `~${quote.executionTime}s` : `~${Math.ceil(quote.executionTime / 60)} min`} />
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Back
            </button>
            <button onClick={handleDeposit} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-semibold text-white transition-colors">
              Confirm Deposit
            </button>
          </div>
          {quoteAge >= 60 ? (
            <button onClick={() => { setQuote(null); handleGetQuote(); }} className="w-full text-center text-xs text-amber-500 hover:text-amber-400">
              Quote expired — click to refresh
            </button>
          ) : (
            <p className="text-center text-[11px] text-gray-400">Quote valid for {60 - quoteAge}s</p>
          )}
        </>
      )}

      {/* Approving */}
      {step === "approving" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <Spinner /><p className="text-sm text-gray-600">Approving token...</p>
          <p className="text-xs text-gray-400">Confirm in your wallet</p>
        </div>
      )}

      {/* Signing */}
      {step === "signing" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <Spinner /><p className="text-sm text-gray-600">Confirm in your wallet...</p>
        </div>
      )}

      {/* Pending */}
      {step === "pending" && (
        <div className="flex flex-col items-center gap-2 py-4">
          <Spinner /><p className="text-sm text-gray-600">Confirming transaction...</p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:text-violet-600 underline">
              View on explorer
            </a>
          )}
        </div>
      )}

      {/* Confirmed */}
      {step === "confirmed" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-2xl text-emerald-500">&#x2713;</div>
          <p className="text-sm font-semibold text-gray-900">Deposit confirmed!</p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:text-violet-600 underline">
              View on explorer
            </a>
          )}
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">Make another deposit</button>
        </div>
      )}

      {/* Error */}
      {step === "error" && (
        <>
          <div className="rounded-xl bg-red-50 border border-red-100 p-3">
            <p className="text-sm text-red-600">{error || "Something went wrong"}</p>
          </div>
          <button onClick={handleReset} className="w-full rounded-xl border border-gray-200 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Try again
          </button>
        </>
      )}

      <p className="text-[10px] text-gray-300 text-center">Powered by LI.FI Composer</p>
    </div>
  );
}

// ── Helpers ──

function Spinner() {
  return <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium text-right">{value}</span>
    </div>
  );
}

function fmtAmt(raw: string, decimals: number): string {
  const val = formatUnits(BigInt(raw), decimals);
  const n = parseFloat(val);
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  if (n === 0) return "0";
  return n.toPrecision(4);
}

function RiskBadge({ label, color }: { label: string; color: "green" | "yellow" | "red" }) {
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

