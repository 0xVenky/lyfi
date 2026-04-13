import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, arbitrum, mainnet, optimism, polygon } from "viem/chains";
import { CHAIN_MAP } from "../lib/types.js";

const SUPPORTED_CHAINS: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  137: polygon,
  8453: base,
  42161: arbitrum,
};

const RPC_URLS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  10: "https://mainnet.optimism.io",
  137: "https://polygon-rpc.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
};

const MAX_VALUE_USD = 100;

const ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io/tx",
  10: "https://optimistic.etherscan.io/tx",
  137: "https://polygonscan.com/tx",
  8453: "https://basescan.org/tx",
  42161: "https://arbiscan.io/tx",
};

const schema = {
  to: z.string().describe("Transaction recipient address (from quote's transactionRequest.to)"),
  data: z.string().describe("Transaction calldata (from quote's transactionRequest.data)"),
  value: z.string().optional().describe("Native token value in wei (default: '0')"),
  chainId: z.number().describe("Chain ID to execute on"),
  gasLimit: z.string().optional().describe("Gas limit (from quote's transactionRequest.gasLimit)"),
  fromToken: z.string().optional().describe("ERC20 token address being spent (for approval check). Omit for native token deposits."),
  approvalAddress: z.string().optional().describe("Spender address that needs token approval (from quote's estimate.approvalAddress)"),
};

export function registerExecuteDeposit(server: McpServer) {
  server.tool(
    "execute_deposit",
    "Execute a deposit transaction on-chain. Signs and broadcasts using the agent's demo wallet. The wallet must be funded with tokens and gas on the target chain. Max $100 per transaction for safety.",
    schema,
    async (params) => {
      try {
        const privateKey = process.env.AGENT_PRIVATE_KEY;
        if (!privateKey) {
          return {
            content: [{ type: "text" as const, text: "Error: AGENT_PRIVATE_KEY environment variable is not set." }],
            isError: true,
          };
        }

        const chain = SUPPORTED_CHAINS[params.chainId];
        if (!chain) {
          const supported = Object.entries(SUPPORTED_CHAINS)
            .map(([id, c]) => `${c.name} (${id})`)
            .join(", ");
          return {
            content: [{ type: "text" as const, text: `Error: Unsupported chain ID ${params.chainId}. Supported: ${supported}` }],
            isError: true,
          };
        }

        const rpcUrl = process.env[`RPC_URL_${params.chainId}`] ?? RPC_URLS[params.chainId];
        const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
        const account = privateKeyToAccount(key as `0x${string}`);

        const publicClient = createPublicClient({
          chain,
          transport: http(rpcUrl),
        });

        const walletClient = createWalletClient({
          account,
          chain,
          transport: http(rpcUrl),
        });

        const chainName = CHAIN_MAP[params.chainId] ?? `chain:${params.chainId}`;
        const lines: string[] = [];

        // Handle ERC20 approval if needed
        if (params.fromToken && params.approvalAddress) {
          const tokenAddr = params.fromToken as `0x${string}`;
          const spender = params.approvalAddress as `0x${string}`;

          const allowance = await publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [account.address, spender],
          });

          if (allowance === 0n) {
            lines.push("## Approval");
            lines.push(`Approving ${spender} to spend token ${params.fromToken}...`);

            const approvalHash = await walletClient.writeContract({
              address: tokenAddr,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [spender, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
            });

            const approvalReceipt = await publicClient.waitForTransactionReceipt({
              hash: approvalHash,
              timeout: 60_000,
            });

            if (approvalReceipt.status === "reverted") {
              return {
                content: [{ type: "text" as const, text: `Error: Approval transaction reverted. TX: ${approvalHash}` }],
                isError: true,
              };
            }

            const explorerBase = EXPLORER_URLS[params.chainId] ?? "";
            lines.push(`Approval confirmed: ${explorerBase}/${approvalHash}`);
            lines.push("");
          }
        }

        // Send the deposit transaction
        const txValue = BigInt(params.value ?? "0");

        const hash = await walletClient.sendTransaction({
          to: params.to as `0x${string}`,
          data: params.data as `0x${string}`,
          value: txValue,
          gas: params.gasLimit ? BigInt(params.gasLimit) : undefined,
        });

        const explorerBase = EXPLORER_URLS[params.chainId] ?? "";
        const explorerLink = explorerBase ? `${explorerBase}/${hash}` : hash;

        lines.push("## Deposit Transaction");
        lines.push(`**TX Hash:** ${hash}`);
        lines.push(`**Chain:** ${chainName}`);
        lines.push(`**Explorer:** ${explorerLink}`);
        lines.push("");
        lines.push("Waiting for confirmation...");

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
        });

        if (receipt.status === "reverted") {
          lines.push("");
          lines.push(`**Status:** REVERTED (block ${receipt.blockNumber})`);
          lines.push("The transaction was mined but reverted. Check the explorer for details.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
            isError: true,
          };
        }

        const gasUsed = receipt.gasUsed;
        const effectiveGasPrice = receipt.effectiveGasPrice;
        const gasCostWei = gasUsed * effectiveGasPrice;
        const gasCostEth = Number(gasCostWei) / 1e18;

        lines.push(`**Status:** CONFIRMED (block ${receipt.blockNumber})`);
        lines.push(`**Gas used:** ${gasUsed.toString()} (~${gasCostEth.toFixed(6)} ${chain.nativeCurrency.symbol})`);

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (msg.includes("insufficient funds")) {
          return {
            content: [{ type: "text" as const, text: "Error: Insufficient balance for gas or token amount. Fund the agent wallet and retry." }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text" as const, text: `Error executing deposit: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
