import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, arbitrum } from "viem/chains";
import { CONFIG } from "./config.js";

const CHAIN_OBJECTS: Record<number, Chain> = {
  8453: base,
  42161: arbitrum,
};

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

function getAccount() {
  const key = CONFIG.AGENT_PRIVATE_KEY;
  if (!key) throw new Error("AGENT_PRIVATE_KEY not set");
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  return privateKeyToAccount(normalized as `0x${string}`);
}

function getLiveChain(chainId: number) {
  const cfg = CONFIG.LIVE_CHAINS.find((c) => c.chainId === chainId);
  if (!cfg) throw new Error(`Chain ${chainId} not configured for live mode`);
  return cfg;
}

function getClients(chainId: number) {
  const cfg = getLiveChain(chainId);
  const chain = CHAIN_OBJECTS[chainId];
  if (!chain) throw new Error(`No viem chain object for ${chainId}`);
  const account = getAccount();
  const transport = http(cfg.rpcUrl);
  return {
    public: createPublicClient({ chain, transport }),
    wallet: createWalletClient({ account, chain, transport }),
    account,
    cfg,
  };
}

export function getWalletAddress(): string {
  return getAccount().address;
}

export async function getNativeBalance(chainId: number): Promise<{ raw: bigint; formatted: string; usdEstimate: number }> {
  const { public: pub, account, cfg } = getClients(chainId);
  const bal = await pub.getBalance({ address: account.address });
  const formatted = formatUnits(bal, 18);
  // Rough ETH price estimate for display
  const ethPrice = 2000;
  return { raw: bal, formatted: `${parseFloat(formatted).toFixed(6)} ${cfg.nativeSymbol}`, usdEstimate: parseFloat(formatted) * ethPrice };
}

export async function getTokenBalance(chainId: number, tokenAddress: string, decimals: number): Promise<{ raw: bigint; formatted: number }> {
  const { public: pub, account } = getClients(chainId);
  const bal = await pub.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  return { raw: bal, formatted: parseFloat(formatUnits(bal, decimals)) };
}

export async function getUsdcBalance(chainId: number): Promise<{ raw: bigint; formatted: number }> {
  const cfg = getLiveChain(chainId);
  return getTokenBalance(chainId, cfg.usdcAddress, cfg.usdcDecimals);
}

export async function approveTokenIfNeeded(
  chainId: number,
  tokenAddress: string,
  spender: string,
  amount: bigint
): Promise<string | null> {
  const { public: pub, wallet, account } = getClients(chainId);
  const allowance = await pub.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, spender as `0x${string}`],
  });

  if (allowance >= amount) return null;

  console.log(`     Approving ${tokenAddress} for ${spender}...`);
  const hash = await wallet.writeContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender as `0x${string}`, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });

  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status === "reverted") throw new Error(`Approval reverted: ${hash}`);
  console.log(`     Approval confirmed: ${hash}`);
  return hash;
}

export interface ComposerQuote {
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  };
  estimate: {
    approvalAddress: string;
    toAmountMin: string;
    toAmount: string;
  };
  action: {
    fromToken: { address: string };
    toToken: { address: string };
  };
}

export async function getComposerQuote(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
}): Promise<ComposerQuote> {
  const url = new URL(`${CONFIG.COMPOSER_URL}/v1/quote`);
  url.searchParams.set("fromChain", String(params.fromChain));
  url.searchParams.set("toChain", String(params.toChain));
  url.searchParams.set("fromToken", params.fromToken);
  url.searchParams.set("toToken", params.toToken);
  url.searchParams.set("fromAmount", params.fromAmount);
  url.searchParams.set("fromAddress", params.fromAddress);
  url.searchParams.set("toAddress", params.fromAddress);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (CONFIG.LIFI_API_KEY) headers["x-lifi-api-key"] = CONFIG.LIFI_API_KEY;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Composer quote failed: ${res.status} ${body}`);
  }
  return (await res.json()) as ComposerQuote;
}

export async function executeTransaction(
  chainId: number,
  txRequest: { to: string; data: string; value: string; gasLimit?: string }
): Promise<{ hash: string; gasUsed: bigint; gasCostEth: number; explorerLink: string }> {
  const { public: pub, wallet, cfg } = getClients(chainId);

  const hash = await wallet.sendTransaction({
    to: txRequest.to as `0x${string}`,
    data: txRequest.data as `0x${string}`,
    value: BigInt(txRequest.value ?? "0"),
    gas: txRequest.gasLimit ? BigInt(txRequest.gasLimit) : undefined,
  });

  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status === "reverted") throw new Error(`Transaction reverted: ${hash}`);

  const gasCostWei = receipt.gasUsed * receipt.effectiveGasPrice;
  const gasCostEth = Number(gasCostWei) / 1e18;
  const explorerLink = `${cfg.explorerUrl}/tx/${hash}`;

  return { hash, gasUsed: receipt.gasUsed, gasCostEth, explorerLink };
}

/**
 * Print wallet balances on all live chains at startup.
 */
export async function printWalletStatus(): Promise<void> {
  const address = getWalletAddress();
  console.log(`   Wallet: ${address}`);
  console.log(`   Chains: ${CONFIG.LIVE_CHAINS.map((c) => c.name).join(", ")}`);
  console.log(`   ⚠️  LIVE MODE — real transactions will be executed\n`);
  console.log(`   Balances:`);

  for (const chain of CONFIG.LIVE_CHAINS) {
    try {
      const [native, usdc] = await Promise.all([
        getNativeBalance(chain.chainId),
        getUsdcBalance(chain.chainId),
      ]);
      const gasWarn = native.usdEstimate < CONFIG.MIN_GAS_BALANCE_USD ? " ⚠️ LOW GAS" : "";
      console.log(`   • ${chain.name}: ${usdc.formatted.toFixed(2)} USDC | ${native.formatted}${gasWarn}`);
    } catch (err) {
      console.log(`   • ${chain.name}: failed to fetch — ${(err as Error).message}`);
    }
  }
  console.log();
}
