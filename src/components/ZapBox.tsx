"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useReadContracts,
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
import {
  SUPPORTED_CHAINS,
  CHAIN_BY_ID,
  NATIVE_TOKEN_ADDRESS,
  NATIVE_TOKENS,
  ERC20_TOKENS_BY_CHAIN,
  type CommonToken,
} from "@/lib/constants";
import { VaultSelect, type VaultOption } from "./VaultSelect";
import { ChainDot } from "./ChainDot";

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

type RouteStep = {
  type: string;
  toSymbol: string;
  toolName?: string;
};

type QuoteResult = {
  toAmount: string;
  toAmountMin: string;
  toTokenDecimals: number;
  toTokenSymbol: string;
  gasCostUSD: string;
  executionTime?: number;
  routeSteps: RouteStep[];
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
// Token list builder (deduped: native + common ERC20s)
// ---------------------------------------------------------------------------

function getTokens(chainId: number): CommonToken[] {
  const native = NATIVE_TOKENS[chainId];
  const erc20s = ERC20_TOKENS_BY_CHAIN[chainId] ?? [];
  const seen = new Set<string>();
  const result: CommonToken[] = [];
  for (const t of [...(native ? [native] : []), ...erc20s]) {
    const key = t.address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ZapBox() {
  // ---- Wallet ----
  const wagmiConfig = useConfig();
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, reset: resetTx } = useSendTransaction();

  // ---- State ----
  const [step, setStep] = useState<Step>("idle");
  const [fromChainId, setFromChainId] = useState<number>(walletChainId ?? 1);
  const [fromToken, setFromToken] = useState<CommonToken>(
    NATIVE_TOKENS[walletChainId ?? 1] ?? NATIVE_TOKENS[1]!,
  );
  const [amount, setAmount] = useState("");
  const [vault, setVault] = useState<VaultOption | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();

  // Sync chain default to wallet on connect
  const initializedRef = useRef(false);
  useEffect(() => {
    if (walletChainId && !initializedRef.current) {
      initializedRef.current = true;
      setFromChainId(walletChainId);
      setFromToken(
        NATIVE_TOKENS[walletChainId] ?? {
          address: NATIVE_TOKEN_ADDRESS,
          symbol: "ETH",
          decimals: 18,
        },
      );
    }
  }, [walletChainId]);

  // ---- Derived ----
  const isNativeFrom = fromToken.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;
  const tokens = useMemo(() => getTokens(fromChainId), [fromChainId]);
  const isCrossChain = vault ? fromChainId !== vault.chainId : false;

  // ---- Token dropdown state ----
  const [tokenOpen, setTokenOpen] = useState(false);
  const tokenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tokenRef.current && !tokenRef.current.contains(e.target as Node))
        setTokenOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ---- Balance for selected token ----
  const { data: nativeBal } = useBalance({ address, chainId: fromChainId });
  const { data: erc20BalRaw } = useReadContract({
    address: fromToken.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: fromChainId,
    query: { enabled: !isNativeFrom && !!address },
  });

  const balance = useMemo(() => {
    if (isNativeFrom && nativeBal)
      return { raw: nativeBal.value, formatted: formatUnits(nativeBal.value, nativeBal.decimals) };
    if (!isNativeFrom && erc20BalRaw !== undefined) {
      const raw = erc20BalRaw as bigint;
      return { raw, formatted: formatUnits(raw, fromToken.decimals) };
    }
    return undefined;
  }, [isNativeFrom, nativeBal, erc20BalRaw, fromToken.decimals]);

  // ---- Balances for token dropdown ----
  const erc20Only = useMemo(
    () => tokens.filter((t) => t.address.toLowerCase() !== NATIVE_TOKEN_ADDRESS),
    [tokens],
  );
  const dropdownContracts = useMemo(
    () =>
      address
        ? erc20Only.map((t) => ({
            address: t.address as Address,
            abi: erc20Abi as typeof erc20Abi,
            functionName: "balanceOf" as const,
            args: [address] as const,
            chainId: fromChainId,
          }))
        : [],
    [erc20Only, address, fromChainId],
  );
  const { data: erc20Bals } = useReadContracts({
    contracts: dropdownContracts,
    query: { enabled: !!address && dropdownContracts.length > 0 },
  });

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
  const explorerBase = CHAIN_BY_ID[fromChainId]?.explorer;
  const explorerUrl = txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : null;

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleChainChange = (id: number) => {
    setFromChainId(id);
    setFromToken(
      NATIVE_TOKENS[id] ?? { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18 },
    );
    setQuote(null);
  };

  const handleMax = () => {
    if (!balance) return;
    const n = parseFloat(balance.formatted);
    setAmount(isNativeFrom && n > 0.01 ? String(n - 0.01) : balance.formatted);
  };

  const handleGetQuote = useCallback(async () => {
    if (!address || !amount || !vault) return;
    setStep("quoting");
    setError(null);
    try {
      const fromAmount = parseUnits(amount, fromToken.decimals).toString();
      const params = new URLSearchParams({
        fromChain: String(fromChainId),
        toChain: String(vault.chainId),
        fromToken: fromToken.address,
        toToken: vault.address,
        fromAddress: address,
        fromAmount,
      });
      const res = await fetch(`/api/v1/quote?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Quote failed (${res.status})`);

      const gasCosts: { amountUSD?: string }[] = data.estimate?.gasCosts ?? [];
      const totalGas = gasCosts.reduce((s: number, g: { amountUSD?: string }) => s + parseFloat(g.amountUSD ?? "0"), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routeSteps: RouteStep[] = (data.includedSteps ?? []).map((s: any) => ({
        type: s.type ?? "step",
        toSymbol: s.action?.toToken?.symbol ?? "?",
        toolName: s.toolDetails?.name,
      }));

      setQuote({
        toAmount: data.estimate.toAmount,
        toAmountMin: data.estimate.toAmountMin,
        toTokenDecimals: data.action?.toToken?.decimals ?? 18,
        toTokenSymbol: data.action?.toToken?.symbol ?? "shares",
        gasCostUSD: totalGas.toFixed(2),
        executionTime: data.estimate?.executionDuration,
        routeSteps,
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
  }, [address, amount, fromToken, fromChainId, vault]);

  const handleDeposit = useCallback(async () => {
    if (!quote || !address) return;
    try {
      if (walletChainId !== quote.txChainId) {
        setStep("signing");
        await switchChainAsync({ chainId: quote.txChainId });
      }
      if (!isNativeFrom && quote.approvalAddress) {
        setStep("approving");
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [quote.approvalAddress as Hex, maxUint256],
        });
        const approveHash = await sendTransactionAsync({
          to: fromToken.address as Hex,
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
  }, [quote, address, fromToken, isNativeFrom, walletChainId, switchChainAsync, sendTransactionAsync, wagmiConfig]);

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

  const canQuote =
    isConnected &&
    vault !== null &&
    amount !== "" &&
    parseFloat(amount) > 0 &&
    step === "idle";

  return (
    <div className="w-full max-w-md">
      <div className="rounded-[2rem] overflow-hidden" style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}>
        {/* ── FROM section ── */}
        <div className="p-5 pb-3">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--outline)" }}>
            From
          </label>

          {/* Amount + token selector */}
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
            />

            {/* Token dropdown */}
            <div ref={tokenRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setTokenOpen(!tokenOpen)}
                className="flex items-center gap-1.5 rounded-full pl-3 pr-2.5 py-2 text-sm font-bold transition-colors"
                style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface)" }}
              >
                {fromToken.symbol}
                <svg className="h-3.5 w-3.5" style={{ color: "var(--outline)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {tokenOpen && (
                <div className="absolute right-0 z-50 mt-1 w-52 max-h-60 overflow-y-auto rounded-2xl shadow-lg" style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.08)" }}>
                  {tokens.map((t) => {
                    const isNative = t.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;
                    let bal: string | undefined;
                    if (isNative && nativeBal) {
                      bal = fmtBal(formatUnits(nativeBal.value, nativeBal.decimals));
                    } else {
                      const idx = erc20Only.findIndex((e) => e.address.toLowerCase() === t.address.toLowerCase());
                      if (idx >= 0 && erc20Bals?.[idx]?.result !== undefined) {
                        bal = fmtBal(formatUnits(erc20Bals[idx].result as bigint, t.decimals));
                      }
                    }
                    const isSelected = t.address.toLowerCase() === fromToken.address.toLowerCase();
                    return (
                      <button
                        key={t.address}
                        onClick={() => {
                          setFromToken(t);
                          setTokenOpen(false);
                          if (quote) { setQuote(null); setStep("idle"); }
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                        style={{
                          color: isSelected ? "var(--primary)" : "var(--on-surface)",
                          backgroundColor: isSelected ? "var(--surface-container-low)" : "transparent",
                        }}
                      >
                        <span className="font-semibold">{t.symbol}</span>
                        {bal !== undefined && (
                          <span className="text-xs" style={{ color: "var(--outline)" }}>{bal}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Balance + Max + Chain */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <select
                value={fromChainId}
                onChange={(e) => handleChainChange(Number(e.target.value))}
                className="text-xs bg-transparent border-none focus:outline-none cursor-pointer pr-1 font-medium"
                style={{ color: "var(--on-surface-variant)" }}
              >
                {SUPPORTED_CHAINS.map((c) => (
                  <option key={c.chainId} value={c.chainId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {balance && (
              <div className="flex items-center gap-2 text-xs">
                <span style={{ color: "var(--outline)" }}>
                  {fmtBal(balance.formatted)} {fromToken.symbol}
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
        </div>

        {/* ── Arrow divider ── */}
        <div className="flex justify-center -my-2.5 relative z-10">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--surface-container-low)", color: "var(--outline)" }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* ── INTO section ── */}
        <div className="p-5 pt-3" style={{ borderTop: "1px solid var(--surface-container-high)" }}>
          <label className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--outline)" }}>
            Deposit into
          </label>
          <div className="mt-2">
            <VaultSelect
              selected={vault}
              onSelect={(v) => {
                setVault(v);
                if (quote) { setQuote(null); setStep("idle"); }
              }}
            />
          </div>
          {vault && isCrossChain && (
            <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "#d97706" }}>
              <span>&#x26A1;</span>
              Cross-chain:{" "}
              <ChainDot chain={CHAIN_BY_ID[fromChainId]?.network ?? ""} size={14} />
              {" "}{CHAIN_BY_ID[fromChainId]?.name} &rarr;{" "}
              <ChainDot chain={vault.chain} size={14} />
              {" "}{vault.chain.charAt(0).toUpperCase() + vault.chain.slice(1)}
            </p>
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

          {/* Get Quote */}
          {isConnected && step === "idle" && (
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
                  : "Get Quote"}
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
                {/* Route */}
                {quote.routeSteps.length > 0 && (
                  <div className="flex items-center gap-1 text-xs flex-wrap">
                    <span style={{ color: "var(--outline)" }}>Route:</span>
                    <span className="font-semibold" style={{ color: "var(--on-surface)" }}>{fromToken.symbol}</span>
                    {quote.routeSteps.map((s, i) => (
                      <span key={i} className="contents">
                        <span style={{ color: "var(--outline-variant)" }}>&rarr;</span>
                        <span style={{ color: "var(--on-surface-variant)" }}>
                          {s.type === "swap" ? "Swap" : s.type === "cross" ? "Bridge" : s.type}
                          {s.toolName ? ` (${s.toolName})` : ""}
                        </span>
                        <span style={{ color: "var(--outline-variant)" }}>&rarr;</span>
                        <span style={{ color: "var(--on-surface)" }}>{s.toSymbol}</span>
                      </span>
                    ))}
                    <span style={{ color: "var(--outline-variant)" }}>&rarr;</span>
                    <span className="font-semibold" style={{ color: "var(--primary)" }}>Vault</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>You receive</span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--on-surface)" }}>
                    ~{fmtTokenAmt(quote.toAmount, quote.toTokenDecimals)} {quote.toTokenSymbol}
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
                onClick={handleDeposit}
                className="w-full rounded-full py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "var(--secondary)", boxShadow: "0 4px 16px rgba(0, 108, 81, 0.2)" }}
              >
                Confirm Deposit
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
              <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>Approving token...</p>
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
              <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>Confirming transaction...</p>
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
              <p className="text-sm font-bold" style={{ color: "var(--on-surface)" }}>Deposit confirmed!</p>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: "var(--primary)" }}>
                  View on explorer
                </a>
              )}
              <button onClick={handleReset} className="text-xs transition-colors hover:opacity-80" style={{ color: "var(--outline)" }}>
                Make another deposit
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
