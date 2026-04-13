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
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {/* ── FROM section ── */}
        <div className="p-5 pb-3">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            From
          </label>

          {/* Amount + token selector */}
          <div className="flex items-center gap-2 mt-2">
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
              className="flex-1 min-w-0 text-2xl font-semibold text-gray-900 bg-transparent placeholder:text-gray-300 focus:outline-none"
            />

            {/* Token dropdown */}
            <div ref={tokenRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setTokenOpen(!tokenOpen)}
                className="flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200 pl-3 pr-2.5 py-2 text-sm font-semibold text-gray-900 transition-colors"
              >
                {fromToken.symbol}
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {tokenOpen && (
                <div className="absolute right-0 z-50 mt-1 w-52 max-h-60 overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-lg">
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
                    return (
                      <button
                        key={t.address}
                        onClick={() => {
                          setFromToken(t);
                          setTokenOpen(false);
                          if (quote) { setQuote(null); setStep("idle"); }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                          t.address.toLowerCase() === fromToken.address.toLowerCase()
                            ? "bg-violet-50 text-violet-700"
                            : "text-gray-700"
                        }`}
                      >
                        <span className="font-medium">{t.symbol}</span>
                        {bal !== undefined && (
                          <span className="text-xs text-gray-400">{bal}</span>
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
              {/* Chain selector */}
              <select
                value={fromChainId}
                onChange={(e) => handleChainChange(Number(e.target.value))}
                className="text-xs text-gray-500 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
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
                <span className="text-gray-400">
                  {fmtBal(balance.formatted)} {fromToken.symbol}
                </span>
                <button
                  onClick={handleMax}
                  className="text-violet-500 hover:text-violet-600 font-semibold"
                >
                  Max
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Arrow divider ── */}
        <div className="flex justify-center -my-2.5 relative z-10">
          <div className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* ── INTO section ── */}
        <div className="p-5 pt-3 border-t border-gray-100">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
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
            <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
              <span>&#x26A1;</span>
              Cross-chain: {CHAIN_BY_ID[fromChainId]?.name} &rarr;{" "}
              {vault.chain.charAt(0).toUpperCase() + vault.chain.slice(1)}
            </p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="px-5 pb-5 space-y-3">
          {/* Not connected */}
          {!isConnected && (
            <button
              onClick={() => openConnectModal?.()}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 text-sm font-semibold text-white transition-colors"
            >
              Connect Wallet
            </button>
          )}

          {/* Get Quote */}
          {isConnected && step === "idle" && (
            <button
              onClick={handleGetQuote}
              disabled={!canQuote}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-gray-200 disabled:text-gray-400 py-3.5 text-sm font-semibold text-white transition-colors"
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
              className="w-full rounded-xl bg-gray-200 py-3.5 text-sm font-semibold text-gray-500 flex items-center justify-center gap-2"
            >
              <Spinner /> Getting quote...
            </button>
          )}

          {/* Quoted */}
          {step === "quoted" && quote && (
            <>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2 text-sm">
                {/* Route */}
                {quote.routeSteps.length > 0 && (
                  <div className="flex items-center gap-1 text-xs flex-wrap">
                    <span className="text-gray-400">Route:</span>
                    <span className="text-gray-700 font-medium">{fromToken.symbol}</span>
                    {quote.routeSteps.map((s, i) => (
                      <span key={i} className="contents">
                        <span className="text-gray-300">&rarr;</span>
                        <span className="text-gray-500">
                          {s.type === "swap" ? "Swap" : s.type === "cross" ? "Bridge" : s.type}
                          {s.toolName ? ` (${s.toolName})` : ""}
                        </span>
                        <span className="text-gray-300">&rarr;</span>
                        <span className="text-gray-700">{s.toSymbol}</span>
                      </span>
                    ))}
                    <span className="text-gray-300">&rarr;</span>
                    <span className="text-violet-600 font-medium">Vault</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">You receive</span>
                  <span className="text-gray-900 font-medium">
                    ~{fmtTokenAmt(quote.toAmount, quote.toTokenDecimals)} {quote.toTokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gas cost</span>
                  <span className="text-gray-700">~${quote.gasCostUSD}</span>
                </div>
                {quote.executionTime != null && quote.executionTime > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Est. time</span>
                    <span className="text-gray-700">
                      {quote.executionTime < 60
                        ? `~${quote.executionTime}s`
                        : `~${Math.ceil(quote.executionTime / 60)} min`}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleDeposit}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-sm font-semibold text-white transition-colors"
              >
                Confirm Deposit
              </button>

              {quoteAge >= 60 ? (
                <button
                  onClick={() => { setQuote(null); handleGetQuote(); }}
                  className="w-full text-center text-xs text-amber-500 hover:text-amber-400"
                >
                  Quote expired — click to refresh
                </button>
              ) : (
                <p className="text-center text-[11px] text-gray-400">
                  Quote valid for {60 - quoteAge}s
                </p>
              )}
            </>
          )}

          {/* Approving */}
          {step === "approving" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Spinner />
              <p className="text-sm text-gray-600">Approving token...</p>
              <p className="text-xs text-gray-400">Confirm in your wallet</p>
            </div>
          )}

          {/* Signing */}
          {step === "signing" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Spinner />
              <p className="text-sm text-gray-600">Confirm in your wallet...</p>
            </div>
          )}

          {/* Pending */}
          {step === "pending" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Spinner />
              <p className="text-sm text-gray-600">Confirming transaction...</p>
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
              <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center text-2xl text-emerald-500">
                &#x2713;
              </div>
              <p className="text-sm font-semibold text-gray-900">Deposit confirmed!</p>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-500 hover:text-violet-600 underline">
                  View on explorer
                </a>
              )}
              <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">
                Make another deposit
              </button>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <>
              <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="text-sm text-red-600">{error || "Something went wrong"}</p>
              </div>
              <button
                onClick={handleReset}
                className="w-full rounded-xl border border-gray-200 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Try again
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 text-[10px] text-gray-300 text-center">
          Powered by LI.FI Composer
        </div>
      </div>
    </div>
  );
}
