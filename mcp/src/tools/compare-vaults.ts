import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVaultDetails } from "../lib/lifi-client.js";
import { CHAIN_MAP } from "../lib/types.js";
import { formatTvl, formatApy } from "../lib/format.js";

const schema = {
  slugs: z.array(z.string()).min(2).max(5).describe("Array of 2-5 vault slugs to compare"),
};

export function registerCompareVaults(server: McpServer) {
  server.tool(
    "compare_vaults",
    "Compare 2-5 vaults side by side. Shows APY, TVL, yield sustainability, chain, and deposit feasibility.",
    schema,
    async (params) => {
      try {
        const results = await Promise.allSettled(
          params.slugs.map((slug) => getVaultDetails(slug))
        );

        const vaults = results
          .map((r, i) => ({
            slug: params.slugs[i],
            vault: r.status === "fulfilled" ? r.value : null,
            error: r.status === "rejected" ? String(r.reason) : null,
          }));

        const loaded = vaults.filter((v) => v.vault != null);
        if (loaded.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `Failed to fetch any vaults:\n${vaults.map((v) => `  ${v.slug}: ${v.error}`).join("\n")}`,
            }],
            isError: true,
          };
        }

        const lines = ["# Vault Comparison", ""];

        // Table header
        const header = ["Metric", ...loaded.map((v) => v.vault!.name.slice(0, 20))];
        const separator = header.map((h) => "-".repeat(Math.max(h.length, 10)));

        lines.push(
          `| ${header.join(" | ")} |`,
          `| ${separator.join(" | ")} |`
        );

        // Rows
        const rows: [string, ...string[]][] = [
          ["Protocol", ...loaded.map((v) => v.vault!.protocol.name)],
          ["Chain", ...loaded.map((v) => CHAIN_MAP[v.vault!.chainId] ?? `${v.vault!.chainId}`)],
          ["TVL", ...loaded.map((v) => formatTvl(v.vault!.analytics.tvl.usd))],
          ["APY Total", ...loaded.map((v) => formatApy(v.vault!.analytics.apy.total))],
          ["APY Base", ...loaded.map((v) => formatApy(v.vault!.analytics.apy.base))],
          ["APY Reward", ...loaded.map((v) => formatApy(v.vault!.analytics.apy.reward))],
          ["Organic %", ...loaded.map((v) => {
            const t = v.vault!.analytics.apy.total;
            const b = v.vault!.analytics.apy.base;
            return t > 0 ? `${((b / t) * 100).toFixed(1)}%` : "—";
          })],
          ["APY 7d", ...loaded.map((v) => formatApy(v.vault!.analytics.apy7d))],
          ["APY 30d", ...loaded.map((v) => formatApy(v.vault!.analytics.apy30d))],
          ["Tokens", ...loaded.map((v) => v.vault!.underlyingTokens.map((t) => t.symbol).join("/"))],
          ["Tags", ...loaded.map((v) => v.vault!.tags.join(", ") || "—")],
          ["Depositable", ...loaded.map((v) => v.vault!.isTransactional ? "Yes" : "No")],
        ];

        for (const row of rows) {
          lines.push(`| ${row.join(" | ")} |`);
        }

        // Note any failures
        const failed = vaults.filter((v) => v.vault == null);
        if (failed.length > 0) {
          lines.push("", "**Failed to load:**");
          for (const f of failed) {
            lines.push(`  - ${f.slug}: ${f.error}`);
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error comparing vaults: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
