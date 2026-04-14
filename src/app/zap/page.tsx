"use client";

import { useState } from "react";
import { ZapBox } from "@/components/ZapBox";
import { ZapWithdrawBox } from "@/components/ZapWithdrawBox";

export default function ZapPage() {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-12">
      <div className="text-center mb-8">
        <h1
          className="text-2xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]"
          style={{ color: "var(--on-surface)" }}
        >
          Zap
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--on-surface-variant)" }}>
          {mode === "deposit"
            ? "Deposit any token from any chain into any vault \u2014 one click."
            : "Withdraw from any vault back to the underlying token."}
        </p>
      </div>

      {/* Deposit / Withdraw toggle */}
      <div
        className="flex rounded-full p-1 mb-6 w-full max-w-md"
        style={{ backgroundColor: "var(--surface-container-high)" }}
      >
        <button
          onClick={() => setMode("deposit")}
          className="flex-1 rounded-full py-2.5 text-sm font-bold transition-all"
          style={
            mode === "deposit"
              ? { backgroundColor: "var(--surface-container-lowest)", color: "var(--on-surface)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
              : { color: "var(--outline)" }
          }
        >
          Deposit
        </button>
        <button
          onClick={() => setMode("withdraw")}
          className="flex-1 rounded-full py-2.5 text-sm font-bold transition-all"
          style={
            mode === "withdraw"
              ? { backgroundColor: "var(--surface-container-lowest)", color: "var(--on-surface)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
              : { color: "var(--outline)" }
          }
        >
          Withdraw
        </button>
      </div>

      {mode === "deposit" ? <ZapBox /> : <ZapWithdrawBox />}
    </div>
  );
}
