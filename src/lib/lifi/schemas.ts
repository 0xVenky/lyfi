import { z } from "zod";

// === LI.FI Earn API Zod Schemas ===

export const LifiTokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

export const LifiVaultSchema = z.object({
  address: z.string(),
  chainId: z.number(),
  network: z.string(),
  slug: z.string(),
  name: z.string(),
  protocol: z.object({
    name: z.string(),
    url: z.string(),
  }),
  provider: z.string(),
  tags: z.array(z.string()),
  underlyingTokens: z.array(LifiTokenSchema),
  analytics: z.object({
    apy: z.object({
      base: z.number(),
      reward: z.number().nullable(),
      total: z.number(),
    }),
    apy1d: z.number().nullable(),
    apy7d: z.number().nullable(),
    apy30d: z.number().nullable(),
    tvl: z.object({
      usd: z.string(), // LI.FI returns TVL as string — parsed in normalizer
    }),
    updatedAt: z.string(),
  }),
  depositPacks: z.array(z.object({
    name: z.string(),
    stepsType: z.string(),
  })),
  redeemPacks: z.array(z.object({
    name: z.string(),
    stepsType: z.string(),
  })),
  isTransactional: z.boolean(),
  isRedeemable: z.boolean(),
  lpTokens: z.array(z.unknown()),
  syncedAt: z.string(),
  description: z.string().optional(),
});

export type LifiVaultRaw = z.infer<typeof LifiVaultSchema>;

export const LifiVaultsResponseSchema = z.object({
  data: z.array(LifiVaultSchema),
  nextCursor: z.string().nullable().optional(), // absent on chain-filtered responses
  total: z.number(),
});

export const LifiChainSchema = z.object({
  chainId: z.number(),
  name: z.string(),
  network: z.string(),
});

export const LifiChainsResponseSchema = z.object({
  data: z.array(LifiChainSchema),
});

export const LifiProtocolSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});

export const LifiProtocolsResponseSchema = z.object({
  data: z.array(LifiProtocolSchema),
});

// === Portfolio ===

export const LifiPositionSchema = z.object({
  chainId: z.number(),
  protocolName: z.string(),
  asset: z.object({
    address: z.string(),
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  balanceUsd: z.string(),
  balanceNative: z.string(),
});

export type LifiPosition = z.infer<typeof LifiPositionSchema>;

export const LifiPortfolioResponseSchema = z.object({
  positions: z.array(LifiPositionSchema),
});
