"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  formatUnits,
  parseUnits,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  type Hex,
} from "viem";
import { useHealthFactor, type AaveAccountData } from "@/hooks/useHealthFactor";
import { useAaveDebt, type DebtPosition } from "@/hooks/useAaveDebt";
import { ChainDot } from "@/components/ChainDot";
import { AAVE_V3_POOL, AAVE_POOL_ABI, CHAIN_BY_ID } from "@/lib/constants";
import type { VaultOption } from "@/components/VaultSelect";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserVaultPosition = VaultOption & {
  balanceUsd: number;
  balanceNative: number;
};

type RescueStep =
  | "idle"
  | "select_vault"
  | "quoting"
  | "quoted"
  | "withdrawing"
  | "bridging"
  | "approving_repay"
  | "repaying"
  | "confirmed"
  | "error";

type WithdrawQuote = {
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

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n > 0) return `$${n.toPrecision(3)}`;
  return "$0";
}

function fmtHf(hf: number): string {
  if (hf === Infinity || hf > 99) return "Safe";
  return hf.toFixed(3);
}

function hfColor(hf: number): string {
  if (hf === Infinity || hf > 2) return "var(--secondary)";
  if (hf >= 1.2) return "#d97706"; // amber
  return "var(--error)"; // red
}

function Spinner() {
  return (
    <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

// ---------------------------------------------------------------------------
// Rescue Page
// ---------------------------------------------------------------------------

export default function RescuePage() {
  const wagmiConfig = useConfig();
  const { address, chainId: walletChainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const { accounts, hasRisk, isLoading: hfLoading, refetch: refetchHf } = useHealthFactor();
  const { debts, isLoading: debtLoading } = useAaveDebt();

  // Rescue flow state
  const [step, setStep] = useState<RescueStep>("idle");
  const [targetAccount, setTargetAccount] = useState<AaveAccountData | null>(null);
  const [targetDebt, setTargetDebt] = useState<DebtPosition | null>(null);
  const [selectedVault, setSelectedVault] = useState<VaultOption | null>(null);
  const [withdrawQuote, setWithdrawQuote] = useState<WithdrawQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [repayTxHash, setRepayTxHash] = useState<Hex | undefined>();

  // User vault positions
  const [userVaults, setUserVaults] = useState<UserVaultPosition[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);

  // Fetch user vault positions
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoadingVaults(true);

    Promise.all([
      fetch(`/api/v1/portfolio/${address}`).then((r) => r.ok ? r.json() : { positions: [] }),
      fetch("/api/v1/pools?limit=2000").then((r) => r.ok ? r.json() : { data: [] }),
    ])
      .then(([posData, poolsData]) => {
        if (cancelled) return;
        type RawPos = { chainId: number; protocolName: string; asset: { address: string; symbol: string; decimals: number }; balanceUsd: string; balanceNative: string };
        const positions: RawPos[] = posData.positions ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pools = (poolsData.data ?? []) as any[];

        const activePositions = positions.filter((p) => parseFloat(p.balanceUsd) > 0.01);

        // For each position, find ONE best-matching pool (not all)
        const matched: UserVaultPosition[] = [];
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
            balanceUsd: parseFloat(pos.balanceUsd) || 0,
            balanceNative: parseFloat(pos.balanceNative) || 0,
          });
        }

        setUserVaults(matched);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingVaults(false); });

    return () => { cancelled = true; };
  }, [address]);

  // Tx confirmation for withdraw
  const { isSuccess: withdrawConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  // Tx confirmation for repay
  const { isSuccess: repayConfirmed } = useWaitForTransactionReceipt({ hash: repayTxHash });

  useEffect(() => {
    if (step === "withdrawing" && withdrawConfirmed) {
      // If same-chain, go to approve+repay. If cross-chain, wait for bridge.
      if (targetAccount && selectedVault && selectedVault.chainId !== targetAccount.chainId) {
        setStep("bridging");
      } else {
        setStep("approving_repay");
        doRepay();
      }
    }
  }, [step, withdrawConfirmed]);

  useEffect(() => {
    if (step === "repaying" && repayConfirmed) {
      setStep("confirmed");
      refetchHf();
    }
  }, [step, repayConfirmed]);

  // --- Rescue action: start ---
  const startRescue = (account: AaveAccountData) => {
    setTargetAccount(account);
    // Find the largest debt on this chain
    const chainDebts = debts.filter((d) => d.chainId === account.chainId);
    setTargetDebt(chainDebts[0] ?? null);
    setStep("select_vault");
    setError(null);
    setTxHash(undefined);
    setRepayTxHash(undefined);
    setWithdrawQuote(null);
  };

  // --- Get withdraw quote ---
  const getWithdrawQuote = useCallback(async (vault: VaultOption) => {
    if (!address || !targetAccount || !targetDebt) return;
    setSelectedVault(vault);
    setStep("quoting");
    setError(null);

    try {
      // Withdraw full vault balance — get shares balance first
      const balRes = await fetch(`/api/v1/portfolio/${address}`);
      const balData = await balRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pos = (balData.positions ?? []).find((p: any) =>
        p.protocolName === vault.protocol &&
        p.chainId === vault.chainId,
      );
      if (!pos) throw new Error("Could not find vault position");

      const decimals = vault.underlying_tokens[0]?.decimals ?? 18;
      const fromAmount = parseUnits(pos.balanceNative, decimals).toString();

      const params = new URLSearchParams({
        fromChain: String(vault.chainId),
        toChain: String(targetAccount.chainId),
        fromToken: vault.address,
        toToken: targetDebt.asset,
        fromAddress: address,
        fromAmount,
      });

      const res = await fetch(`/api/v1/quote?${params}`);
      const data = await res.json();
      if (!res.ok) {
        // Extract a clean message from LI.FI Composer errors
        const raw = data.error ?? data.message ?? "";
        let msg = typeof raw === "string" ? raw : JSON.stringify(raw);
        if (msg.includes("No available quotes")) msg = "No withdrawal route available for this vault. Try withdrawing directly on the protocol's site.";
        else if (msg.length > 120) msg = msg.slice(0, 120) + "...";
        throw new Error(msg || `Quote failed (${res.status})`);
      }

      const gasCosts: { amountUSD?: string }[] = data.estimate?.gasCosts ?? [];
      const totalGas = gasCosts.reduce((s: number, g: { amountUSD?: string }) => s + parseFloat(g.amountUSD ?? "0"), 0);

      setWithdrawQuote({
        toAmount: data.estimate.toAmount,
        toAmountMin: data.estimate.toAmountMin,
        toTokenDecimals: data.action?.toToken?.decimals ?? decimals,
        toTokenSymbol: data.action?.toToken?.symbol ?? targetDebt.symbol,
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
  }, [address, targetAccount, targetDebt]);

  // --- Execute withdraw tx ---
  const executeWithdraw = useCallback(async () => {
    if (!withdrawQuote || !address || !selectedVault) return;
    try {
      // Switch chain if needed
      if (walletChainId !== withdrawQuote.txChainId) {
        await switchChainAsync({ chainId: withdrawQuote.txChainId });
      }
      // Approve vault shares if needed
      if (withdrawQuote.approvalAddress) {
        setStep("withdrawing");
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [withdrawQuote.approvalAddress as Hex, maxUint256],
        });
        const approveHash = await sendTransactionAsync({
          to: selectedVault.address as Hex,
          data: approveData,
          value: BigInt(0),
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      setStep("withdrawing");
      const hash = await sendTransactionAsync({
        to: withdrawQuote.txTo as Hex,
        data: withdrawQuote.txData as Hex,
        value: BigInt(withdrawQuote.txValue),
        ...(withdrawQuote.txGasLimit ? { gas: BigInt(withdrawQuote.txGasLimit) } : {}),
      });
      setTxHash(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      if (msg.includes("rejected") || msg.includes("denied")) {
        setStep("quoted");
        return;
      }
      setError(msg);
      setStep("error");
    }
  }, [withdrawQuote, address, selectedVault, walletChainId, switchChainAsync, sendTransactionAsync, wagmiConfig]);

  // --- Execute repay tx ---
  const doRepay = useCallback(async () => {
    if (!address || !targetAccount || !targetDebt) return;
    try {
      const poolAddr = AAVE_V3_POOL[targetAccount.chainId];
      if (!poolAddr) throw new Error("No Aave pool for this chain");

      // Switch to repay chain
      if (walletChainId !== targetAccount.chainId) {
        await switchChainAsync({ chainId: targetAccount.chainId });
      }

      // Approve repay token for Aave Pool
      setStep("approving_repay");
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [poolAddr as Hex, maxUint256],
      });
      const approveHash = await sendTransactionAsync({
        to: targetDebt.asset as Hex,
        data: approveData,
        value: BigInt(0),
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

      // Repay — use type(uint256).max to repay full debt
      setStep("repaying");
      const repayData = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "repay",
        args: [
          targetDebt.asset as Hex,
          maxUint256, // repay max available
          BigInt(2), // variable rate mode
          address,
        ],
      });
      const repayHash = await sendTransactionAsync({
        to: poolAddr as Hex,
        data: repayData,
        value: BigInt(0),
      });
      setRepayTxHash(repayHash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Repay failed";
      if (msg.includes("rejected") || msg.includes("denied")) {
        setStep("quoted");
        return;
      }
      setError(msg);
      setStep("error");
    }
  }, [address, targetAccount, targetDebt, walletChainId, switchChainAsync, sendTransactionAsync, wagmiConfig]);

  // --- Bridge polling: check if repay token arrived on dest chain ---
  useEffect(() => {
    if (step !== "bridging" || !targetAccount || !targetDebt || !address) return;
    // Poll every 5s for token balance on repay chain
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/balances/${address}`);
        if (!res.ok) return;
        const data = await res.json();
        const chain = (data.chains ?? []).find((c: { chainId: number }) => c.chainId === targetAccount.chainId);
        if (!chain) return;
        const token = chain.tokens.find(
          (t: { address: string }) => t.address.toLowerCase() === targetDebt.asset.toLowerCase(),
        );
        if (token && parseFloat(token.balance) > 0) {
          clearInterval(iv);
          doRepay();
        }
      } catch { /* keep polling */ }
    }, 5000);
    return () => clearInterval(iv);
  }, [step, targetAccount, targetDebt, address, doRepay]);

  const handleReset = () => {
    setStep("idle");
    setTargetAccount(null);
    setTargetDebt(null);
    setSelectedVault(null);
    setWithdrawQuote(null);
    setError(null);
    setTxHash(undefined);
    setRepayTxHash(undefined);
  };

  const repayExplorerUrl = useMemo(() => {
    if (!repayTxHash || !targetAccount) return null;
    return `${CHAIN_BY_ID[targetAccount.chainId]?.explorer}/tx/${repayTxHash}`;
  }, [repayTxHash, targetAccount]);

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1
          className="text-2xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]"
          style={{ color: "var(--on-surface)" }}
        >
          Rescue
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-variant)" }}>
          Monitor your Aave V3 health factor. One-click withdraw &amp; repay when liquidation is near.
        </p>
      </div>

      {/* Connect wallet */}
      {!isConnected && (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <p className="text-sm mb-4" style={{ color: "var(--outline)" }}>
            Connect your wallet to monitor health factor
          </p>
          <button
            onClick={() => openConnectModal?.()}
            className="rounded-full px-6 py-3 text-sm font-bold text-white hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #630ed4, #7c3aed)" }}
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Loading */}
      {isConnected && (hfLoading || debtLoading) && (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <Spinner />
          <p className="text-sm mt-3" style={{ color: "var(--outline)" }}>
            Reading Aave V3 positions across chains...
          </p>
        </div>
      )}

      {/* No positions */}
      {isConnected && !hfLoading && accounts.length === 0 && (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <p className="text-sm" style={{ color: "var(--outline)" }}>
            No Aave V3 positions found on Ethereum, Base, or Arbitrum
          </p>
        </div>
      )}

      {/* === TWO-COLUMN DASHBOARD === */}
      {isConnected && !hfLoading && accounts.length > 0 && step === "idle" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── LEFT: Lending Positions ── */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}>
              <h2
                className="text-xs font-bold uppercase tracking-[0.2em] mb-4 font-[family-name:var(--font-manrope)]"
                style={{ color: "var(--on-surface-variant)" }}
              >
                Lending Positions
              </h2>

              <div className="space-y-4">
                {accounts.map((a) => {
                  const chainDebts = debts.filter((d) => d.chainId === a.chainId);
                  const chainInfo = CHAIN_BY_ID[a.chainId];
                  return (
                    <div key={a.chainId} className="space-y-3">
                      {/* Chain header + health factor */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChainDot chain={chainInfo?.network ?? "ethereum"} />
                          <span className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>
                            {a.chainName}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}>
                            Aave V3
                          </span>
                        </div>
                        {a.isAtRisk && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--error-container)", color: "var(--error)" }}>
                            Risk
                          </span>
                        )}
                      </div>

                      {/* Health factor */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold tabular-nums" style={{ color: hfColor(a.healthFactor) }}>
                          {fmtHf(a.healthFactor)}
                        </span>
                        <span className="text-xs" style={{ color: "var(--outline)" }}>Health Factor</span>
                      </div>

                      {/* Collateral / Debt */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs" style={{ color: "var(--outline)" }}>Collateral</div>
                          <div className="font-semibold tabular-nums" style={{ color: "var(--on-surface)" }}>
                            {fmtUsd(a.totalCollateralUsd)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs" style={{ color: "var(--outline)" }}>Debt</div>
                          <div className="font-semibold tabular-nums" style={{ color: "var(--on-surface)" }}>
                            {fmtUsd(a.totalDebtUsd)}
                          </div>
                        </div>
                      </div>

                      {/* Per-asset debt with borrow rate */}
                      {chainDebts.length > 0 && (
                        <div className="space-y-1.5">
                          {chainDebts.map((d) => (
                            <div
                              key={d.asset}
                              className="flex items-center justify-between rounded-xl px-3 py-2"
                              style={{ backgroundColor: "var(--surface-container-low)" }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: "var(--on-surface)" }}>
                                  {d.symbol}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--error-container)", color: "var(--error)" }}>
                                  Borrowing
                                </span>
                              </div>
                              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--error)" }}>
                                {d.borrowApr !== null ? `${d.borrowApr.toFixed(2)}% APR` : "—"}
                              </span>
                            </div>
                          ))}
                          <p className="text-[10px] mt-1" style={{ color: "var(--outline)" }}>
                            You pay this rate on your borrowed amount
                          </p>
                        </div>
                      )}

                      {/* Rescue button */}
                      {a.totalDebtUsd > 0 && (
                        <div className="pt-1">
                          {a.isAtRisk ? (
                            <button
                              onClick={() => startRescue(a)}
                              className="w-full rounded-full px-5 py-2.5 text-sm font-bold text-white animate-pulse hover:animate-none hover:opacity-90 transition-all"
                              style={{ backgroundColor: "var(--error)" }}
                            >
                              Rescue — Withdraw &amp; Repay
                            </button>
                          ) : (
                            <button
                              onClick={() => startRescue(a)}
                              className="w-full rounded-full px-5 py-2.5 text-xs font-semibold transition-colors hover:opacity-80"
                              style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}
                            >
                              Repay debt
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT: Vault Earning Positions ── */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}>
              <h2
                className="text-xs font-bold uppercase tracking-[0.2em] mb-4 font-[family-name:var(--font-manrope)]"
                style={{ color: "var(--on-surface-variant)" }}
              >
                Vault Earnings
              </h2>

              {loadingVaults && (
                <div className="py-8 text-center text-sm" style={{ color: "var(--outline)" }}>
                  <Spinner /> Loading positions...
                </div>
              )}

              {!loadingVaults && userVaults.length === 0 && (
                <div className="py-8 text-center text-sm" style={{ color: "var(--outline)" }}>
                  No vault positions found
                </div>
              )}

              {!loadingVaults && userVaults.length > 0 && (
                <div className="space-y-2">
                  {userVaults.map((v) => {
                    const chainInfo = CHAIN_BY_ID[v.chainId];
                    const canWithdraw = v.isRedeemable !== false;
                    return (
                      <div
                        key={v.id}
                        className="rounded-xl px-3 py-3 space-y-2"
                        style={{ backgroundColor: "var(--surface-container-low)" }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <ChainDot chain={chainInfo?.network ?? v.chain} />
                            <div className="min-w-0">
                              <span className="text-sm font-semibold block truncate" style={{ color: "var(--on-surface)" }}>
                                {v.symbol}
                              </span>
                              <span className="text-xs" style={{ color: "var(--outline)" }}>
                                {v.protocol}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--secondary)" }}>
                              {v.apr.toFixed(2)}%
                            </span>
                            <span className="text-[10px] block" style={{ color: "var(--outline)" }}>APY earned</span>
                          </div>
                        </div>

                        {/* Balance + withdraw status */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="tabular-nums font-medium" style={{ color: "var(--on-surface)" }}>
                            {fmtUsd(v.balanceUsd)}
                            <span className="ml-1 font-normal" style={{ color: "var(--outline)" }}>
                              ({v.balanceNative.toFixed(v.balanceNative >= 1 ? 2 : 4)} {v.underlying_tokens[0]?.symbol ?? ""})
                            </span>
                          </span>
                          {canWithdraw ? (
                            <span className="px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "var(--secondary-container)", color: "var(--on-secondary-container)" }}>
                              Withdrawable
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: "var(--surface-container-high)", color: "var(--outline)" }}>
                              No LI.FI withdraw
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Profitability Summary ── */}
          {debts.length > 0 && userVaults.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{
                backgroundColor: "var(--surface-container-lowest)",
                boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)",
              }}
            >
              <h2
                className="text-xs font-bold uppercase tracking-[0.2em] mb-3 font-[family-name:var(--font-manrope)]"
                style={{ color: "var(--on-surface-variant)" }}
              >
                Rate Comparison
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--outline)" }}>
                    Borrow cost (avg)
                  </div>
                  {(() => {
                    const withRate = debts.filter((d) => d.borrowApr !== null);
                    if (withRate.length === 0) return <span className="text-lg font-bold" style={{ color: "var(--outline)" }}>—</span>;
                    const avg = withRate.reduce((s, d) => s + (d.borrowApr ?? 0), 0) / withRate.length;
                    return (
                      <span className="text-lg font-bold tabular-nums" style={{ color: "var(--error)" }}>
                        {avg.toFixed(2)}%
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--outline)" }}>
                    Vault yield (avg)
                  </div>
                  <span className="text-lg font-bold tabular-nums" style={{ color: "var(--secondary)" }}>
                    {userVaults.length > 0
                      ? `${(userVaults.reduce((s, v) => s + v.apr, 0) / userVaults.length).toFixed(2)}%`
                      : "—"}
                  </span>
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: "var(--outline)" }}>
                    Net spread
                  </div>
                  {(() => {
                    const avgBorrow = debts.length > 0
                      ? debts.reduce((s, d) => s + (d.borrowApr ?? 0), 0) / debts.length
                      : 0;
                    const avgEarn = userVaults.length > 0
                      ? userVaults.reduce((s, v) => s + v.apr, 0) / userVaults.length
                      : 0;
                    const spread = avgEarn - avgBorrow;
                    return (
                      <span
                        className="text-lg font-bold tabular-nums"
                        style={{ color: spread >= 0 ? "var(--secondary)" : "var(--error)" }}
                      >
                        {spread >= 0 ? "+" : ""}{spread.toFixed(2)}%
                      </span>
                    );
                  })()}
                </div>
              </div>
              <p className="text-[10px] mt-3" style={{ color: "var(--outline)" }}>
                Positive spread means your vault earnings outpace your borrow costs. Rates are approximate and change frequently.
              </p>
            </div>
          )}
        </div>
      )}

      {/* === RESCUE FLOW === */}

      {/* Step: Select vault */}
      {step === "select_vault" && targetAccount && (
        <div className="space-y-4">
          <button onClick={handleReset} className="text-sm font-medium hover:opacity-80" style={{ color: "var(--primary)" }}>
            &larr; Back
          </button>

          <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--error-container)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--error)" }}>
              Repaying debt on {targetAccount.chainName}
              {targetDebt && ` — Borrowing ${targetDebt.symbol}`}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--error)" }}>
              Health Factor: {fmtHf(targetAccount.healthFactor)} &middot; Debt: {fmtUsd(targetAccount.totalDebtUsd)}
            </p>
          </div>

          <h3 className="text-sm font-bold" style={{ color: "var(--on-surface)" }}>
            Select vault to withdraw from
          </h3>

          {loadingVaults && (
            <div className="py-6 text-center text-sm" style={{ color: "var(--outline)" }}>
              <Spinner /> Loading your positions...
            </div>
          )}

          {!loadingVaults && userVaults.length === 0 && (
            <div className="py-6 text-center text-sm" style={{ color: "var(--outline)" }}>
              No vault positions found to withdraw from
            </div>
          )}

          {userVaults.map((vault) => {
            const isCrossChain = vault.chainId !== targetAccount.chainId;
            const canWithdraw = vault.isRedeemable !== false;
            return (
              <div
                key={vault.id}
                className="w-full rounded-2xl px-5 py-4"
                style={{ backgroundColor: "var(--surface-container-lowest)", opacity: canWithdraw ? 1 : 0.6 }}
              >
                <div className="flex items-center gap-3">
                  <ChainDot chain={vault.chain} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: "var(--on-surface)" }}>{vault.symbol}</span>
                      <span className="text-xs" style={{ color: "var(--outline)" }}>{vault.protocol}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs tabular-nums" style={{ color: "var(--on-surface-variant)" }}>
                        {fmtUsd(vault.balanceUsd)}
                      </span>
                      {isCrossChain && (
                        <span className="text-[10px]" style={{ color: "#d97706" }}>
                          Cross-chain: {vault.chain} &rarr; {targetAccount.chainName.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  {canWithdraw ? (
                    <button
                      onClick={() => getWithdrawQuote(vault)}
                      className="text-sm font-bold shrink-0 rounded-full px-4 py-2 transition-all hover:opacity-80"
                      style={{ backgroundColor: "var(--primary-container)", color: "var(--on-primary-container)" }}
                    >
                      Withdraw &rarr;
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold shrink-0 px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--surface-container-high)", color: "var(--outline)" }}>
                      Not available via LI.FI
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step: Quoting */}
      {step === "quoting" && (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <Spinner />
          <p className="text-sm mt-3" style={{ color: "var(--on-surface-variant)" }}>
            Getting rescue route...
          </p>
        </div>
      )}

      {/* Step: Quoted — confirm */}
      {step === "quoted" && withdrawQuote && targetAccount && (
        <div className="space-y-4">
          <button onClick={() => setStep("select_vault")} className="text-sm font-medium hover:opacity-80" style={{ color: "var(--primary)" }}>
            &larr; Back
          </button>

          <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
            <h3 className="text-sm font-bold" style={{ color: "var(--on-surface)" }}>Rescue Plan</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--primary-container)", color: "var(--on-primary-container)" }}>1</div>
                <div className="text-sm" style={{ color: "var(--on-surface)" }}>
                  Withdraw from <span className="font-semibold">{selectedVault?.symbol}</span> ({selectedVault?.protocol})
                </div>
              </div>
              {selectedVault && selectedVault.chainId !== targetAccount.chainId && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--primary-container)", color: "var(--on-primary-container)" }}>2</div>
                  <div className="text-sm" style={{ color: "var(--on-surface)" }}>
                    Bridge to {targetAccount.chainName}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--primary-container)", color: "var(--on-primary-container)" }}>
                  {selectedVault && selectedVault.chainId !== targetAccount.chainId ? "3" : "2"}
                </div>
                <div className="text-sm" style={{ color: "var(--on-surface)" }}>
                  Repay <span className="font-semibold">{targetDebt?.symbol}</span> debt on Aave V3
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-2 text-sm" style={{ backgroundColor: "var(--surface-container-low)" }}>
              <div className="flex justify-between">
                <span style={{ color: "var(--on-surface-variant)" }}>You receive</span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--on-surface)" }}>
                  ~{parseFloat(formatUnits(BigInt(withdrawQuote.toAmount), withdrawQuote.toTokenDecimals)).toFixed(4)} {withdrawQuote.toTokenSymbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--on-surface-variant)" }}>Gas cost</span>
                <span className="tabular-nums" style={{ color: "var(--on-surface)" }}>~${withdrawQuote.gasCostUSD}</span>
              </div>
              {withdrawQuote.executionTime != null && withdrawQuote.executionTime > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: "var(--on-surface-variant)" }}>Est. time</span>
                  <span style={{ color: "var(--on-surface)" }}>
                    {withdrawQuote.executionTime < 60
                      ? `~${withdrawQuote.executionTime}s`
                      : `~${Math.ceil(withdrawQuote.executionTime / 60)} min`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={executeWithdraw}
            className="w-full rounded-full py-3.5 text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--error)", boxShadow: "0 4px 16px rgba(220, 38, 38, 0.25)" }}
          >
            Execute Rescue
          </button>
        </div>
      )}

      {/* Step: Withdrawing */}
      {step === "withdrawing" && (
        <div className="rounded-2xl p-8 text-center space-y-3" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <Spinner />
          <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>
            Step 1: Withdrawing from vault...
          </p>
          <p className="text-xs" style={{ color: "var(--outline)" }}>Confirm in your wallet</p>
        </div>
      )}

      {/* Step: Bridging */}
      {step === "bridging" && (
        <div className="rounded-2xl p-8 text-center space-y-3" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <Spinner />
          <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>
            Step 2: Bridging funds to {targetAccount?.chainName}...
          </p>
          <p className="text-xs" style={{ color: "var(--outline)" }}>
            Waiting for tokens to arrive. This may take a few minutes.
          </p>
        </div>
      )}

      {/* Step: Approving repay */}
      {step === "approving_repay" && (
        <div className="rounded-2xl p-8 text-center space-y-3" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <Spinner />
          <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>
            Approving {targetDebt?.symbol} for Aave repayment...
          </p>
          <p className="text-xs" style={{ color: "var(--outline)" }}>Confirm in your wallet</p>
        </div>
      )}

      {/* Step: Repaying */}
      {step === "repaying" && (
        <div className="rounded-2xl p-8 text-center space-y-3" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <Spinner />
          <p className="text-sm font-medium" style={{ color: "var(--on-surface-variant)" }}>
            Repaying debt on Aave V3...
          </p>
          <p className="text-xs" style={{ color: "var(--outline)" }}>Confirm in your wallet</p>
        </div>
      )}

      {/* Step: Confirmed */}
      {step === "confirmed" && (
        <div className="rounded-2xl p-8 text-center space-y-4" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
          <div className="h-14 w-14 rounded-full flex items-center justify-center text-3xl mx-auto" style={{ backgroundColor: "var(--secondary-container)", color: "var(--on-secondary-container)" }}>
            &#x2713;
          </div>
          <p className="text-lg font-bold" style={{ color: "var(--on-surface)" }}>Rescue complete!</p>
          <p className="text-sm" style={{ color: "var(--on-surface-variant)" }}>
            Your debt has been repaid. Health factor should improve shortly.
          </p>
          {repayExplorerUrl && (
            <a href={repayExplorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: "var(--primary)" }}>
              View repay transaction
            </a>
          )}
          <button onClick={handleReset} className="text-sm font-medium hover:opacity-80" style={{ color: "var(--primary)" }}>
            Back to dashboard
          </button>
        </div>
      )}

      {/* Step: Error */}
      {step === "error" && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--error-container)" }}>
            <p className="text-sm" style={{ color: "var(--error)" }}>{error || "Something went wrong"}</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded-full py-3 text-sm transition-colors"
            style={{ backgroundColor: "var(--surface-container-high)", color: "var(--on-surface-variant)" }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
