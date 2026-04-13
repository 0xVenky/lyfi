import { z } from "zod";
import { LIFI_COMPOSER_BASE_URL } from "@/lib/constants";

// === Zod schemas for LI.FI Composer quote response ===

const GasCostSchema = z.object({
  type: z.string().optional(),
  estimate: z.string().optional(),
  limit: z.string().optional(),
  amount: z.string().optional(),
  amountUSD: z.string().optional(),
  token: z.object({
    address: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }).optional(),
});

const TransactionRequestSchema = z.object({
  to: z.string(),
  data: z.string(),
  value: z.string(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
  chainId: z.number(),
});

const EstimateSchema = z.object({
  fromAmount: z.string(),
  toAmount: z.string(),
  toAmountMin: z.string(),
  approvalAddress: z.string().optional(),
  gasCosts: z.array(GasCostSchema).optional(),
  executionDuration: z.number().optional(),
});

const ActionSchema = z.object({
  fromChainId: z.number(),
  toChainId: z.number(),
  fromToken: z.object({
    address: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  toToken: z.object({
    address: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  fromAmount: z.string(),
  slippage: z.number().optional(),
});

export const ComposerQuoteSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  action: ActionSchema.optional(),
  estimate: EstimateSchema,
  includedSteps: z.array(z.any()).optional(),
  transactionRequest: TransactionRequestSchema,
});

export type ComposerQuote = z.infer<typeof ComposerQuoteSchema>;

// === Quote request params ===

export type QuoteParams = {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  fromAmount: string;
  slippage?: number;
};

/**
 * Fetch a deposit quote from LI.FI Composer.
 * No API key needed — direct call with rate limiting.
 */
export async function getDepositQuote(params: QuoteParams): Promise<ComposerQuote> {
  const url = new URL("/v1/quote", LIFI_COMPOSER_BASE_URL);
  url.searchParams.set("fromChain", String(params.fromChain));
  url.searchParams.set("toChain", String(params.toChain));
  url.searchParams.set("fromToken", params.fromToken);
  url.searchParams.set("toToken", params.toToken);
  url.searchParams.set("fromAddress", params.fromAddress);
  url.searchParams.set("fromAmount", params.fromAmount);
  if (params.slippage !== undefined) {
    url.searchParams.set("slippage", String(params.slippage));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.LIFI_API_KEY) {
    headers["x-lifi-api-key"] = process.env.LIFI_API_KEY;
  }

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Composer API ${res.status}: ${body || res.statusText}`);
  }

  const raw = await res.json();
  const parsed = ComposerQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[composer] Validation failed:", parsed.error.issues.slice(0, 3));
    throw new Error("Invalid quote response from Composer");
  }

  return parsed.data;
}
