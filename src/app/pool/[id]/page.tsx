import Link from "next/link";
import { notFound } from "next/navigation";
import { formatProtocolName, formatTvl, formatApr } from "@/lib/utils";
import { YieldCard } from "@/components/pool-detail/YieldCard";
import { VaultInfoCard } from "@/components/pool-detail/VaultInfoCard";
import { SimulationCard } from "@/components/pool-detail/SimulationCard";
import { DepositFlow } from "@/components/DepositFlow";
import { ChainBadge } from "@/components/ChainDot";
import { ProtocolLogoServer } from "@/components/ProtocolLogo";
import { queryPoolById } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export default async function PoolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const autoDeposit = sp.deposit === "1";
  const pool = await queryPoolById(id);

  if (!pool) {
    notFound();
  }

  const organicRatio = pool.yield.apr_total > 0
    ? Math.round(((pool.yield.apr_base ?? 0) / pool.yield.apr_total) * 100)
    : null;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-6 sm:px-8 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-sm font-medium transition-colors mb-6 hover:opacity-80"
        style={{ color: "var(--primary)" }}
      >
        &larr; Back to vaults
      </Link>

      {/* Hero: Pool name + centered deposit */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-1">
          <ProtocolLogoServer protocol={pool.protocol} size={36} />
          <h1 className="text-3xl font-extrabold font-[family-name:var(--font-manrope)] tracking-tight" style={{ color: "var(--on-surface)" }}>
            {formatProtocolName(pool.protocol)}{" "}
            <span className="font-normal" style={{ color: "var(--on-surface-variant)" }}>{pool.symbol}</span>
          </h1>
        </div>
        <div className="flex items-center justify-center gap-3 mt-3 flex-wrap" style={{ color: "var(--outline)" }}>
          <ChainBadge
            chain={pool.chain}
            className="px-3 py-0.5"
            style={{ backgroundColor: "var(--secondary-container)", color: "var(--on-secondary-container)" }}
          />
          <span className="text-sm font-semibold" style={{ color: "var(--secondary)" }}>
            {formatApr(pool.yield.apr_total)} APY
          </span>
          <span className="text-sm">{formatTvl(pool.tvl_usd)} TVL</span>
          {organicRatio !== null && (
            <span className="text-xs">{organicRatio}% organic</span>
          )}
        </div>

        {/* Centered DepositFlow */}
        <div className="flex justify-center mt-6">
          <DepositFlow pool={pool} autoOpen={autoDeposit} />
        </div>
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <YieldCard pool={pool} />
        <VaultInfoCard pool={pool} />
      </div>
      <div className="space-y-5">
        <SimulationCard pool={pool} />
      </div>
    </div>
  );
}
