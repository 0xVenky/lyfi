import type { RiskDetail } from "@/lib/types";

function RiskRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt style={{ color: "var(--on-surface-variant)" }}>{label}</dt>
      <dd className="tabular-nums font-medium" style={{ color: "var(--on-surface)" }}>{value}</dd>
    </div>
  );
}

export function RiskCard({ risk }: { risk: RiskDetail }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--surface-container-lowest)" }}>
      <h2
        className="text-sm font-medium uppercase tracking-wider mb-4 font-[family-name:var(--font-manrope)]"
        style={{ color: "var(--on-surface-variant)" }}
      >
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
