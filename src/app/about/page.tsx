import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors mb-8"
      >
        &larr; Back to pools
      </Link>

      <article className="space-y-10 text-gray-600 dark:text-zinc-300 leading-relaxed">
        {/* What is Yeelds */}
        <section>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-4">What is Yeelds</h1>
          <p>
            Yeelds is a yield discovery platform for DeFi power users. It aggregates yield
            opportunities across Ethereum, Arbitrum, and Base, providing yield source
            decomposition (why is the APY what it is), risk signals (contract age, audits,
            TVL), and exposure-aware filtering (what tokens you are actually exposed to).
            Yeelds is discovery-only — browse, compare, and click through to protocols to
            deposit.
          </p>
        </section>

        {/* Data Sources */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">Data Sources</h2>
          <dl className="space-y-4">
            <div>
              <dt className="font-medium text-gray-800 dark:text-zinc-200">DeFi Llama</dt>
              <dd className="text-gray-500 dark:text-zinc-400 mt-1">
                Pool data including base APR, reward APR, TVL, impermanent loss estimates,
                and underlying token composition. Data refreshes every 15 minutes.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-800 dark:text-zinc-200">Block Explorers</dt>
              <dd className="text-gray-500 dark:text-zinc-400 mt-1">
                Contract age and verification status from Etherscan, Arbiscan, and
                Basescan. Enrichment runs every 6 hours.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-800 dark:text-zinc-200">Token Classifications</dt>
              <dd className="text-gray-500 dark:text-zinc-400 mt-1">
                Curated stability classifications, blue-chip flags, and peg targets for
                token metadata used in exposure analysis.
              </dd>
            </div>
          </dl>
        </section>

        {/* Methodology */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">Methodology</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-800 dark:text-zinc-200 mb-2">APR, not APY</h3>
              <p className="text-gray-500 dark:text-zinc-400">
                Yeelds displays Annual Percentage Rate (APR) — the non-compounded rate.
                APY (Annual Percentage Yield) assumes daily compounding, which overstates
                returns for most DeFi positions since compounding typically requires manual
                action or incurs gas fees. APR gives a more honest baseline.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 dark:text-zinc-200 mb-2">Exposure Classification</h3>
              <p className="text-gray-500 dark:text-zinc-400">
                Every pool is classified by token exposure: <strong>stablecoin</strong> (all
                underlying tokens are verified stablecoins), <strong>blue chip</strong> (ETH,
                WBTC, and top assets), <strong>volatile</strong> (small-cap or unverified
                tokens), or <strong>mixed</strong> (a combination). For vault positions,
                Yeelds unwraps one level deep to show the actual deposited assets.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 dark:text-zinc-200 mb-2">Risk Signals</h3>
              <p className="text-gray-500 dark:text-zinc-400">
                Contract age indicates how long a pool&apos;s smart contract has been deployed —
                older contracts have survived more market conditions. Verification status
                confirms the contract source code is publicly readable on the block
                explorer. These are signals, not guarantees of safety.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 dark:text-zinc-200 mb-2">Simulation Estimates</h3>
              <p className="text-gray-500 dark:text-zinc-400">
                The &ldquo;$1K deposit&rdquo; projections are simple calculations based on the current
                APR: <code className="text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 px-1 rounded">daily = deposit
                * (APR / 100) / 365</code>. These assume constant APR, which never happens
                in practice. They are not backtests and not predictions — just a quick way
                to compare relative earning potential.
              </p>
            </div>
          </div>
        </section>

        {/* What Yeelds is NOT */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">What Yeelds is NOT</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-500 dark:text-zinc-400">
            <li>Not financial advice. Yeelds is an informational tool, not a recommendation engine.</li>
            <li>Not real-time. Data refreshes periodically (every 15 minutes for pool data, every 6 hours for risk enrichment). Rates change constantly.</li>
            <li>Does not execute transactions. Yeelds links to protocols where you deposit directly.</li>
            <li>Does not guarantee accuracy of upstream data sources.</li>
          </ul>
        </section>

        {/* Disclaimers */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-4">Disclaimers</h2>
          <div className="space-y-3 text-gray-500 dark:text-zinc-400 text-sm">
            <p>
              DeFi protocols carry inherent risks including but not limited to smart contract
              vulnerabilities, economic exploits, oracle manipulation, governance attacks, and
              regulatory changes. Past yields do not guarantee future returns.
            </p>
            <p>
              Smart contract risk exists for all DeFi protocols regardless of audit status or
              contract age. Audits reduce but do not eliminate risk. Always do your own research
              before depositing funds.
            </p>
            <p>
              Yeelds aggregates data from third-party sources and makes no warranties about the
              completeness, accuracy, or timeliness of displayed information.
            </p>
          </div>
        </section>
      </article>
    </div>
  );
}
