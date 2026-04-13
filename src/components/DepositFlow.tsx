"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
import {
  CHAIN_BY_ID,
  NATIVE_TOKEN_ADDRESS,
  NATIVE_TOKENS,
  type CommonToken,
} from "@/lib/constants";
import { ChainSelect } from "./ChainSelect";
import { TokenSelect, type SelectedToken } from "./TokenSelect";
import type { PoolDetail } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step =
  | "idle"
  | "input"
  | "quoting"
  | "quoted"
  | "approving"
  | "signing"
  | "pending"
  | "confirmed"
  | "error";

type RouteStep = {
  type: string;
  fromSymbol: string;
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

function getDefaultToken(
  fromChain: number,
  vaultChain: number,
  underlyingToken?: { address: string; symbol: string; decimals: number },
): CommonToken {
  if (fromChain === vaultChain && underlyingToken) {
    return {
      address: underlyingToken.address,
      symbol: underlyingToken.symbol,
      decimals: underlyingToken.decimals,
    };
  }
  return (
    NATIVE_TOKENS[fromChain] ?? {
      address: NATIVE_TOKEN_ADDRESS,
      symbol: "ETH",
      decimals: 18,
    }
  );
}

function formatTokenAmount(raw: string, decimals: number): string {
  const val = formatUnits(BigInt(raw), decimals);
  const num = parseFloat(val);
  if (num >= 1000)
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  if (num === 0) return "0";
  return num.toPrecision(4);
}

function formatBalDisplay(val: string): string {
  const num = parseFloat(val);
  if (num === 0) return "0";
  if (num >= 1000)
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  return num.toPrecision(4);
}

function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const px = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={`${px} inline-block animate-spin rounded-full border-2 border-current border-t-transparent`}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 text-right">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepositFlow({
  pool,
  autoOpen = false,
}: {
  pool: PoolDetail;
  autoOpen?: boolean;
}) {
  const vaultChainId = pool.vault_chain_id;
  const vaultChain = CHAIN_BY_ID[vaultChainId];
  const underlyingToken = pool.exposure.underlying_tokens[0];

  // ---- Wagmi hooks ----
  const wagmiConfig = useConfig();
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, reset: resetTx } = useSendTransaction();

  // ---- State ----
  const [step, setStep] = useState<Step>("idle");
  const [fromChainId, setFromChainId] = useState<number>(vaultChainId);
  const [fromToken, setFromToken] = useState<CommonToken>(() =>
    getDefaultToken(vaultChainId, vaultChainId, underlyingToken),
  );
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();

  // ---- Derived ----
  const isNativeFrom =
    fromToken.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;
  const isCrossChain = fromChainId !== vaultChainId;

  // ---- Balance for selected token ----
  const { data: nativeBal } = useBalance({
    address,
    chainId: fromChainId,
  });

  const { data: erc20BalRaw } = useReadContract({
    address: fromToken.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: fromChainId,
    query: { enabled: !isNativeFrom && !!address },
  });

  const selectedBalance = useMemo(() => {
    if (isNativeFrom && nativeBal) {
      return {
        value: nativeBal.value,
        formatted: formatUnits(nativeBal.value, nativeBal.decimals),
      };
    }
    if (!isNativeFrom && erc20BalRaw !== undefined) {
      const raw = erc20BalRaw as bigint;
      return { value: raw, formatted: formatUnits(raw, fromToken.decimals) };
    }
    return undefined;
  }, [isNativeFrom, nativeBal, erc20BalRaw, fromToken.decimals]);

  // ---- Tx confirmation ----
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (step === "pending" && isConfirmed) setStep("confirmed");
  }, [step, isConfirmed]);

  // ---- Auto-open when arriving from Zap link ----
  useEffect(() => {
    if (autoOpen && isConnected && step === "idle") {
      const chain = walletChainId ?? vaultChainId;
      setFromChainId(chain);
      setFromToken(getDefaultToken(chain, vaultChainId, underlyingToken));
      setStep("input");
    }
  }, [autoOpen, isConnected, walletChainId, vaultChainId, underlyingToken, step]);

  // ---- Quote expiry (60s) ----
  const [quoteAge, setQuoteAge] = useState(0);
  const quoteExpired = quoteAge >= 60;
  useEffect(() => {
    if (step !== "quoted") {
      setQuoteAge(0);
      return;
    }
    const interval = setInterval(() => setQuoteAge((a) => a + 1), 1000);
    return () => clearInterval(interval);
  }, [step]);

  // ---- Explorer link ----
  const explorerBase = CHAIN_BY_ID[fromChainId]?.explorer;
  const explorerUrl =
    txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : null;

  // ========================================================================
  // Handlers
  // ========================================================================

  const handleStartDeposit = () => {
    const chain = walletChainId ?? vaultChainId;
    setFromChainId(chain);
    setFromToken(getDefaultToken(chain, vaultChainId, underlyingToken));
    setStep("input");
  };

  const handleChainChange = (newChainId: number) => {
    setFromChainId(newChainId);
    setFromToken(getDefaultToken(newChainId, vaultChainId, underlyingToken));
    setQuote(null);
    setAmount("");
  };

  const handleTokenSelect = (token: SelectedToken) => {
    setFromToken(token);
    setQuote(null);
  };

  const handleMax = () => {
    if (!selectedBalance) return;
    const num = parseFloat(selectedBalance.formatted);
    if (isNativeFrom && num > 0.01) {
      // Leave gas buffer for native tokens
      setAmount(String(num - 0.01));
    } else {
      setAmount(selectedBalance.formatted);
    }
  };

  // ---- Get quote ----
  const handleGetQuote = useCallback(async () => {
    if (!address || !amount || !fromToken.address) return;

    setStep("quoting");
    setError(null);

    try {
      const fromAmount = parseUnits(amount, fromToken.decimals).toString();
      const params = new URLSearchParams({
        fromChain: String(fromChainId),
        toChain: String(vaultChainId),
        fromToken: fromToken.address,
        toToken: pool.vault_address,
        fromAddress: address,
        fromAmount,
      });

      const res = await fetch(`/api/v1/quote?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Quote failed (${res.status})`);
      }

      // Parse gas costs
      const gasCosts: { amountUSD?: string }[] =
        data.estimate?.gasCosts ?? [];
      const totalGasUSD = gasCosts.reduce(
        (sum: number, g: { amountUSD?: string }) =>
          sum + parseFloat(g.amountUSD ?? "0"),
        0,
      );

      // Parse route steps from includedSteps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const routeSteps: RouteStep[] = (data.includedSteps ?? []).map(
        (s: any) => ({
          type: s.type ?? "step",
          fromSymbol: s.action?.fromToken?.symbol ?? "?",
          toSymbol: s.action?.toToken?.symbol ?? "?",
          toolName: s.toolDetails?.name,
        }),
      );

      setQuote({
        toAmount: data.estimate.toAmount,
        toAmountMin: data.estimate.toAmountMin,
        toTokenDecimals: data.action?.toToken?.decimals ?? 18,
        toTokenSymbol: data.action?.toToken?.symbol ?? "shares",
        gasCostUSD: totalGasUSD.toFixed(2),
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
  }, [address, amount, fromToken, fromChainId, vaultChainId, pool.vault_address]);

  // ---- Execute deposit ----
  const handleDeposit = useCallback(async () => {
    if (!quote || !address) return;

    try {
      // Switch chain if wallet is on wrong chain
      if (walletChainId !== quote.txChainId) {
        setStep("signing");
        await switchChainAsync({ chainId: quote.txChainId });
      }

      // Approve ERC20 if needed (native tokens don't need approval)
      const needsApproval =
        !isNativeFrom && !!quote.approvalAddress;
      if (needsApproval) {
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
      if (
        msg.includes("rejected") ||
        msg.includes("denied") ||
        msg.includes("User rejected")
      ) {
        setStep("quoted");
        return;
      }
      setError(msg);
      setStep("error");
    }
  }, [
    quote,
    address,
    fromToken,
    isNativeFrom,
    walletChainId,
    switchChainAsync,
    sendTransactionAsync,
    wagmiConfig,
  ]);

  const handleReset = () => {
    setStep("input");
    setAmount("");
    setQuote(null);
    setTxHash(undefined);
    setError(null);
    resetTx();
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  // Not transactional — link to protocol
  if (!pool.is_transactional) {
    return pool.protocol_url ? (
      <a
        href={pool.protocol_url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition-colors text-center sm:text-left"
      >
        Deposit on {pool.protocol} &rarr;
      </a>
    ) : (
      <span className="rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-500 cursor-not-allowed">
        Deposits not available
      </span>
    );
  }

  // Wallet not connected
  if (!isConnected) {
    return (
      <button
        onClick={() => openConnectModal?.()}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition-colors"
      >
        Connect Wallet to Deposit
      </button>
    );
  }

  // Idle — single CTA
  if (step === "idle") {
    return (
      <button
        onClick={handleStartDeposit}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white transition-colors"
      >
        Deposit via LI.FI
      </button>
    );
  }

  // ---- Expanded card for all other steps ----
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/80 p-4 w-full max-w-sm space-y-3">
      {/* ── Input / Quoting ── */}
      {(step === "input" || step === "quoting") && (
        <>
          <div className="text-sm font-medium text-zinc-300">
            Zap into {pool.symbol}
          </div>

          {/* Chain selector */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">
              From Chain
            </label>
            <ChainSelect
              selectedChainId={fromChainId}
              onChange={handleChainChange}
            />
          </div>

          {/* Amount + Token selector */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Amount</label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(e) => {
                  if (/^\d*\.?\d*$/.test(e.target.value))
                    setAmount(e.target.value);
                }}
                disabled={step === "quoting"}
                className="flex-1 min-w-0 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-zinc-100 text-lg placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                autoFocus
              />
              <TokenSelect
                chainId={fromChainId}
                vaultUnderlyingTokens={pool.exposure.underlying_tokens}
                selected={fromToken}
                onSelect={handleTokenSelect}
              />
            </div>

            {/* Balance + MAX */}
            {selectedBalance && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-zinc-500">
                  Balance: {formatBalDisplay(selectedBalance.formatted)}{" "}
                  {fromToken.symbol}
                </span>
                <button
                  onClick={handleMax}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  MAX
                </button>
              </div>
            )}
          </div>

          {/* Cross-chain indicator */}
          {isCrossChain && (
            <p className="text-xs text-amber-400/80 flex items-center gap-1">
              <span>&#x26A1;</span>
              Cross-chain via LI.FI:{" "}
              {CHAIN_BY_ID[fromChainId]?.name} &rarr; {vaultChain?.name}
            </p>
          )}

          {/* Get Quote */}
          <button
            onClick={handleGetQuote}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              step === "quoting"
            }
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {step === "quoting" ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Getting quote&hellip;
              </span>
            ) : (
              "Get Quote"
            )}
          </button>
        </>
      )}

      {/* ── Quoted ── */}
      {step === "quoted" && quote && (
        <>
          <div className="text-sm font-medium text-zinc-300">Quote</div>
          <div className="space-y-2 rounded-lg bg-zinc-800/50 p-3 text-sm">
            <Row
              label="You deposit"
              value={`${amount} ${fromToken.symbol}`}
            />

            {/* Route steps */}
            {quote.routeSteps.length > 0 && (
              <div className="py-1 space-y-0.5">
                <span className="text-zinc-500 text-xs">Route</span>
                <div className="flex items-center gap-1 text-xs flex-wrap">
                  <span className="text-zinc-300">{fromToken.symbol}</span>
                  {quote.routeSteps.map((s, i) => (
                    <span key={i} className="contents">
                      <span className="text-zinc-600">&rarr;</span>
                      <span className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-zinc-400">
                        {s.type === "swap"
                          ? "Swap"
                          : s.type === "cross"
                            ? "Bridge"
                            : s.type}
                        {s.toolName && (
                          <span className="text-zinc-500">
                            {" "}
                            ({s.toolName})
                          </span>
                        )}
                      </span>
                      <span className="text-zinc-600">&rarr;</span>
                      <span className="text-zinc-300">{s.toSymbol}</span>
                    </span>
                  ))}
                  <span className="text-zinc-600">&rarr;</span>
                  <span className="text-emerald-400 font-medium">Vault</span>
                </div>
              </div>
            )}

            <Row
              label="You receive"
              value={`~${formatTokenAmount(quote.toAmount, quote.toTokenDecimals)} ${quote.toTokenSymbol}`}
            />
            <Row
              label="Minimum"
              value={`~${formatTokenAmount(quote.toAmountMin, quote.toTokenDecimals)} ${quote.toTokenSymbol}`}
            />
            <Row label="Gas cost" value={`~$${quote.gasCostUSD}`} />
            {quote.executionTime != null && quote.executionTime > 0 && (
              <Row
                label="Est. time"
                value={
                  quote.executionTime < 60
                    ? `~${quote.executionTime}s`
                    : `~${Math.ceil(quote.executionTime / 60)} min`
                }
              />
            )}
            {isCrossChain && (
              <Row
                label="Route"
                value={`${CHAIN_BY_ID[fromChainId]?.name} \u2192 ${vaultChain?.name}`}
              />
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDeposit}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              Confirm Deposit
            </button>
          </div>

          {quoteExpired ? (
            <button
              onClick={() => {
                setQuote(null);
                handleGetQuote();
              }}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              Quote expired &mdash; click to refresh
            </button>
          ) : (
            <p className="text-xs text-zinc-600 text-center">
              Estimates based on current rates ({60 - quoteAge}s). Actual output
              may vary.
            </p>
          )}
        </>
      )}

      {/* ── Approving ── */}
      {step === "approving" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-300">Approving token&hellip;</p>
          <p className="text-xs text-zinc-500">
            Confirm the approval in your wallet
          </p>
        </div>
      )}

      {/* ── Signing ── */}
      {step === "signing" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-300">
            Confirm in your wallet&hellip;
          </p>
        </div>
      )}

      {/* ── Pending ── */}
      {step === "pending" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-300">
            Confirming transaction&hellip;
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              View on explorer
            </a>
          )}
        </div>
      )}

      {/* ── Confirmed ── */}
      {step === "confirmed" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-400">
            &#x2713;
          </div>
          <p className="text-sm font-medium text-zinc-200">
            Deposit confirmed!
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              View on explorer
            </a>
          )}
          <button
            onClick={handleReset}
            className="mt-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Make another deposit
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {step === "error" && (
        <>
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">
              {error || "Something went wrong"}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
