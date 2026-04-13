import { formatUnits } from "viem";

export const runtime = "nodejs";

const BLOCKSCOUT_CHAINS = [
  { id: 1, name: "Ethereum", url: "https://eth.blockscout.com", nativeSymbol: "ETH", nativeDecimals: 18 },
  { id: 8453, name: "Base", url: "https://base.blockscout.com", nativeSymbol: "ETH", nativeDecimals: 18 },
  { id: 42161, name: "Arbitrum", url: "https://arbitrum.blockscout.com", nativeSymbol: "ETH", nativeDecimals: 18 },
  { id: 10, name: "Optimism", url: "https://optimism.blockscout.com", nativeSymbol: "ETH", nativeDecimals: 18 },
  { id: 137, name: "Polygon", url: "https://polygon.blockscout.com", nativeSymbol: "POL", nativeDecimals: 18 },
] as const;

type TokenBalance = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceUsd: number;
  logoURI?: string;
};

type ChainBalances = {
  chainId: number;
  name: string;
  tokens: TokenBalance[];
  totalUsd: number;
};

// Well-known tokens that should always be included regardless of market cap
const KNOWN_SYMBOLS = new Set([
  "ETH", "WETH", "STETH", "WSTETH", "CBETH", "RETH", "METH", "EETH", "WEETH",
  "USDC", "USDC.E", "USDCE", "USDT", "USDT0", "DAI", "FRAX", "LUSD", "GHO", "CRVUSD", "PYUSD",
  "WBTC", "TBTC", "CBBTC",
  "LINK", "UNI", "AAVE", "MKR", "LDO", "ARB", "OP", "MATIC", "POL",
  "CRV", "BAL", "COMP", "SNX", "RPL", "PENDLE",
]);

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    // -L equivalent: follow redirects (fetch does this by default)
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchChainBalances(
  chain: (typeof BLOCKSCOUT_CHAINS)[number],
  address: string,
): Promise<ChainBalances> {
  const tokens: TokenBalance[] = [];

  // 1. Native balance from /api/v2/addresses/{address}
  // 2. Token balances from /api/v2/addresses/{address}/token-balances
  const [addrRes, tokenRes] = await Promise.all([
    fetchWithTimeout(`${chain.url}/api/v2/addresses/${address}`).catch(
      () => null,
    ),
    fetchWithTimeout(
      `${chain.url}/api/v2/addresses/${address}/token-balances`,
    ).catch(() => null),
  ]);

  // Native token
  if (addrRes?.ok) {
    const data = await addrRes.json();
    const rawBal = data.coin_balance;
    const rate = parseFloat(data.exchange_rate ?? "0");
    if (rawBal && BigInt(rawBal) > BigInt(0) && rate > 0) {
      const bal = formatUnits(BigInt(rawBal), chain.nativeDecimals);
      const usd = parseFloat(bal) * rate;
      if (usd >= 0.01) {
        tokens.push({
          address: "0x0000000000000000000000000000000000000000",
          symbol: chain.nativeSymbol,
          name: chain.nativeSymbol,
          decimals: chain.nativeDecimals,
          balance: bal,
          balanceUsd: usd,
        });
      }
    }
  }

  // ERC20 tokens
  if (tokenRes?.ok) {
    const data: Array<{
      value: string;
      token: {
        address_hash: string;
        symbol: string;
        name: string;
        decimals: string;
        exchange_rate: string | null;
        icon_url: string | null;
        type: string;
        circulating_market_cap: string | null;
        volume_24h: string | null;
        holders_count: string | null;
      };
    }> = await tokenRes.json();

    for (const item of data) {
      if (item.token.type !== "ERC-20") continue;

      const decimals = parseInt(item.token.decimals ?? "18", 10);
      const rate = parseFloat(item.token.exchange_rate ?? "0");
      if (!item.value || rate === 0) continue;

      // Filter spam: require known symbol, or meaningful market cap/volume
      const sym = item.token.symbol?.toUpperCase() ?? "";
      const mcap = parseFloat(item.token.circulating_market_cap ?? "0");
      const vol = parseFloat(item.token.volume_24h ?? "0");
      const isKnown = KNOWN_SYMBOLS.has(sym);
      const isLegit = mcap > 100_000 || vol > 5_000;
      if (!isKnown && !isLegit) continue;

      try {
        const bal = formatUnits(BigInt(item.value), decimals);
        const usd = parseFloat(bal) * rate;

        if (usd < 0.50) continue;

        tokens.push({
          address: item.token.address_hash,
          symbol: item.token.symbol,
          name: item.token.name,
          decimals,
          balance: bal,
          balanceUsd: usd,
          logoURI: item.token.icon_url ?? undefined,
        });
      } catch {
        // Skip tokens with weird values
      }
    }
  }

  // Sort by USD value desc
  tokens.sort((a, b) => b.balanceUsd - a.balanceUsd);

  return {
    chainId: chain.id,
    name: chain.name,
    tokens,
    totalUsd: tokens.reduce((s, t) => s + t.balanceUsd, 0),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const results = await Promise.allSettled(
      BLOCKSCOUT_CHAINS.map((c) => fetchChainBalances(c, address)),
    );

    const chains: ChainBalances[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.tokens.length > 0) {
        chains.push(r.value);
      }
    }

    // Sort chains by value desc
    chains.sort((a, b) => b.totalUsd - a.totalUsd);

    const totalUsd = chains.reduce((s, c) => s + c.totalUsd, 0);
    return Response.json({ chains, totalUsd });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Balance fetch failed";
    console.error("[balances] Error:", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
