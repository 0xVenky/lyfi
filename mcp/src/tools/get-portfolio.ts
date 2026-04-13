import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHAIN_MAP } from "../lib/types.js";

const EARN_BASE = "https://earn.li.fi";

type Position = {
  chainId: number;
  protocolName: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  balanceUsd: string;
  balanceNative: string;
};

const schema = {
  address: z.string().describe("Wallet address to check positions for"),
};

export function registerGetPortfolio(server: McpServer) {
  server.tool(
    "get_portfolio",
    "Get all yield positions for a wallet address. Shows vaults the wallet is deposited in, with current balances.",
    schema,
    async (params) => {
      try {
        const url = `${EARN_BASE}/v1/earn/portfolio/${params.address}/positions`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          return {
            content: [{ type: "text" as const, text: `Error fetching portfolio: ${res.status} ${body || res.statusText}` }],
            isError: true,
          };
        }

        const data = (await res.json()) as Position[];

        if (!Array.isArray(data) || data.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No yield positions found for ${params.address}.` }],
          };
        }

        let totalUsd = 0;
        const lines = data.map((pos, i) => {
          const chain = CHAIN_MAP[pos.chainId] ?? `chain:${pos.chainId}`;
          const balUsd = parseFloat(pos.balanceUsd);
          const balNative = parseFloat(pos.balanceNative);
          totalUsd += balUsd;

          return [
            `${i + 1}. ${pos.asset.symbol} on ${pos.protocolName}`,
            `   Chain: ${chain}`,
            `   Balance: ${balNative.toFixed(6)} ${pos.asset.symbol} ($${balUsd.toFixed(2)})`,
            `   Asset: ${pos.asset.address}`,
          ].join("\n");
        });

        const header = `# Portfolio for ${params.address}\n**Total value:** $${totalUsd.toFixed(2)} across ${data.length} position${data.length > 1 ? "s" : ""}\n`;

        return {
          content: [{ type: "text" as const, text: header + "\n" + lines.join("\n\n") }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error fetching portfolio: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
