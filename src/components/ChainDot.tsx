export const CHAIN_COLORS: Record<string, string> = {
  ethereum: "bg-[#627EEA]",
  optimism: "bg-[#FF0420]",
  bsc: "bg-[#F0B90B]",
  gnosis: "bg-[#04795B]",
  unichain: "bg-[#FF007A]",
  polygon: "bg-[#8247E5]",
  monad: "bg-[#836EF9]",
  sonic: "bg-[#5B6DEF]",
  mantle: "bg-zinc-400",
  base: "bg-[#0052FF]",
  arbitrum: "bg-[#12AAFF]",
  celo: "bg-[#FCFF52]",
  avalanche: "bg-[#E84142]",
  linea: "bg-[#61DFFF]",
  berachain: "bg-[#CC7722]",
  scroll: "bg-[#FFEEDA]",
  katana: "bg-[#FF4444]",
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
