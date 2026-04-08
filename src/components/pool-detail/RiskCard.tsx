import type { RiskDetail } from "@/lib/types";

function RiskRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-[family-name:var(--font-geist-mono)] text-gray-700 dark:text-zinc-300">{value}</dd>
    </div>
  );
}

export function RiskCard({ risk }: { risk: RiskDetail }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 p-5">
      <h2 className="text-sm font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-4">
        Risk Signals
      </h2>
      <dl className="space-y-2 text-sm">
        <RiskRow
          label="Contract age"
          value={risk.contract_age_days !== null ? `${risk.contract_age_days}d` : "\u2014"}
        />
        <RiskRow
          label="Audited"
          value={
            risk.is_audited === null
              ? "\u2014"
              : risk.is_audited
                ? risk.audit_firms?.join(", ") ?? "Yes"
                : "No"
          }
        />
        <RiskRow
          label="Verified"
          value={risk.is_verified === null ? "\u2014" : risk.is_verified ? "Yes" : "No"}
        />
        <RiskRow
          label="LP concentration"
          value={
            risk.top_lp_concentration !== null
              ? `${(risk.top_lp_concentration * 100).toFixed(1)}%`
              : "\u2014"
          }
        />
        <RiskRow
          label="Admin key"
          value={risk.has_admin_key === null ? "\u2014" : risk.has_admin_key ? "Yes" : "No"}
        />
        <RiskRow label="Depeg risk" value={risk.underlying_depeg_risk ?? "\u2014"} />
      </dl>
    </div>
  );
}
