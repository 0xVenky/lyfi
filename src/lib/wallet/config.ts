import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  mainnet, optimism, bsc, gnosis, unichain, polygon, monad, sonic,
  mantle, base, arbitrum, celo, avalanche, linea, berachain, scroll, katana,
} from "wagmi/chains";

export const chains = [
  mainnet, optimism, bsc, gnosis, unichain, polygon, monad, sonic,
  mantle, base, arbitrum, celo, avalanche, linea, berachain, scroll, katana,
] as const;

export const config = getDefaultConfig({
  appName: "Lyfi — DeFi Yield Discovery",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [...chains],
  ssr: true,
});
