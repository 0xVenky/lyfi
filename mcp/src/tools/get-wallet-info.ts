import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, arbitrum, mainnet } from "viem/chains";

const DEMO_CHAINS = [
  { chain: base, name: "Base", rpc: "https://mainnet.base.org" },
  { chain: arbitrum, name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc" },
  { chain: mainnet, name: "Ethereum", rpc: "https://eth.llamarpc.com" },
] as const;

const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  // Base
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",     // Ethereum
};

const ERC20_BALANCE_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

export function registerGetWalletInfo(server: McpServer) {
  server.tool(
    "get_wallet_info",
    "Get the agent wallet's address and balances (native + USDC) across Base, Arbitrum, and Ethereum.",
    {},
    async () => {
      try {
        const privateKey = process.env.AGENT_PRIVATE_KEY;
        if (!privateKey) {
          return {
            content: [{ type: "text" as const, text: "Error: AGENT_PRIVATE_KEY environment variable is not set." }],
            isError: true,
          };
        }

        const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
        const account = privateKeyToAccount(key as `0x${string}`);
        const address = account.address;

        const balanceLines: string[] = [];

        const results = await Promise.all(
          DEMO_CHAINS.map(async ({ chain, name, rpc }) => {
            const rpcUrl = process.env[`RPC_URL_${chain.id}`] ?? rpc;
            const client = createPublicClient({
              chain,
              transport: http(rpcUrl),
            });

            // Fetch native + USDC balance in parallel
            const usdcAddr = USDC_ADDRESSES[chain.id];
            const [nativeBal, usdcBal] = await Promise.all([
              client.getBalance({ address }).catch(() => 0n),
              usdcAddr
                ? client.readContract({
                    address: usdcAddr,
                    abi: ERC20_BALANCE_ABI,
                    functionName: "balanceOf",
                    args: [address],
                  }).catch(() => 0n)
                : Promise.resolve(0n),
            ]);

            const nativeFormatted = formatUnits(nativeBal, 18);
            const usdcFormatted = formatUnits(usdcBal, 6);

            return {
              name,
              chainId: chain.id,
              native: `${parseFloat(nativeFormatted).toFixed(6)} ${chain.nativeCurrency.symbol}`,
              usdc: `${parseFloat(usdcFormatted).toFixed(2)} USDC`,
              hasBalance: nativeBal > 0n || usdcBal > 0n,
            };
          })
        );

        const lines = [
          `# Agent Wallet`,
          `**Address:** ${address}`,
          "",
          "## Balances",
        ];

        for (const r of results) {
          const marker = r.hasBalance ? "" : " (empty)";
          lines.push(`**${r.name}** (${r.chainId})${marker}`);
          lines.push(`  Native: ${r.native}`);
          lines.push(`  USDC: ${r.usdc}`);
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error getting wallet info: ${err}` }],
          isError: true,
        };
      }
    }
  );
}
