import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDepositQuote } from "../lib/lifi-client.js";
import { CHAIN_MAP } from "../lib/types.js";

const schema = {
  vaultAddress: z.string().describe("Vault contract address (becomes toToken)"),
  vaultChainId: z.number().describe("Vault's chain ID"),
  fromToken: z.string().describe("Token address to deposit from (use 0x0000000000000000000000000000000000000000 for native tokens)"),
  fromChainId: z.number().describe("Chain ID where user's tokens are"),
  amount: z.string().describe('Amount in human-readable format (e.g. "100" for 100 USDC)'),
  fromTokenDecimals: z.number().optional().describe("Decimals of fromToken. Auto-resolved from LI.FI if omitted."),
  userAddress: z.string().describe("User's wallet address"),
};

export function registerDepositQuote(server: McpServer) {
  server.tool(
    "get_deposit_quote",
    "Get a deposit quote from LI.FI Composer. Supports cross-chain and any-token deposits (swap + bridge + deposit in one transaction).",
    schema,
    async (params) => {
      try {
        const quote = (await getDepositQuote(params)) as Record<string, unknown>;

        const estimate = quote.estimate as Record<string, unknown> | undefined;
        const action = quote.action as Record<string, unknown> | undefined;
        const txReq = quote.transactionRequest as Record<string, unknown> | undefined;
        const steps = quote.includedSteps as unknown[] | undefined;

        const fromChain = CHAIN_MAP[params.fromChainId] ?? `chain:${params.fromChainId}`;
        const toChain = CHAIN_MAP[params.vaultChainId] ?? `chain:${params.vaultChainId}`;
        const isCrossChain = params.fromChainId !== params.vaultChainId;

        // Extract gas cost
        let gasCostUsd = "unknown";
        if (estimate?.gasCosts && Array.isArray(estimate.gasCosts)) {
          const totalGas = (estimate.gasCosts as Array<{ amountUSD?: string }>)
            .reduce((sum, g) => sum + parseFloat(g.amountUSD ?? "0"), 0);
          gasCostUsd = `$${totalGas.toFixed(2)}`;
        }

        const lines = [
          "# Deposit Quote",
          "",
          `**Route:** ${params.amount} tokens on ${fromChain} → vault on ${toChain}`,
          isCrossChain ? "**Type:** Cross-chain (swap + bridge + deposit)" : "**Type:** Same-chain deposit",
          "",
          "## Estimate",
          `  From amount: ${estimate?.fromAmount ?? "—"}`,
          `  To amount: ${estimate?.toAmount ?? "—"}`,
          `  Min received: ${estimate?.toAmountMin ?? "—"}`,
          `  Gas cost: ${gasCostUsd}`,
          `  Execution time: ${estimate?.executionDuration ? `~${estimate.executionDuration}s` : "—"}`,
        ];

        if (action) {
          const slippage = action.slippage as number | undefined;
          if (slippage !== undefined) {
            lines.push(`  Slippage: ${(slippage * 100).toFixed(2)}%`);
          }
        }

        if (steps && steps.length > 0) {
          lines.push("", "## Route Steps");
          for (const step of steps) {
            const s = step as Record<string, unknown>;
            lines.push(`  - ${s.type ?? "step"}: ${s.tool ?? ""}`);
          }
        }

        if (estimate?.approvalAddress) {
          lines.push("", `**Approval required:** Token approval needed for ${estimate.approvalAddress}`);
        }

        if (txReq) {
          lines.push(
            "",
            "## Transaction Request",
            `  To: ${txReq.to}`,
            `  Chain ID: ${txReq.chainId}`,
            `  Value: ${txReq.value ?? "0"}`,
            txReq.gasLimit ? `  Gas limit: ${txReq.gasLimit}` : "",
            `  Data: ${String(txReq.data ?? "").slice(0, 66)}...`,
          );
        }

        return {
          content: [{ type: "text" as const, text: lines.filter(Boolean).join("\n") }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error getting deposit quote: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
