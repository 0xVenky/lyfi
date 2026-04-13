import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchVaults } from "../lib/lifi-client.js";
import { CHAIN_MAP, NETWORK_TO_CHAIN } from "../lib/types.js";
import { formatTvl, formatApy } from "../lib/format.js";

const schema = {
  chain: z.string().optional().describe("Chain name or ID (e.g. 'base', '8453')"),
  token: z.string().optional().describe("Underlying token symbol (e.g. 'USDC', 'ETH')"),
  minApy: z.number().optional().describe("Minimum total APY percentage"),
  minTvl: z.number().optional().describe("Minimum TVL in USD"),
  tag: z.string().optional().describe("Vault tag: 'stablecoin', 'single', 'multi', 'il-risk'"),
  sortBy: z.enum(["apy", "tvl"]).optional().describe("Sort by 'apy' or 'tvl' (default: 'tvl')"),
  limit: z.number().optional().describe("Max results (default: 10, max: 25)"),
};

function resolveChainId(chain: string): number | undefined {
  const num = Number(chain);
  if (!isNaN(num) && CHAIN_MAP[num]) return num;
  return NETWORK_TO_CHAIN[chain.toLowerCase()];
}

export function registerSearchVaults(server: McpServer) {
  server.tool(
    "search_vaults",
    "Search and filter yield vaults across 17 chains. Returns top matches with APY, TVL, protocol, and chain info.",
    schema,
    async (params) => {
      try {
        let chainId: number | undefined;
        if (params.chain) {
          chainId = resolveChainId(params.chain);
          if (!chainId) {
            return {
              content: [{
                type: "text" as const,
                text: `Unknown chain: "${params.chain}". Supported: ${Object.values(CHAIN_MAP).join(", ")}`,
              }],
            };
          }
        }

        const vaults = await searchVaults({
          chainId,
          token: params.token,
          minApy: params.minApy,
          minTvl: params.minTvl,
          tag: params.tag,
          sortBy: params.sortBy,
          limit: params.limit,
        });

        if (vaults.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No vaults found matching your criteria." }],
          };
        }

        const lines = vaults.map((v, i) => {
          const tvl = formatTvl(v.analytics.tvl.usd);
          const apyTotal = formatApy(v.analytics.apy.total);
          const apyBase = formatApy(v.analytics.apy.base);
          const apyReward = v.analytics.apy.reward != null ? formatApy(v.analytics.apy.reward) : "—";
          const tokens = v.underlyingTokens.map((t) => t.symbol).join("/");
          const tags = v.tags.length > 0 ? ` [${v.tags.join(", ")}]` : "";
          const chain = CHAIN_MAP[v.chainId] ?? `chain:${v.chainId}`;
          const transactional = v.isTransactional ? "✓ depositable" : "view only";

          return [
            `${i + 1}. ${v.name}`,
            `   Protocol: ${v.protocol.name} | Chain: ${chain}`,
            `   APY: ${apyTotal} (base: ${apyBase}, reward: ${apyReward})`,
            `   TVL: ${tvl} | Tokens: ${tokens}${tags}`,
            `   Slug: ${v.slug} | ${transactional}`,
          ].join("\n");
        });

        return {
          content: [{
            type: "text" as const,
            text: `Found ${vaults.length} vault${vaults.length > 1 ? "s" : ""}:\n\n${lines.join("\n\n")}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error searching vaults: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
