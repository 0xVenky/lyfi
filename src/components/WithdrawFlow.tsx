"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import {
  parseUnits,
  formatUnits,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  type Hex,
} from "viem";
import { CHAIN_BY_ID } from "@/lib/constants";
import type { Position } from "./PositionCard";

type Step =
  | "input"
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
  txTo: string;
  txData: string;
  txValue: string;
  txChainId: number;
  txGasLimit?: string;
  approvalAddress?: string;
};

function formatTokenAmount(raw: string, decimals: number): string {
  const val = formatUnits(BigInt(raw), decimals);
  const num = parseFloat(val);
  if (num >= 1000)
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(4);
  if (num === 0) return "0";
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

/**
 * WithdrawFlow — reverse of DepositFlow.
 * fromToken = vault address (shares), toToken = underlying token.
 * Always same-chain (withdraw on the vault's chain).
 */
export function WithdrawFlow({
  position,
  onDone,
}: {
  position: Position;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<Step>("input");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();

  const wagmiConfig = useConfig();
  const { address, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, reset: resetTx } = useSendTransaction();

  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const vaultChainId = position.chainId;
  const vaultAddress = position.asset.address;
  const vaultDecimals = position.asset.decimals;
  const vaultChain = CHAIN_BY_ID[vaultChainId];

  // Withdraw toToken: use underlying token if available, otherwise native
  const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
  const withdrawToToken = position.underlyingTokenAddress ?? NATIVE_TOKEN;

  const explorerBase = vaultChain?.explorer;
  const explorerUrl =
    txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : null;

  useEffect(() => {
    if (step === "pending" && isConfirmed) {
      setStep("confirmed");
    }
  }, [step, isConfirmed]);

  const handleMax = () => {
    setAmount(String(position.balanceNative));
  };

  const handleGetQuote = useCallback(async () => {
    if (!address || !amount) return;

    setStep("quoting");
    setError(null);

    try {
      const fromAmount = parseUnits(amount, vaultDecimals).toString();

      const params = new URLSearchParams({
        fromChain: String(vaultChainId),
        toChain: String(vaultChainId),
        fromToken: vaultAddress,
        toToken: withdrawToToken,
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
        (sum, g) => sum + parseFloat(g.amountUSD ?? "0"),
        0,
      );

      setQuote({
        toAmount: data.estimate.toAmount,
        toAmountMin: data.estimate.toAmountMin,
        toTokenDecimals: data.action?.toToken?.decimals ?? 18,
        toTokenSymbol: data.action?.toToken?.symbol ?? position.asset.symbol,
        gasCostUSD: totalGasUSD.toFixed(2),
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
  }, [address, amount, vaultDecimals, vaultChainId, vaultAddress, position.asset.symbol]);

  const handleWithdraw = useCallback(async () => {
    if (!quote || !address) return;

    try {
      // Switch chain if needed
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
          to: vaultAddress as Hex,
          data: approveData,
          value: BigInt(0),
        });
        await waitForTransactionReceipt(wagmiConfig, {
          hash: approveHash,
        });
      }

      // Send withdraw tx
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
    vaultAddress,
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

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/80 p-4 w-full max-w-sm space-y-3">
      {/* Input */}
      {(step === "input" || step === "quoting") && (
        <>
          <div className="text-sm text-zinc-400">
            Withdraw from {position.asset.name} on {vaultChain?.name}
          </div>

          <div className="relative">
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
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 pr-24 text-zinc-100 text-lg placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              autoFocus
            />
            <button
              onClick={handleMax}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              MAX
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Balance: {position.balanceNative.toFixed(position.balanceNative >= 1 ? 4 : 6)}{" "}
            {position.asset.symbol} (~${position.balanceUsd.toFixed(2)})
          </p>

          <button
            onClick={handleGetQuote}
            disabled={!amount || parseFloat(amount) <= 0 || step === "quoting"}
            className="w-full rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 px-4 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {step === "quoting" ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Getting quote&hellip;
              </span>
            ) : (
              "Get Withdraw Quote"
            )}
          </button>
        </>
      )}

      {/* Quoted */}
      {step === "quoted" && quote && (
        <>
          <div className="text-sm font-medium text-zinc-300">
            Withdraw Quote
          </div>
          <div className="space-y-2 rounded-lg bg-zinc-800/50 p-3 text-sm">
            <Row
              label="You withdraw"
              value={`${amount} ${position.asset.symbol}`}
            />
            <Row
              label="You receive"
              value={`~${formatTokenAmount(quote.toAmount, quote.toTokenDecimals)} ${quote.toTokenSymbol}`}
            />
            <Row
              label="Minimum"
              value={`~${formatTokenAmount(quote.toAmountMin, quote.toTokenDecimals)} ${quote.toTokenSymbol}`}
            />
            <Row label="Gas cost" value={`~$${quote.gasCostUSD}`} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleWithdraw}
              className="flex-1 rounded-lg bg-red-600/80 hover:bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              Confirm Withdraw
            </button>
          </div>

          <p className="text-xs text-zinc-600 text-center">
            Estimates based on current rates. Actual output may vary.
          </p>
        </>
      )}

      {/* Approving */}
      {step === "approving" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-300">Approving vault shares&hellip;</p>
          <p className="text-xs text-zinc-500">Confirm in your wallet</p>
        </div>
      )}

      {/* Signing */}
      {step === "signing" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-300">Confirm in your wallet&hellip;</p>
        </div>
      )}

      {/* Pending */}
      {step === "pending" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm text-zinc-300">Confirming withdrawal&hellip;</p>
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

      {/* Confirmed */}
      {step === "confirmed" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-400">
            &#x2713;
          </div>
          <p className="text-sm font-medium text-zinc-200">
            Withdrawal confirmed!
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
          {onDone && (
            <button
              onClick={onDone}
              className="mt-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Back to portfolio
            </button>
          )}
        </div>
      )}

      {/* Error */}
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
