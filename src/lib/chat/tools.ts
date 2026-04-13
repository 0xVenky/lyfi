import type Anthropic from "@anthropic-ai/sdk";

// --- Chain mapping ---

const CHAIN_MAP: Record<number, string> = {
  1: "ethereum", 10: "optimism", 56: "bsc", 100: "gnosis", 130: "unichain",
  137: "polygon", 143: "monad", 146: "sonic", 5000: "mantle", 8453: "base",
  42161: "arbitrum", 42220: "celo", 43114: "avalanche", 59144: "linea",
  80094: "berachain", 534352: "scroll", 747474: "katana",
};

const NETWORK_TO_CHAIN: Record<string, number> = Object.fromEntries(
  Object.entries(CHAIN_MAP).map(([id, name]) => [name, Number(id)])
);

// --- Helpers ---

const EARN_BASE = "https://earn.li.fi";
const COMPOSER_BASE = "https://li.quest";

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LI.FI API ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

function toSmallestUnit(amount: string, decimals: number): string {
  const [whole = "0", frac = ""] = amount.split(".");
  const padded = frac.padEnd(decimals, "0").slice(0, decimals);
  const raw = whole + padded;
  return raw.replace(/^0+/, "") || "0";
}

// --- Token decimals auto-resolve ---

const tokenCache = new Map<number, Map<string, number>>();

async function resolveDecimals(chainId: number, tokenAddress: string): Promise<number> {
  const addrLower = tokenAddress.toLowerCase();
  let chainTokens = tokenCache.get(chainId);
  if (chainTokens) {
    const cached = chainTokens.get(addrLower);
    if (cached !== undefined) return cached;
  }
  try {
    const raw = await fetchJson(`${COMPOSER_BASE}/v1/tokens?chains=${chainId}`) as {
      tokens?: Record<string, Array<{ address: string; decimals: number }>>;
    };
    const tokens = raw.tokens?.[String(chainId)] ?? [];
    chainTokens = new Map<string, number>();
    for (const t of tokens) {
      chainTokens.set(t.address.toLowerCase(), t.decimals);
    }
    tokenCache.set(chainId, chainTokens);
    return chainTokens.get(addrLower) ?? 18;
  } catch {
    return 18;
  }
}

// --- Type for vault responses ---

type LifiVault = {
  address: string;
  chainId: number;
  slug: string;
  name: string;
  protocol: { name: string; url: string };
  tags: string[];
  underlyingTokens: { address: string; symbol: string; decimals: number }[];
  analytics: {
    apy: { base: number; reward: number | null; total: number };
    apy1d: number | null;
    apy7d: number | null;
    apy30d: number | null;
    tvl: { usd: string };
    updatedAt: string;
  };
  depositPacks: { name: string; stepsType: string }[];
  redeemPacks: { name: string; stepsType: string }[];
  isTransactional: boolean;
  isRedeemable: boolean;
  description?: string;
};

// --- Tool definitions for Anthropic API ---

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "search_vaults",
    description: "Search and filter yield vaults across 17 chains. Returns top matches with APY, TVL, protocol, and chain info.",
    input_schema: {
      type: "object" as const,
      properties: {
        chain: { type: "string", description: "Chain name or ID (e.g. 'base', '8453')" },
        token: { type: "string", description: "Underlying token symbol (e.g. 'USDC', 'ETH')" },
        minApy: { type: "number", description: "Minimum total APY percentage" },
        minTvl: { type: "number", description: "Minimum TVL in USD" },
        tag: { type: "string", description: "Vault tag: 'stablecoin', 'single', 'multi', 'il-risk'" },
        sortBy: { type: "string", enum: ["apy", "tvl"], description: "Sort by 'apy' or 'tvl' (default: 'tvl')" },
        limit: { type: "number", description: "Max results (default: 10, max: 25)" },
      },
      required: [],
    },
  },
  {
    name: "get_vault_details",
    description: "Get full details for a specific vault including APY breakdown, underlying tokens, and protocol info.",
    input_schema: {
      type: "object" as const,
      properties: {
        slug: { type: "string", description: 'Vault slug in format "chainId-address" (e.g. "8453-0xbeef...")' },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_deposit_quote",
    description: "Get a deposit quote from LI.FI Composer. Supports cross-chain and any-token deposits (swap + bridge + deposit in one transaction). Token decimals are auto-resolved — no need to specify them.",
    input_schema: {
      type: "object" as const,
      properties: {
        vaultAddress: { type: "string", description: "Vault contract address" },
        vaultChainId: { type: "number", description: "Vault's chain ID" },
        fromToken: { type: "string", description: "Token address to deposit from (use 0x0000000000000000000000000000000000000000 for native tokens like ETH)" },
        fromChainId: { type: "number", description: "Chain ID where user's tokens are" },
        amount: { type: "string", description: 'Amount in human-readable format (e.g. "100" for 100 USDC)' },
        userAddress: { type: "string", description: "User's wallet address" },
      },
      required: ["vaultAddress", "vaultChainId", "fromToken", "fromChainId", "amount", "userAddress"],
    },
  },
  {
    name: "compare_vaults",
    description: "Compare 2-5 vaults side by side. Shows APY, TVL, yield sustainability, chain, and deposit feasibility.",
    input_schema: {
      type: "object" as const,
      properties: {
        slugs: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 5,
          description: "Array of 2-5 vault slugs to compare",
        },
      },
      required: ["slugs"],
    },
  },
];

// --- Tool execution ---

function resolveChainId(chain: string): number | undefined {
  const num = Number(chain);
  if (!isNaN(num) && CHAIN_MAP[num]) return num;
  return NETWORK_TO_CHAIN[chain.toLowerCase()];
}

function fmt(n: number | null): string {
  return n != null ? `${n.toFixed(2)}%` : "—";
}

function fmtTvl(usd: string): string {
  const n = parseFloat(usd);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

async function fetchChainVaults(chainId: number, tag?: string): Promise<LifiVault[]> {
  const url = new URL(`${EARN_BASE}/v1/earn/vaults`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("chainId", String(chainId));
  if (tag) url.searchParams.set("tags", tag);
  try {
    const raw = await fetchJson(url.toString()) as { data?: LifiVault[] };
    return raw.data ?? [];
  } catch {
    return [];
  }
}

async function execSearchVaults(input: Record<string, unknown>): Promise<string> {
  const limit = Math.min(Number(input.limit) || 10, 25);
  const sortBy = (input.sortBy as string) ?? "tvl";

  let chainId: number | undefined;
  if (input.chain) {
    chainId = resolveChainId(String(input.chain));
    if (!chainId) return `Unknown chain: "${input.chain}". Supported: ${Object.values(CHAIN_MAP).join(", ")}`;
  }

  let vaults: LifiVault[];
  if (chainId) {
    vaults = await fetchChainVaults(chainId, input.tag as string | undefined);
  } else {
    const chainIds = Object.keys(CHAIN_MAP).map(Number);
    const results = await Promise.all(chainIds.map((id) => fetchChainVaults(id, input.tag as string | undefined)));
    const seen = new Set<string>();
    vaults = results.flat().filter((v) => {
      if (seen.has(v.slug)) return false;
      seen.add(v.slug);
      return true;
    });
  }

  if (input.token) {
    const t = String(input.token).toLowerCase();
    vaults = vaults.filter((v) => v.underlyingTokens.some((tk) => tk.symbol.toLowerCase() === t));
  }
  if (input.minApy !== undefined) vaults = vaults.filter((v) => v.analytics.apy.total >= Number(input.minApy));
  if (input.minTvl !== undefined) vaults = vaults.filter((v) => parseFloat(v.analytics.tvl.usd) >= Number(input.minTvl));

  vaults.sort(sortBy === "apy"
    ? (a, b) => b.analytics.apy.total - a.analytics.apy.total
    : (a, b) => parseFloat(b.analytics.tvl.usd) - parseFloat(a.analytics.tvl.usd)
  );
  vaults = vaults.slice(0, limit);

  if (vaults.length === 0) return "No vaults found matching those criteria.";

  return vaults.map((v, i) => {
    const organic = v.analytics.apy.total > 0
      ? ((v.analytics.apy.base / v.analytics.apy.total) * 100).toFixed(0)
      : "—";
    return [
      `${i + 1}. **${v.name}** — ${v.protocol.name} on ${CHAIN_MAP[v.chainId] ?? v.chainId}`,
      `   APY: ${fmt(v.analytics.apy.total)} (base: ${fmt(v.analytics.apy.base)}, reward: ${fmt(v.analytics.apy.reward)}) | Organic: ${organic}%`,
      `   TVL: ${fmtTvl(v.analytics.tvl.usd)} | Tokens: ${v.underlyingTokens.map((t) => t.symbol).join("/")} | Tags: ${v.tags.join(", ") || "—"}`,
      `   Slug: ${v.slug} | ${v.isTransactional ? "Depositable" : "View only"}`,
    ].join("\n");
  }).join("\n\n");
}

async function execGetVaultDetails(input: Record<string, unknown>): Promise<string> {
  const slug = String(input.slug);
  const dashIdx = slug.indexOf("-");
  if (dashIdx === -1) return `Invalid slug format: "${slug}". Expected "chainId-address".`;

  const chainId = Number(slug.substring(0, dashIdx));
  const address = slug.substring(dashIdx + 1).toLowerCase();
  const url = `${EARN_BASE}/v1/earn/vaults/${chainId}/${address}`;

  const raw = await fetchJson(url) as Record<string, unknown>;
  if (!raw.address || !raw.analytics) return `Vault not found: ${slug}`;
  const v = raw as unknown as LifiVault;

  const organic = v.analytics.apy.total > 0
    ? ((v.analytics.apy.base / v.analytics.apy.total) * 100).toFixed(1)
    : "—";

  return [
    `**${v.name}**${v.description ? ` — ${v.description}` : ""}`,
    `Protocol: ${v.protocol.name} (${v.protocol.url})`,
    `Chain: ${CHAIN_MAP[v.chainId] ?? v.chainId} | TVL: ${fmtTvl(v.analytics.tvl.usd)}`,
    "",
    `APY Total: ${fmt(v.analytics.apy.total)}`,
    `  Base (organic): ${fmt(v.analytics.apy.base)}`,
    `  Reward (incentives): ${fmt(v.analytics.apy.reward)}`,
    `  Organic ratio: ${organic}%`,
    `  7d avg: ${fmt(v.analytics.apy7d)} | 30d avg: ${fmt(v.analytics.apy30d)}`,
    "",
    `Underlying: ${v.underlyingTokens.map((t) => `${t.symbol} (${t.decimals}d)`).join(", ")}`,
    `Tags: ${v.tags.join(", ") || "none"}`,
    `Depositable: ${v.isTransactional ? "Yes" : "No"} | Redeemable: ${v.isRedeemable ? "Yes" : "No"}`,
    `Slug: ${v.slug} | Address: ${v.address}`,
  ].join("\n");
}

async function execGetDepositQuote(input: Record<string, unknown>): Promise<string> {
  const fromChainId = Number(input.fromChainId);
  const vaultChainId = Number(input.vaultChainId);
  const fromToken = String(input.fromToken);
  const amount = String(input.amount);
  const userAddress = String(input.userAddress);
  const vaultAddress = String(input.vaultAddress);

  const decimals = await resolveDecimals(fromChainId, fromToken);
  const fromAmount = toSmallestUnit(amount, decimals);

  const url = new URL(`${COMPOSER_BASE}/v1/quote`);
  url.searchParams.set("fromChain", String(fromChainId));
  url.searchParams.set("toChain", String(vaultChainId));
  url.searchParams.set("fromToken", fromToken);
  url.searchParams.set("toToken", vaultAddress);
  url.searchParams.set("fromAddress", userAddress);
  url.searchParams.set("fromAmount", fromAmount);

  const headers: Record<string, string> = {};
  if (process.env.LIFI_API_KEY) headers["x-lifi-api-key"] = process.env.LIFI_API_KEY;

  const quote = await fetchJson(url.toString(), headers) as Record<string, unknown>;
  const estimate = quote.estimate as Record<string, unknown> | undefined;
  const txReq = quote.transactionRequest as Record<string, unknown> | undefined;
  const steps = quote.includedSteps as Array<Record<string, unknown>> | undefined;
  const action = quote.action as Record<string, unknown> | undefined;

  let gasCost = "unknown";
  if (estimate?.gasCosts && Array.isArray(estimate.gasCosts)) {
    const total = (estimate.gasCosts as Array<{ amountUSD?: string }>)
      .reduce((sum, g) => sum + parseFloat(g.amountUSD ?? "0"), 0);
    gasCost = `$${total.toFixed(2)}`;
  }

  const isCrossChain = fromChainId !== vaultChainId;
  const lines = [
    `**Deposit Quote**`,
    `Route: ${amount} tokens on ${CHAIN_MAP[fromChainId] ?? fromChainId} → vault on ${CHAIN_MAP[vaultChainId] ?? vaultChainId}`,
    `Type: ${isCrossChain ? "Cross-chain (swap + bridge + deposit)" : "Same-chain deposit"}`,
    `From amount: ${fromAmount} (${decimals} decimals)`,
    `Estimated receive: ${estimate?.toAmount ?? "—"}`,
    `Min receive: ${estimate?.toAmountMin ?? "—"}`,
    `Gas cost: ${gasCost}`,
  ];

  if (estimate?.executionDuration) lines.push(`Execution time: ~${estimate.executionDuration}s`);
  if (action?.slippage !== undefined) lines.push(`Slippage: ${((action.slippage as number) * 100).toFixed(2)}%`);
  if (steps && steps.length > 0) {
    lines.push(`Route steps: ${steps.map((s) => `${s.type}(${s.tool ?? ""})`).join(" → ")}`);
  }
  if (estimate?.approvalAddress) lines.push(`Approval needed for: ${estimate.approvalAddress}`);
  if (txReq) {
    lines.push(`Chain ID: ${txReq.chainId}`, `Contract: ${txReq.to}`);
  }
  return lines.join("\n");
}

async function execCompareVaults(input: Record<string, unknown>): Promise<string> {
  const slugs = input.slugs as string[];
  if (!Array.isArray(slugs) || slugs.length < 2) return "Provide 2-5 vault slugs to compare.";

  const results = await Promise.allSettled(slugs.map(async (slug) => {
    const dashIdx = slug.indexOf("-");
    if (dashIdx === -1) throw new Error(`Invalid slug: ${slug}`);
    const chainId = Number(slug.substring(0, dashIdx));
    const address = slug.substring(dashIdx + 1).toLowerCase();
    const raw = await fetchJson(`${EARN_BASE}/v1/earn/vaults/${chainId}/${address}`);
    return raw as unknown as LifiVault;
  }));

  const vaults = results.map((r, i) => ({
    slug: slugs[i],
    vault: r.status === "fulfilled" ? r.value : null,
    error: r.status === "rejected" ? String(r.reason) : null,
  }));

  const loaded = vaults.filter((v) => v.vault != null);
  if (loaded.length === 0) return `Failed to fetch any vaults:\n${vaults.map((v) => `${v.slug}: ${v.error}`).join("\n")}`;

  const header = ["Metric", ...loaded.map((v) => v.vault!.name.slice(0, 18))];
  const rows = [
    ["Protocol", ...loaded.map((v) => v.vault!.protocol.name)],
    ["Chain", ...loaded.map((v) => CHAIN_MAP[v.vault!.chainId] ?? String(v.vault!.chainId))],
    ["TVL", ...loaded.map((v) => fmtTvl(v.vault!.analytics.tvl.usd))],
    ["APY Total", ...loaded.map((v) => fmt(v.vault!.analytics.apy.total))],
    ["APY Base", ...loaded.map((v) => fmt(v.vault!.analytics.apy.base))],
    ["APY Reward", ...loaded.map((v) => fmt(v.vault!.analytics.apy.reward))],
    ["Organic %", ...loaded.map((v) => {
      const t = v.vault!.analytics.apy.total, b = v.vault!.analytics.apy.base;
      return t > 0 ? `${((b / t) * 100).toFixed(1)}%` : "—";
    })],
    ["7d APY", ...loaded.map((v) => fmt(v.vault!.analytics.apy7d))],
    ["Tokens", ...loaded.map((v) => v.vault!.underlyingTokens.map((t) => t.symbol).join("/"))],
    ["Tags", ...loaded.map((v) => v.vault!.tags.join(", ") || "—")],
    ["Depositable", ...loaded.map((v) => v.vault!.isTransactional ? "Yes" : "No")],
  ];

  const sep = header.map((h) => "-".repeat(Math.max(h.length, 8)));
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ];

  const failed = vaults.filter((v) => v.vault == null);
  if (failed.length > 0) {
    lines.push("", `Failed to load: ${failed.map((f) => `${f.slug} (${f.error})`).join(", ")}`);
  }

  return lines.join("\n");
}

// --- Execute a tool by name ---

export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "search_vaults": return await execSearchVaults(input);
      case "get_vault_details": return await execGetVaultDetails(input);
      case "get_deposit_quote": return await execGetDepositQuote(input);
      case "compare_vaults": return await execCompareVaults(input);
      default: return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`;
  }
}
