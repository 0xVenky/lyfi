import { z } from "zod";
import { getDepositQuote } from "@/lib/lifi/composer";

const QuoteParamsSchema = z.object({
  fromChain: z.coerce.number().int().positive(),
  toChain: z.coerce.number().int().positive(),
  fromToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  fromAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  fromAmount: z.string().regex(/^\d+$/),
  slippage: z.coerce.number().min(0).max(1).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());

  const parsed = QuoteParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid parameters", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const quote = await getDepositQuote(parsed.data);
    return Response.json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quote failed";
    console.error("[quote] Error:", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
