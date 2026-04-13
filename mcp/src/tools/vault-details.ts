import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVaultDetails } from "../lib/lifi-client.js";
import { CHAIN_MAP } from "../lib/types.js";
import { formatTvl, formatApy } from "../lib/format.js";

const schema = {
  slug: z.string().describe('Vault slug in format "chainId-address" (e.g. "8453-0xbeef...")'),
};

export function registerVaultDetails(server: McpServer) {
  server.tool(
    "get_vault_details",
    "Get full details for a specific vault including APY breakdown, underlying tokens, and protocol info.",
    schema,
    async (params) => {
      try {
        const v = await getVaultDetails(params.slug);

        const apyTotal = v.analytics.apy.total;
        const apyBase = v.analytics.apy.base;
        const apyReward = v.analytics.apy.reward;
        const organicRatio = apyTotal > 0 ? ((apyBase / apyTotal) * 100).toFixed(1) : "—";
        const chain = CHAIN_MAP[v.chainId] ?? `chain:${v.chainId}`;

        const lines = [
          `# ${v.name}`,
          "",
          `**Protocol:** ${v.protocol.name} (${v.protocol.url})`,
          `**Chain:** ${chain} (${v.chainId})`,
          `**TVL:** ${formatTvl(v.analytics.tvl.usd)}`,
          "",
          "## APY Breakdown",
          `  Total:  ${formatApy(apyTotal)}`,
          `  Base:   ${formatApy(apyBase)} (organic yield)`,
          `  Reward: ${formatApy(apyReward)} (incentive rewards)`,
          `  Organic ratio: ${organicRatio}%`,
          "",
          "## APY History",
          `  1d:  ${formatApy(v.analytics.apy1d)}`,
          `  7d:  ${formatApy(v.analytics.apy7d)}`,
          `  30d: ${formatApy(v.analytics.apy30d)}`,
          "",
          "## Underlying Tokens",
          ...v.underlyingTokens.map(
            (t) => `  - ${t.symbol} (${t.address.slice(0, 10)}...${t.address.slice(-4)}, ${t.decimals} decimals)`
          ),
          "",
          `**Tags:** ${v.tags.length > 0 ? v.tags.join(", ") : "none"}`,
          `**Depositable:** ${v.isTransactional ? "Yes" : "No"}`,
          `**Redeemable:** ${v.isRedeemable ? "Yes" : "No"}`,
          "",
          "## Deposit Methods",
          ...v.depositPacks.map((p) => `  - ${p.name} (${p.stepsType})`),
          "",
          "## Redeem Methods",
          ...v.redeemPacks.map((p) => `  - ${p.name} (${p.stepsType})`),
          "",
          `**Slug:** ${v.slug}`,
          `**Address:** ${v.address}`,
          `**Last updated:** ${v.analytics.updatedAt}`,
        ];

        if (v.description) {
          lines.splice(1, 0, `*${v.description}*`);
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error fetching vault details: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
