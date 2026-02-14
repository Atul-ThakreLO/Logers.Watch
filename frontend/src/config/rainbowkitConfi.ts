import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { anvil, arbitrumSepolia, polygonMumbai, sepolia } from "viem/chains";

const config = getDefaultConfig({
  appName: "Logers.Watch",
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
  chains: [anvil, sepolia, arbitrumSepolia, polygonMumbai],
  ssr: true,
});

export default config;
