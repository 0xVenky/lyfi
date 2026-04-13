"use client";

import { useState, useEffect, useRef } from "react";
import { computeSimulation, formatUsd } from "@/lib/utils";

const STORAGE_KEY = "yeelds_deposit_amount";
const DEFAULT_DEPOSIT = 1000;

function getStoredDeposit(): number {
  if (typeof window === "undefined") return DEFAULT_DEPOSIT;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_DEPOSIT;
}

export function SimulationTooltip({
  aprTotal,
  children,
}: {
  aprTotal: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deposit, setDeposit] = useState(DEFAULT_DEPOSIT);
  const [inputValue, setInputValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDeposit(getStoredDeposit());
  }, []);

  const sim = computeSimulation(aprTotal, deposit);

  function saveDeposit() {
    const val = Number(inputValue);
    if (!isNaN(val) && val > 0) {
      setDeposit(val);
      localStorage.setItem(STORAGE_KEY, String(val));
    }
    setEditing(false);
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        setOpen(false);
        setEditing(false);
      }}
      ref={ref}
    >
      {children}
      {open && (
        <div
          className="absolute bottom-full right-0 mb-2 z-50 w-64 rounded-2xl p-4 shadow-lg"
          style={{
            backgroundColor: "var(--surface-container-lowest)",
            boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)",
          }}
          role="tooltip"
        >
          <div className="text-xs mb-3" style={{ color: "var(--on-surface-variant)" }}>
            ${deposit.toLocaleString()} deposit estimate:
          </div>
          <dl className="space-y-1.5 text-sm tabular-nums">
            <div className="flex justify-between">
              <dt style={{ color: "var(--on-surface-variant)" }}>Daily</dt>
              <dd className="font-semibold" style={{ color: "var(--on-surface)" }}>{formatUsd(sim.daily_earnings_per_1k)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--on-surface-variant)" }}>Monthly</dt>
              <dd className="font-semibold" style={{ color: "var(--on-surface)" }}>{formatUsd(sim.monthly_earnings_per_1k)}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--on-surface-variant)" }}>Yearly</dt>
              <dd className="font-semibold" style={{ color: "var(--on-surface)" }}>{formatUsd(sim.yearly_earnings_per_1k)}</dd>
            </div>
          </dl>

          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--surface-container-high)" }}>
            {editing ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveDeposit();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  placeholder="Amount ($)"
                  className="flex-1 rounded-lg px-2 py-1 text-xs border-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{
                    backgroundColor: "var(--surface-container-low)",
                    color: "var(--on-surface)",
                  }}
                  autoFocus
                  aria-label="Custom deposit amount"
                />
                <button
                  onClick={saveDeposit}
                  className="text-xs font-semibold"
                  style={{ color: "var(--secondary)" }}
                >
                  Set
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInputValue(String(deposit));
                  setEditing(true);
                }}
                className="text-xs transition-colors hover:opacity-80"
                style={{ color: "var(--primary)" }}
              >
                Change deposit amount
              </button>
            )}
          </div>

          <p className="text-[10px] mt-2 leading-tight" style={{ color: "var(--outline)" }}>
            Estimates based on current APY. Actual returns may vary.
          </p>
        </div>
      )}
    </div>
  );
}
