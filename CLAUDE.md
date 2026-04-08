@AGENTS.md

# Lyfi — LI.FI DeFi Mullet Hackathon Project

## What This Is
Fork of Yeelds for the LI.FI DeFi Mullet Hackathon #1 (Apr 8-14, 2026).
Yield discovery + one-click cross-chain deposits via LI.FI Composer.

## Stack
Next.js 16+ (App Router), TypeScript strict, Tailwind CSS 4, Zod 4.
wagmi + viem + RainbowKit 4.4 (wallet, to be added).

## Data Source
LI.FI Earn Data API (`earn.li.fi`) — sole data source. No DeFi Llama.
LI.FI Composer (`li.quest`) — deposit transaction builder.

## Key Decisions
- APY everywhere (LI.FI returns APY natively)
- 17 chains (full LI.FI Earn coverage)
- Composer API key server-side only (never exposed to client)

## Plan
See `/Users/venky/Projects/Yeelds/docs/plans/hackathon-lifi-mullet.md`
