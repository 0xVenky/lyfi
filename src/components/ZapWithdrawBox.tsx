"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  useAccount,
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
import { CHAIN_BY_ID, NATIVE_TOKEN_ADDRESS } from "@/lib/constants";
import { VaultSelect, type VaultOption } from "./VaultSelect";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step =
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtBal(val: string): string {
  const n = parseFloat(val);
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

function fmtTokenAmt(raw: string, decimals: number): string {
  const val = formatUnits(BigInt(raw), decimals);
  const n = parseFloat(val);
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  if (n === 0) return "0";
  return n.toPrecision(4);
}

function Spinner() {
  return (
    <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ZapWithdrawBox() {
  // ---- Wallet ----
  const wagmiConfig = useConfig();
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, reset: resetTx } = useSendTransaction();

  // ---- State ----
  const [step, setStep] = useState<Step>("idle");
  const [vault, setVault] = useState<VaultOption | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();

  // ---- Fetch user's deposited vaults ----
  const [userVaults, setUserVaults] = useState<VaultOption[] | undefined>(undefined);
  const [loadingPositions, setLoadingPositions] = useState(false);

  useEffect(() => {
    if (!address) {
      setUserVaults(undefined);
      return;
    }
    let cancelled = false;
    setLoadingPositions(true);

    Promise.all([
      fetch(`/api/v1/portfolio/${address}`).then((r) => r.ok ? r.json() : { positions: [] }),
      fetch("/api/v1/pools?limit=2000").then((r) => r.ok ? r.json() : { data: [] }),
    ])
      .then(([posData, poolsData]) => {
        if (cancelled) return;
        type RawPos = { chainId: number; protocolName: string; asset: { address: string; name: string; symbol: string; decimals: number }; balanceUsd: string };
        const positions: RawPos[] = posData.positions ?? [];
        const pools = (poolsData.data ?? []) as Array<{
          id: string; symbol: string; protocol: string; chain: string;
          vault_chain_id: number; vault_address: string; is_redeemable: boolean;
          yield: { apr_total: number }; tvl_usd: number;
          exposure: { underlying_tokens: { address: string; symbol: string; decimals: number }[] };
        }>;

        const activePositions = positions.filter((p) => parseFloat(p.balanceUsd) > 0.01);

        // For each position, find ONE best-matching pool (not all)
        const matched: VaultOption[] = [];
        for (const pos of activePositions) {
          // Try exact vault address match first
          let pool = pools.find(
            (p: { vault_chain_id: number; vault_address: string }) =>
              p.vault_chain_id === pos.chainId &&
              p.vault_address.toLowerCase() === pos.asset.address.toLowerCase(),
          );
          // Fallback: first pool matching protocol + chain + underlying token
          if (!pool) {
            pool = pools.find(
              (p: { vault_chain_id: number; protocol: string; exposure: { underlying_tokens: { address: string }[] } }) =>
                p.vault_chain_id === pos.chainId &&
                p.protocol === pos.protocolName &&
                p.exposure.underlying_tokens.some((ut: { address: string }) => ut.address.toLowerCase() === pos.asset.address.toLowerCase()),
            );
          }
          if (!pool) continue;
          if (matched.some((m) => m.id === pool.id)) continue;
          matched.push({
            id: pool.id,
            symbol: pool.symbol,
            protocol: pool.protocol,
            chain: pool.chain,
            chainId: pool.vault_chain_id,
            address: pool.vault_address,
            apr: pool.yield.apr_total,
            tvl: pool.tvl_usd,
            underlying_tokens: pool.exposure.underlying_tokens,
            isRedeemable: pool.is_redeemable,
          });
        }

        setUserVaults(matched);
      })
      .catch(() => setUserVaults([]))
      .finally(() => { if (!cancelled) setLoadingPositions(false); });

    return () => { cancelled = true; };
  }, [address]);

  // ---- Vault share balance ----
  const { data: shareBalRaw } = useReadContract({
    address: vault?.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: vault?.chainId,
    query: { enabled: !!vault && !!address },
  });

  const shareBalance = useMemo(() => {
    if (shareBalRaw === undefined || !vault) return undefined;
    const raw = shareBalRaw as bigint;
    // Vault shares typically have 18 decimals
    const decimals = vault.underlying_tokens[0]?.decimals ?? 18;
    return { raw, formatted: formatUnits(raw, decimals) };
  }, [shareBalRaw, vault]);

  // ---- Underlying token for withdraw ----
  const withdrawToToken = vault?.underlying_tokens[0]?.address ?? NATIVE_TOKEN_ADDRESS;

  // ---- Tx confirmation ----
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => {
    if (step === "pending" && isConfirmed) setStep("confirmed");
  }, [step, isConfirmed]);

  // ---- Quote expiry ----
  const [quoteAge, setQuoteAge] = useState(0);
  useEffect(() => {
    if (step !== "quoted") { setQuoteAge(0); return; }
    const iv = setInterval(() => setQuoteAge((a) => a + 1), 1000);
    return () => clearInterval(iv);
  }, [step]);

  // ---- Explorer ----
  const explorerBase = vault ? CHAIN_BY_ID[vault.chainId]?.explorer : undefined;
  const explorerUrl = txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : null;

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleMax = () => {
    if (!shareBalance) return;
    setAmount(shareBalance.formatted);
  };

  const handleGetQuote = useCallback(async () => {
    if (!address || !amount || !vault) return;
    setStep("quoting");
    setError(null);
    try {
      const decimals = vault.underlying_tokens[0]?.decimals ?? 18;
      const fromAmount = parseUnits(amount, decimals).toString();
      const params = new URLSearchParams({
        fromChain: String(vault.chainId),
        toChain: String(vault.chainId),
        fromToken: vault.address,
        toToken: withdrawToToken,
        fromAddress: address,
        fromAmount,
      });
      const res = await fetch(`/api/v1/quote?${params}`);
      const data = await res.json();
      if (!res.ok) {
        const raw = data.error ?? data.message ?? "";
        let msg = typeof raw === "string" ? raw : JSON.stringify(raw);
        if (msg.includes("No available quotes")) msg = "No withdrawal route available for this vault. Try withdrawing directly on the protocol's site.";
        else if (msg.length > 120) msg = msg.slice(0, 120) + "...";
        throw new Error(msg || `Quote failed (${res.status})`);
      }

      const gasCosts: { amountUSD?: string }[] = data.estimate?.gasCosts ?? [];
      const totalGas = gasCosts.reduce((s: number, g: { amountUSD?: string }) => s + parseFloat(g.amountUSD ?? "0"), 0);

      setQuote({
        toAmount: data.estimate.toAmount,
        toAmountMin: data.estimate.toAmountMin,
        toTokenDecimals: data.action?.toToken?.decimals ?? 18,
        toTokenSymbol: data.action?.toToken?.symbol ?? "tokens",
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
  }, [address, amount, vault, withdrawToToken]);

  const handleWithdraw = useCallback(async () => {
    if (!quote || !address || !vault) return;
    try {
      if (walletChainId !== quote.txChainId) {
        setStep("signing");
        await switchChainAsync({ chainId: quote.txChainId });
      }
      // Approve vault shares if needed
      if (quote.approvalAddress) {
        setStep("approving");
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [quote.approvalAddress as Hex, maxUint256],
        });
        const approveHash = await sendTransactionAsync({
          to: vault.address as Hex,
          data: approveData,
          value: BigInt(0),
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
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
  }, [quote, address, vault, walletChainId, switchChainAsync, sendTransactionAsync, wagmiConfig]);

  const handleReset = () => {
    setStep("idle");
    setAmount("");
    setQuote(null);
    setTxHash(undefined);
    setError(null);
    resetTx();
  };

  // ===========================================================================
  // Render
  // ===========================================================================

  const isVaultRedeemable = vault?.isRedeemable !== false;
  const canQuote =
    isConnected &&
    vault !== null &&
    isVaultRedeemable &&
    amount !== "" &&
    parseFloat(amount) > 0 &&
    step === "idle";

  return (
    <div className="w-full max-w-md">
      <div className="rounded-[2rem] overflow-hidden" style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}>
        {/* ── WITHDRAW FROM section ── */}
        <div className="p-5 pb-3">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--outline)" }}>
            Withdraw from
          </label>
          <div className="mt-2">
            <VaultSelect
              selected={vault}
              onSelect={(v) => {
                setVault(v);
                setAmount("");
                if (quote) { setQuote(null); setStep("idle"); }
              }}
              externalVaults={userVaults}
              emptyMessage={
                !isConnected
                  ? "Connect wallet to see your positions"
                  : loadingPositions
                    ? "Loading your positions..."
                    : "No withdrawable positions found"
              }
            />
          </div>
        </div>

        {/* ── Arrow divider ── */}
        <div className="flex justify-center -my-2.5 relative z-10">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--surface-container-low)", color: "var(--outline)" }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* ── RECEIVE section ── */}
        <div className="p-5 pt-3" style={{ borderTop: "1px solid var(--surface-container-high)" }}>
          <label className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--outline)" }}>
            You receive
          </label>

          {/* Amount input */}
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                if (/^\d*\.?\d*$/.test(e.target.value)) {
                  setAmount(e.target.value);
                  if (quote) { setQuote(null); setStep("idle"); }
                }
              }}
              className="flex-1 min-w-0 text-2xl font-bold bg-transparent focus:outline-none font-[family-name:var(--font-manrope)]"
              style={{ color: "var(--on-surface)" }}
              disabled={!vault}
            />
            {vault && vault.underlying_tokens[0] && (
              <span
                className="flex items-center gap-1.5 rounded-full pl-3 pr-2.5 py-2 text-sm font-bold"
                style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface)" }}
              >
                {vault.underlying_tokens[0].symbol}
              </span>
            )}
          </div>

          {/* Balance + Max */}
          {vault && shareBalance && (
            <div className="flex items-center justify-end gap-2 mt-2 text-xs">
              <span style={{ color: "var(--outline)" }}>
                Shares: {fmtBal(shareBalance.formatted)}
              </span>
              <button
                onClick={handleMax}
                className="font-bold"
                style={{ color: "var(--primary)" }}
              >
                Max
              </button>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="px-5 pb-5 space-y-3">
          {/* Not connected */}
          {!isConnected && (
            <button
              onClick={() => openConnectModal?.()}
              className="w-full rounded-full py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 shadow-lg shadow-purple-500/20"
              style={{ background: "linear-gradient(135deg, #630ed4, #7c3aed)" }}
            >
              Connect Wallet
            </button>
          )}

          {/* Non-redeemable notice */}
          {isConnected && vault && !isVaultRedeemable && step === "idle" && (
            <div className="rounded-2xl p-4 text-center space-y-2" style={{ backgroundColor: "var(--surface-container-low)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>
                This vault doesn't support withdrawal via LI.FI
              </p>
              <p className="text-xs" style={{ color: "var(--outline)" }}>
                Withdraw directly on the protocol's site instead.
              </p>
            </div>
          )}

          {/* Get Quote */}
          {isConnected && step === "idle" && (!vault || isVaultRedeemable) && (
            <button
              onClick={handleGetQuote}
              disabled={!canQuote}
              className="w-full rounded-full py-3.5 text-sm font-bold text-white transition-all disabled:opacity-40"
              style={canQuote ? { background: "linear-gradient(135deg, #630ed4, #7c3aed)", boxShadow: "0 4px 16px rgba(99, 14, 212, 0.2)" } : { backgroundColor: "var(--surface-container-high)", color: "var(--outline)" }}
            >
              {!vault
                ? "Select a vault"
                : !amount || parseFloat(amount) <= 0
                  ? "Enter amount"
                  : "Get Withdraw Quote"}
            </button>
          )}

          {/* Quoting */}
          {step === "quoting" && (
            <button
              disabled
              className="w-full rounded-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}
            >
              <Spinner /> Getting quote...
            </button>
          )}

          {/* Quoted */}
          {step === "quoted" && quote && (
            <>
              <div className="rounded-2xl p-4 space-y-2 text-sm" style={{ backgroundColor: "var(--surface-container-low)" }}>
                <div className="flex justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>You receive</span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--on-surface)" }}>
                    ~{fmtTokenAmt(quote.toAmount, quote.toTokenDecimals)} {quote.toTokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>Minimum</span>
                  <span className="tabular-nums" style={{ color: "var(--on-surface)" }}>
                    ~{fmtTokenAmt(quote.toAmountMin, quote.toTokenDecimals)} {quote.toTokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>Gas cost</span>
                  <span className="tabular-nums" style={{ color: "var(--on-surface)" }}>~${quote.gasCostUSD}</span>
                </div>
                {quote.executionTime != null && quote.executionTime > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: "var(--on-surface-variant)" }}>Est. time</span>
                    <span style={{ color: "var(--on-surface)" }}>
                      {quote.executionTime < 60
                        ? `~${quote.executionTime}s`
                        : `~${Math.ceil(quote.executionTime / 60)} min`}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleWithdraw}
                className="w-full rounded-full py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "var(--secondary)", boxShadow: "0 4px 16px rgba(0, 108, 81, 0.2)" }}
              >
                Confirm Withdraw
              </button>

              {quoteAge >= 60 ? (
                <button
                  onClick={() => { setQuote(null); handleGetQuote(); }}
                  className="w-full text-center text-xs"
                  style={{ color: "#d97706" }}
                >
                  Quote expired -- click to refresh
                </button>
              ) : (
                <p className="text-center text-[11px]" style={{ color: "var(--outline)" }}>
                  Quote valid for {60 - quoteAge}s
                </p>
              )}
            </>
          )}

          {/* Approving */}
          {step === "approving" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Spinner />
              <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>Approving vault shares...</p>
              <p className="text-xs" style={{ color: "var(--outline)" }}>Confirm in your wallet</p>
            </div>
          )}

          {/* Signing */}
          {step === "signing" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Spinner />
              <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>Confirm in your wallet...</p>
            </div>
          )}

          {/* Pending */}
          {step === "pending" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Spinner />
              <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>Confirming withdrawal...</p>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: "var(--primary)" }}>
                  View on explorer
                </a>
              )}
            </div>
          )}

          {/* Confirmed */}
          {step === "confirmed" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-12 w-12 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: "var(--secondary-container)", color: "var(--on-secondary-container)" }}>
                &#x2713;
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--on-surface)" }}>Withdrawal confirmed!</p>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: "var(--primary)" }}>
                  View on explorer
                </a>
              )}
              <button onClick={handleReset} className="text-xs transition-colors hover:opacity-80" style={{ color: "var(--outline)" }}>
                Make another withdrawal
              </button>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <>
              <div className="rounded-2xl p-3" style={{ backgroundColor: "var(--error-container)" }}>
                <p className="text-sm" style={{ color: "var(--error)" }}>{error || "Something went wrong"}</p>
              </div>
              <button
                onClick={handleReset}
                className="w-full rounded-full py-3 text-sm transition-colors"
                style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}
              >
                Try again
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 text-[10px] text-center" style={{ borderTop: "1px solid var(--surface-container-high)", color: "var(--outline)" }}>
          Powered by LI.FI Composer
        </div>
      </div>
    </div>
  );
}
