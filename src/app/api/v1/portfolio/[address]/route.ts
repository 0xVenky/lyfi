import { fetchPortfolio } from "@/lib/lifi/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const positions = await fetchPortfolio(address);
    return Response.json({ positions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portfolio fetch failed";
    console.error("[portfolio] Error:", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
