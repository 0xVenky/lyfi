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
          className="absolute bottom-full right-0 mb-2 z-50 w-64 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 shadow-xl"
          role="tooltip"
        >
          <div className="text-xs text-gray-500 dark:text-zinc-400 mb-3">
            ${deposit.toLocaleString()} deposit estimate:
          </div>
          <dl className="space-y-1.5 font-[family-name:var(--font-geist-mono)] text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-zinc-400">Daily</dt>
              <dd className="text-gray-900 dark:text-zinc-100">{formatUsd(sim.daily_earnings_per_1k)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-zinc-400">Monthly</dt>
              <dd className="text-gray-900 dark:text-zinc-100">{formatUsd(sim.monthly_earnings_per_1k)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-zinc-400">Yearly</dt>
              <dd className="text-gray-900 dark:text-zinc-100">{formatUsd(sim.yearly_earnings_per_1k)}</dd>
            </div>
          </dl>

          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700">
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
                  className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-zinc-200 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  autoFocus
                  aria-label="Custom deposit amount"
                />
                <button
                  onClick={saveDeposit}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium"
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
                className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
              >
                Change deposit amount
              </button>
            )}
          </div>

          <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-2 leading-tight">
            Estimates based on current APY. Actual returns may vary.
          </p>
        </div>
      )}
    </div>
  );
}
