"use client";

import { useAccount, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { useMemo } from "react";
import {
  AAVE_V3_CHAINS,
  AAVE_V3_POOL,
  AAVE_POOL_ABI,
  AAVE_V3_UI_POOL_DATA_PROVIDER,
  AAVE_UI_POOL_DATA_PROVIDER_ABI,
  AAVE_V3_POOL_ADDRESS_PROVIDER,
  ERC20_TOKENS_BY_CHAIN,
} from "@/lib/constants";

export type DebtPosition = {
  chainId: number;
  asset: string; // underlying token address
  symbol: string;
  decimals: number;
  scaledVariableDebt: bigint;
  borrowApr: number | null; // annual borrow rate as percentage (e.g. 5.23)
};

// Known token metadata lookup
const TOKEN_META: Record<string, { symbol: string; decimals: number }> = {};
for (const [chainId, tokens] of Object.entries(ERC20_TOKENS_BY_CHAIN)) {
  for (const t of tokens) {
    TOKEN_META[`${chainId}-${t.address.toLowerCase()}`] = { symbol: t.symbol, decimals: t.decimals };
  }
}

/**
 * Read per-asset debt + borrow rates from Aave V3 across chains.
 */
export function useAaveDebt() {
  const { address } = useAccount();

  // Step 1: Get user reserve data (which assets have debt)
  const userContracts = useMemo(() => {
    if (!address) return [];
    return AAVE_V3_CHAINS
      .filter((chainId) => AAVE_V3_UI_POOL_DATA_PROVIDER[chainId])
      .map((chainId) => ({
        address: AAVE_V3_UI_POOL_DATA_PROVIDER[chainId] as `0x${string}`,
        abi: AAVE_UI_POOL_DATA_PROVIDER_ABI,
        functionName: "getUserReservesData" as const,
        args: [
          AAVE_V3_POOL_ADDRESS_PROVIDER[chainId] as `0x${string}`,
          address,
        ] as const,
        chainId,
      }));
  }, [address]);

  const { data: userData, isLoading: userLoading } = useReadContracts({
    contracts: userContracts,
    query: {
      enabled: !!address && userContracts.length > 0,
      refetchInterval: 30_000,
    },
  });

  // Parse debt positions (without rates yet)
  const rawDebts = useMemo(() => {
    if (!userData) return [];
    const result: { chainId: number; asset: string; symbol: string; decimals: number; scaledVariableDebt: bigint }[] = [];

    const filteredChains = AAVE_V3_CHAINS.filter((cid) => AAVE_V3_UI_POOL_DATA_PROVIDER[cid]);

    for (let i = 0; i < userData.length; i++) {
      const entry = userData[i];
      if (entry.status !== "success" || !entry.result) continue;

      const chainId = filteredChains[i];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reserves = (entry.result as any)[0] as Array<{
        underlyingAsset: string;
        scaledVariableBorrowBalance: bigint;
        principalStableDebt: bigint;
      }>;

      for (const r of reserves) {
        if (r.scaledVariableBorrowBalance <= BigInt(0) && r.principalStableDebt <= BigInt(0)) continue;

        const key = `${chainId}-${r.underlyingAsset.toLowerCase()}`;
        const meta = TOKEN_META[key];
        result.push({
          chainId,
          asset: r.underlyingAsset,
          symbol: meta?.symbol ?? r.underlyingAsset.slice(0, 6),
          decimals: meta?.decimals ?? 18,
          scaledVariableDebt: r.scaledVariableBorrowBalance,
        });
      }
    }
    return result;
  }, [userData]);

  // Step 2: Fetch borrow rates for each debt asset via getReserveData
  const rateContracts = useMemo(() => {
    return rawDebts.map((d) => ({
      address: AAVE_V3_POOL[d.chainId] as `0x${string}`,
      abi: AAVE_POOL_ABI,
      functionName: "getReserveData" as const,
      args: [d.asset as `0x${string}`] as const,
      chainId: d.chainId,
    }));
  }, [rawDebts]);

  const { data: rateData, isLoading: rateLoading } = useReadContracts({
    contracts: rateContracts,
    query: {
      enabled: rateContracts.length > 0,
      refetchInterval: 30_000,
    },
  });

  // Merge debt positions with borrow rates
  const debts: DebtPosition[] = useMemo(() => {
    return rawDebts.map((d, i) => {
      let borrowApr: number | null = null;
      if (rateData?.[i]?.status === "success" && rateData[i].result) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reserveData = rateData[i].result as any;
        // currentVariableBorrowRate is a ray (27 decimals)
        const rateRay = reserveData.currentVariableBorrowRate as bigint;
        if (rateRay) {
          borrowApr = parseFloat(formatUnits(rateRay, 27)) * 100;
        }
      }
      return { ...d, borrowApr };
    });
  }, [rawDebts, rateData]);

  return { debts, isLoading: userLoading || rateLoading };
}
