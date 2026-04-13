import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchVaults } from "./tools/search-vaults.js";
import { registerVaultDetails } from "./tools/vault-details.js";
import { registerDepositQuote } from "./tools/deposit-quote.js";
import { registerCompareVaults } from "./tools/compare-vaults.js";
import { registerExecuteDeposit } from "./tools/execute-deposit.js";
import { registerGetPortfolio } from "./tools/get-portfolio.js";
import { registerGetWalletInfo } from "./tools/get-wallet-info.js";

const server = new McpServer({
  name: "lyfi-earn",
  version: "1.0.0",
});

// Register all tools
registerSearchVaults(server);
registerVaultDetails(server);
registerDepositQuote(server);
registerCompareVaults(server);
registerExecuteDeposit(server);
registerGetPortfolio(server);
registerGetWalletInfo(server);

// Start with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
