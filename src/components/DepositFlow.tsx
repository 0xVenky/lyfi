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
import { formatProtocolName } from "@/lib/utils";
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
  toAmountUSD: string | null;
  fromAmountUSD: string | null;
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
      <span style={{ color: "var(--on-surface-variant)" }}>{label}</span>
      <span className="text-right tabular-nums" style={{ color: "var(--on-surface)" }}>{value}</span>
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

  const wagmiConfig = useConfig();
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, reset: resetTx } = useSendTransaction();

  const [step, setStep] = useState<Step>("idle");
  const [fromChainId, setFromChainId] = useState<number>(vaultChainId);
  const [fromToken, setFromToken] = useState<CommonToken>(() =>
    getDefaultToken(vaultChainId, vaultChainId, underlyingToken),
  );
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();

  const isNativeFrom =
    fromToken.address.toLowerCase() === NATIVE_TOKEN_ADDRESS;
  const isCrossChain = fromChainId !== vaultChainId;

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

  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (step === "pending" && isConfirmed) setStep("confirmed");
  }, [step, isConfirmed]);

  useEffect(() => {
    if (autoOpen && isConnected && step === "idle") {
      const chain = walletChainId ?? vaultChainId;
      setFromChainId(chain);
      setFromToken(getDefaultToken(chain, vaultChainId, underlyingToken));
      setStep("input");
    }
  }, [autoOpen, isConnected, walletChainId, vaultChainId, underlyingToken, step]);

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
      setAmount(String(num - 0.01));
    } else {
      setAmount(selectedBalance.formatted);
    }
  };

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

      const gasCosts: { amountUSD?: string }[] =
        data.estimate?.gasCosts ?? [];
      const totalGasUSD = gasCosts.reduce(
        (sum: number, g: { amountUSD?: string }) =>
          sum + parseFloat(g.amountUSD ?? "0"),
        0,
      );

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
        toAmountUSD: data.estimate?.toAmountUSD ?? null,
        fromAmountUSD: data.estimate?.fromAmountUSD ?? null,
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

  const handleDeposit = useCallback(async () => {
    if (!quote || !address) return;

    try {
      if (walletChainId !== quote.txChainId) {
        setStep("signing");
        await switchChainAsync({ chainId: quote.txChainId });
      }

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

  if (!pool.is_transactional) {
    return pool.protocol_url ? (
      <a
        href={pool.protocol_url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90 shadow-lg shadow-purple-500/20"
        style={{ background: "linear-gradient(135deg, #630ed4, #7c3aed)" }}
      >
        Deposit on {pool.protocol} &rarr;
      </a>
    ) : (
      <span
        className="rounded-full px-6 py-3 text-sm font-medium cursor-not-allowed"
        style={{ backgroundColor: "var(--surface-container-high)", color: "var(--outline)" }}
      >
        Deposits not available
      </span>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={() => openConnectModal?.()}
        className="rounded-full px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90 shadow-lg shadow-purple-500/20"
        style={{ background: "linear-gradient(135deg, #630ed4, #7c3aed)" }}
      >
        Connect Wallet to Deposit
      </button>
    );
  }

  if (step === "idle") {
    return (
      <button
        onClick={handleStartDeposit}
        className="rounded-full px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90 shadow-lg shadow-purple-500/20"
        style={{ background: "linear-gradient(135deg, #630ed4, #7c3aed)" }}
      >
        Deposit via LI.FI
      </button>
    );
  }

  // ---- Expanded card for all other steps ----
  return (
    <div
      className="rounded-[2rem] p-5 w-full max-w-sm space-y-3"
      style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}
    >
      {/* -- Input / Quoting -- */}
      {(step === "input" || step === "quoting") && (
        <>
          <div className="text-sm font-bold font-[family-name:var(--font-manrope)]" style={{ color: "var(--on-surface)" }}>
            Zap into {pool.symbol}
          </div>

          {/* Chain selector */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 block" style={{ color: "var(--outline)" }}>
              From Chain
            </label>
            <ChainSelect
              selectedChainId={fromChainId}
              onChange={handleChainChange}
            />
          </div>

          {/* Amount + Token selector */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1 block" style={{ color: "var(--outline)" }}>
              Amount
            </label>
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
                className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-lg font-bold border-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 font-[family-name:var(--font-manrope)]"
                style={{ backgroundColor: "var(--surface-container-low)", color: "var(--on-surface)" }}
                autoFocus
              />
              <TokenSelect
                chainId={fromChainId}
                vaultUnderlyingTokens={pool.exposure.underlying_tokens}
                selected={fromToken}
                onSelect={handleTokenSelect}
              />
            </div>

            {selectedBalance && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs" style={{ color: "var(--outline)" }}>
                  Balance: {formatBalDisplay(selectedBalance.formatted)}{" "}
                  {fromToken.symbol}
                </span>
                <button
                  onClick={handleMax}
                  className="text-xs font-bold"
                  style={{ color: "var(--primary)" }}
                >
                  MAX
                </button>
              </div>
            )}
          </div>

          {isCrossChain && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#d97706" }}>
              <span>&#x26A1;</span>
              Cross-chain via LI.FI:{" "}
              {CHAIN_BY_ID[fromChainId]?.name} &rarr; {vaultChain?.name}
            </p>
          )}

          <button
            onClick={handleGetQuote}
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              step === "quoting"
            }
            className="w-full rounded-full py-3 text-sm font-bold text-white transition-all disabled:opacity-40"
            style={
              amount && parseFloat(amount) > 0 && step !== "quoting"
                ? { background: "linear-gradient(135deg, #630ed4, #7c3aed)", boxShadow: "0 4px 16px rgba(99, 14, 212, 0.2)" }
                : { backgroundColor: "var(--surface-container-high)", color: "var(--outline)" }
            }
          >
            {step === "quoting" ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Getting quote...
              </span>
            ) : (
              "Get Quote"
            )}
          </button>
        </>
      )}

      {/* -- Quoted -- */}
      {step === "quoted" && quote && (
        <>
          <div className="text-sm font-bold font-[family-name:var(--font-manrope)]" style={{ color: "var(--on-surface)" }}>Quote</div>
          <div className="space-y-2 rounded-2xl p-4 text-sm" style={{ backgroundColor: "var(--surface-container-low)" }}>
            <div className="flex items-center justify-between gap-2">
              <span style={{ color: "var(--on-surface-variant)" }}>You deposit</span>
              <div className="text-right">
                <span className="tabular-nums" style={{ color: "var(--on-surface)" }}>{amount} {fromToken.symbol}</span>
                {quote.fromAmountUSD && (
                  <span className="block text-xs tabular-nums" style={{ color: "var(--outline)" }}>~${parseFloat(quote.fromAmountUSD).toFixed(2)}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span style={{ color: "var(--on-surface-variant)" }}>You receive</span>
              <div className="text-right">
                <span className="tabular-nums font-semibold" style={{ color: "var(--on-surface)" }}>~{formatTokenAmount(quote.toAmount, quote.toTokenDecimals)} {quote.toTokenSymbol}</span>
                {quote.toAmountUSD && (
                  <span className="block text-xs tabular-nums" style={{ color: "var(--secondary)" }}>~${parseFloat(quote.toAmountUSD).toFixed(2)}</span>
                )}
              </div>
            </div>
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
            {pool.protocol_url && (
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: "var(--on-surface-variant)" }}>Vault</span>
                <a
                  href={pool.protocol_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{ color: "var(--primary)" }}
                >
                  View on {formatProtocolName(pool.protocol)} &#x2197;
                </a>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}
            >
              Edit
            </button>
            <button
              onClick={handleDeposit}
              className="flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--secondary)", boxShadow: "0 4px 16px rgba(0, 108, 81, 0.2)" }}
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
              className="w-full rounded-full px-4 py-2 text-xs font-medium"
              style={{ color: "#d97706", backgroundColor: "rgba(217, 119, 6, 0.08)" }}
            >
              Quote expired -- click to refresh
            </button>
          ) : (
            <p className="text-xs text-center" style={{ color: "var(--outline)" }}>
              Estimates based on current rates ({60 - quoteAge}s). Actual output
              may vary.
            </p>
          )}
        </>
      )}

      {/* -- Approving -- */}
      {step === "approving" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>Approving token...</p>
          <p className="text-xs" style={{ color: "var(--outline)" }}>
            Confirm the approval in your wallet
          </p>
        </div>
      )}

      {/* -- Signing -- */}
      {step === "signing" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>
            Confirm in your wallet...
          </p>
        </div>
      )}

      {/* -- Pending -- */}
      {step === "pending" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>
            Confirming transaction...
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
              style={{ color: "var(--primary)" }}
            >
              View on explorer
            </a>
          )}
        </div>
      )}

      {/* -- Confirmed -- */}
      {step === "confirmed" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full text-xl" style={{ backgroundColor: "var(--secondary-container)", color: "var(--on-secondary-container)" }}>
            &#x2713;
          </div>
          <p className="text-sm font-bold" style={{ color: "var(--on-surface)" }}>
            Deposit confirmed!
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
              style={{ color: "var(--primary)" }}
            >
              View on explorer
            </a>
          )}
          <button
            onClick={handleReset}
            className="mt-1 text-xs transition-colors hover:opacity-80"
            style={{ color: "var(--outline)" }}
          >
            Make another deposit
          </button>
        </div>
      )}

      {/* -- Error -- */}
      {step === "error" && (
        <>
          <div className="rounded-2xl p-3" style={{ backgroundColor: "var(--error-container)" }}>
            <p className="text-sm" style={{ color: "var(--error)" }}>
              {error || "Something went wrong"}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded-full px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
