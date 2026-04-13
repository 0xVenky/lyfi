# Lyfi — Hackathon Progress

**Deadline:** April 14, 2026 (09:00-12:00 ET submission window)
**Full plan:** `/Users/venky/Projects/Yeelds/docs/plans/hackathon-lifi-mullet.md`

## Completed

### Day 1 — Apr 8: Fork + Data Layer + UI

| Step | What | Status |
|------|------|--------|
| 1 | Fork and strip (remove DeFi Llama pipeline, asset-class routes, deals, feed) | Done |
| 2 | LI.FI Earn client + Zod 4 schemas (`src/lib/lifi/schemas.ts`, `client.ts`) | Done |
| 3 | Normalizer — LI.FI vault → PoolListItem (`src/lib/lifi/normalize.ts`) | Done |
| 4 | Cache rewrite (`src/lib/pipeline/cache.ts` → fetches from LI.FI) | Done |
| 5 | UI wiring — table shows 470 vaults, filters/sort/detail all work | Done |

**Key numbers:** 470 vaults, $43.8B TVL, 17 chains, 11 protocols, ~1s fetch time.

### Day 2 — Apr 8-9: Wallet + Vault Detail + Sidebar

| Step | What | Status |
|------|------|--------|
| 6 | Wallet setup (wagmi 3.6 + viem 2.47 + RainbowKit 2.2, 17 chains) | Done |
| 7 | WalletButton in header (RainbowKit ConnectButton) | Done |
| 8 | Vault detail page polish (VaultInfoCard replaces RiskCard, APY labels, deposit CTA) | Done |
| 9 | Sidebar cleanup (LYFI brand, dead routes removed, "Powered by LI.FI" footer) | Done |

**Fossy review:** 1 RED fixed (protocol_url now validated to https:// only), 2 YELLOWs noted (FilterBar 279 lines, lpTokens z.unknown). Zero `any` types. All checklist items pass.

### Files created/modified (Day 2, Steps 6-9)

```
NEW   src/lib/wallet/config.ts              — wagmi config, 17 viem chains, WalletConnect ID from env
NEW   src/app/providers.tsx                  — Dynamic SSR-safe wrapper
NEW   src/app/providers-inner.tsx            — WagmiProvider + QueryClient + RainbowKitProvider
NEW   src/components/WalletButton.tsx        — RainbowKit ConnectButton (compact, chain icon)
NEW   src/components/pool-detail/VaultInfoCard.tsx — Chain, type, stability, tokens, 7d APY
MOD   src/app/layout.tsx                     — Providers wrapper, title → "Lyfi"
MOD   src/components/Header.tsx              — WalletButton on right side
MOD   src/components/Sidebar.tsx             — Rewritten: LYFI brand, cleaned nav, LI.FI footer
MOD   src/app/pool/[id]/page.tsx             — VaultInfoCard, ChainDot, organic ratio
MOD   src/components/pool-detail/SimulationCard.tsx — APR→APY disclaimer
MOD   src/lib/lifi/normalize.ts              — safeProtocolUrl() validation (Fossy review fix)
```

### Gotchas discovered (Day 2)

- **Node.js 25 has broken global `localStorage`** — object exists but `getItem` is undefined. RainbowKit accesses it during SSR. Fixed with `dynamic(..., { ssr: false })` wrapper.
- **RainbowKit is v2.2** (not 4.4 as originally planned) — v4.4 doesn't exist. wagmi is v3.6.

## Next Up

### Day 3 — Apr 10: Deposit Flow

| Step | What | Owner | Blocked? |
|------|------|-------|----------|
| 10 | Composer API proxy (`/api/v1/quote`) | Mario | Need Composer API key |
| 11 | Deposit UI (amount → quote → sign → confirm) | Pixel | Needs Step 10 |
| 12 | Wire deposit into vault detail | Pixel | Needs Step 11 |

### Day 4 — Apr 11: Portfolio + Polish

| Step | What | Owner |
|------|------|-------|
| 13 | Portfolio page (user positions via LI.FI portfolio API) | Pixel |
| 14 | Withdrawal flow | Pixel |
| 15 | Polish + edge cases (loading/error states, mobile, a11y) | Both |

### Day 5 — Apr 12-13: Test + Deploy + Demo

| Step | What | Owner |
|------|------|-------|
| 16 | End-to-end testing with real funds ($5-10 USDC) | Mario |
| 17 | Vercel deploy (separate from yeelds.vercel.app) | Mario |
| 18 | Demo video (under 3 min) | Venky |
| 19 | Project description writeup | Venky |

### Day 6 — Apr 14: Submit

| Step | What |
|------|------|
| 20 | Final deploy check, push to public GitHub, tweet + Google form |

## Blockers for Venky

- [ ] WalletConnect Project ID from cloud.walletconnect.com (Day 2)
- [ ] Composer API key from portal.li.fi (Day 3)
- [ ] Register: https://forms.gle/RFLGG8RiEKC3AqnQA
- [ ] Join TG builders: https://t.me/lifibuilders
- [ ] Test funds: ~$20 USDC on Base + Arbitrum

## Known Issues / Gotchas

1. **LI.FI pagination broken** — cursor loops forever. Workaround: per-chain fetch + tag-filtered extras. Gets 470/675 vaults.
2. **TVL is a string** in API response (`analytics.tvl.usd`). Parsed in normalizer.
3. **"Trending" mode** is TVL-desc placeholder — no trend signal available from LI.FI.
4. **Field name mismatch** — types say `apr_*` but values are APY. `YIELD_UNIT = "APY"` in constants makes this explicit. Renaming all fields would touch every component — not worth it for hackathon.
5. **Node.js 25 localStorage** — global exists but `getItem` is undefined. Breaks RainbowKit SSR. Fixed via `dynamic({ ssr: false })` in providers.tsx.
6. **RainbowKit version** — v4.4 doesn't exist; installed v2.2.10 (latest). wagmi v3.6.1.
7. **FilterBar.tsx** — 279 lines (YELLOW). Acceptable for hackathon, refactor later.

## Optional Expansions (if core done by Day 4)

| Priority | What | Hours | Gate |
|----------|------|-------|------|
| 1 | AI Yield Agent (Claude tool use) | 4-5h | Core Steps 1-15 solid |
| 2 | CLI tool | 2-3h | Core Steps 1-15 solid |
| 3 | Telegram bot | 4-6h | Only if way ahead |
