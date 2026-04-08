export const CHAIN_COLORS: Record<string, string> = {
  ethereum: "bg-blue-500",
  arbitrum: "bg-sky-400",
  base: "bg-blue-600",
};

export function ChainDot({ chain }: { chain: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${CHAIN_COLORS[chain] ?? "bg-gray-400 dark:bg-zinc-500"}`}
      title={chain.charAt(0).toUpperCase() + chain.slice(1)}
      aria-label={chain.charAt(0).toUpperCase() + chain.slice(1)}
    />
  );
}
