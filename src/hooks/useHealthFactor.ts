"use client";

import { useAccount, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { useMemo } from "react";
import {
  AAVE_V3_POOL,
  AAVE_V3_CHAINS,
  AAVE_POOL_ABI,
} from "@/lib/constants";

export type AaveAccountData = {
  chainId: number;
  chainName: string;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  availableBorrowsUsd: number;
  currentLiquidationThreshold: number;
  ltv: number;
  healthFactor: number;
  isAtRisk: boolean; // healthFactor < 1.05
  raw: {
    totalCollateralBase: bigint;
    totalDebtBase: bigint;
    healthFactor: bigint;
  };
};

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
};

/**
 * Poll Aave V3 getUserAccountData across all supported chains.
 * Returns per-chain health data, refreshed every `pollingMs`.
 */
export function useHealthFactor(pollingMs = 15_000) {
  const { address } = useAccount();

  const contracts = useMemo(() => {
    if (!address) return [];
    return AAVE_V3_CHAINS.map((chainId) => ({
      address: AAVE_V3_POOL[chainId] as `0x${string}`,
      abi: AAVE_POOL_ABI,
      functionName: "getUserAccountData" as const,
      args: [address] as const,
      chainId,
    }));
  }, [address]);

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: !!address && contracts.length > 0,
      refetchInterval: pollingMs,
    },
  });

  const accounts: AaveAccountData[] = useMemo(() => {
    if (!data) return [];
    return data
      .map((result, i) => {
        const chainId = AAVE_V3_CHAINS[i];
        if (result.status !== "success" || !result.result) return null;

        const [
          totalCollateralBase,
          totalDebtBase,
          availableBorrowsBase,
          currentLiquidationThreshold,
          ltv,
          healthFactor,
        ] = result.result as [bigint, bigint, bigint, bigint, bigint, bigint];

        // Aave returns values in base currency (USD with 8 decimals)
        const collateralUsd = parseFloat(formatUnits(totalCollateralBase, 8));
        const debtUsd = parseFloat(formatUnits(totalDebtBase, 8));
        const borrowsUsd = parseFloat(formatUnits(availableBorrowsBase, 8));
        // Health factor has 18 decimals
        const hf = parseFloat(formatUnits(healthFactor, 18));

        // Skip chains with no positions
        if (collateralUsd === 0 && debtUsd === 0) return null;

        return {
          chainId,
          chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
          totalCollateralUsd: collateralUsd,
          totalDebtUsd: debtUsd,
          availableBorrowsUsd: borrowsUsd,
          currentLiquidationThreshold: Number(currentLiquidationThreshold) / 100,
          ltv: Number(ltv) / 100,
          healthFactor: hf > 100 ? Infinity : hf,
          isAtRisk: debtUsd > 0 && hf < 1.05,
          raw: { totalCollateralBase, totalDebtBase, healthFactor },
        };
      })
      .filter((a): a is AaveAccountData => a !== null);
  }, [data]);

  const hasRisk = accounts.some((a) => a.isAtRisk);

  return { accounts, hasRisk, isLoading, refetch };
}
