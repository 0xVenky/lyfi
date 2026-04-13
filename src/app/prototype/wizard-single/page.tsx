"use client";

import { useState } from "react";

const MOCK_VAULTS = [
  { id: "1", protocol: "Aave V3", symbol: "USDC", chain: "Base", apy: 8.4, tvl: "$142M", risk: "Low", gasEst: "$0.12", tag: "Safest" },
  { id: "2", protocol: "Morpho", symbol: "USDC", chain: "Ethereum", apy: 12.1, tvl: "$89M", risk: "Medium", gasEst: "$2.40", tag: "Best yield" },
  { id: "3", protocol: "Euler V2", symbol: "USDC", chain: "Ethereum", apy: 15.3, tvl: "$34M", risk: "Medium", gasEst: "$2.80", tag: "Highest APY" },
];

export default function WizardSinglePrototype() {
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const vault = MOCK_VAULTS.find((v) => v.id === selectedVault);
  const amountNum = parseFloat(amount) || 0;
  const hasAmount = amountNum > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 overflow-auto">
      <p className="text-xs font-medium text-violet-600 uppercase tracking-widest mb-6">
        Prototype C — Single Smart Card
      </p>

      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white border border-gray-200 shadow-lg overflow-hidden">

          {/* Confirmed state */}
          {confirmed && vault ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center text-3xl text-emerald-500 mb-4">
                &#x2713;
              </div>
              <h2 className="text-lg font-bold text-gray-900">Deposited!</h2>
              <p className="text-sm text-gray-400 mt-1">
                {amount} {token} into {vault.protocol} at {vault.apy}% APY
              </p>
              <p className="text-sm text-emerald-600 font-medium mt-3">
                Earning ${((amountNum * vault.apy) / 100 / 365).toFixed(2)}/day
              </p>
              <button
                onClick={() => {
                  setConfirmed(false);
                  setSelectedVault(null);
                  setAmount("");
                }}
                className="mt-6 text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                Make another deposit
              </button>
            </div>
          ) : (
            <>
              {/* Amount input section */}
              <div className="p-6 pb-4">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Deposit
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) {
                        setAmount(e.target.value);
                        setSelectedVault(null);
                      }
                    }}
                    placeholder="0"
                    className="flex-1 text-4xl font-bold text-gray-900 bg-transparent placeholder:text-gray-200 focus:outline-none"
                    autoFocus
                  />
                  <button className="flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200 pl-3 pr-2.5 py-2.5 text-sm font-semibold text-gray-900 transition-colors shrink-0">
                    {token}
                    <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">on Ethereum</span>
                  <div className="text-xs text-gray-400">
                    <span>4,200 {token}</span>
                    <button className="text-violet-500 font-semibold ml-2 hover:text-violet-600">
                      Max
                    </button>
                  </div>
                </div>
              </div>

              {/* Vault recommendations — auto-appear when amount entered */}
              {hasAmount && (
                <div className="px-6 pb-2">
                  <div className="h-px bg-gray-100 mb-4" />
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    Recommended vaults
                  </label>
                  <div className="mt-3 space-y-2">
                    {MOCK_VAULTS.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVault(v.id)}
                        className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                          selectedVault === v.id
                            ? "border-violet-300 bg-violet-50/50 ring-1 ring-violet-200"
                            : "border-gray-100 hover:border-violet-200 hover:bg-gray-50"
                        }`}
                      >
                        {/* Radio circle */}
                        <div
                          className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedVault === v.id
                              ? "border-violet-600"
                              : "border-gray-200"
                          }`}
                        >
                          {selectedVault === v.id && (
                            <div className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                          )}
                        </div>

                        {/* Vault info */}
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {v.protocol}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                              {v.chain}
                            </span>
                            {v.tag && (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                v.tag === "Safest"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : v.tag === "Best yield"
                                    ? "bg-violet-50 text-violet-600"
                                    : "bg-amber-50 text-amber-600"
                              }`}>
                                {v.tag}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                            <span>TVL {v.tvl}</span>
                            <span>Gas ~{v.gasEst}</span>
                          </div>
                        </div>

                        {/* APY + earnings */}
                        <div className="text-right shrink-0">
                          <span className="text-lg font-bold text-emerald-600">
                            {v.apy}%
                          </span>
                          <p className="text-[10px] text-gray-400">
                            ${((amountNum * v.apy) / 100 / 365).toFixed(2)}/day
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm section — auto-appear when vault selected */}
              <div className="px-6 pb-6 pt-2">
                {vault && (
                  <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 mb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Daily earnings</span>
                      <span className="font-semibold text-emerald-600">
                        ${((amountNum * vault.apy) / 100 / 365).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Monthly</span>
                      <span className="font-semibold text-emerald-600">
                        ${(((amountNum * vault.apy) / 100 / 365) * 30).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Yearly</span>
                      <span className="font-semibold text-emerald-600">
                        ${((amountNum * vault.apy) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Est. gas</span>
                      <span className="text-gray-600">{vault.gasEst}</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => vault && setConfirmed(true)}
                  disabled={!vault}
                  className={`w-full rounded-2xl py-4 text-sm font-semibold transition-all ${
                    vault
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                      : hasAmount
                        ? "bg-gray-100 text-gray-400"
                        : "bg-gray-100 text-gray-300"
                  }`}
                >
                  {!hasAmount
                    ? "Enter amount"
                    : !vault
                      ? "Select a vault"
                      : `Deposit ${amount} ${token}`}
                </button>

                <p className="text-[10px] text-gray-300 text-center mt-3">
                  Cross-chain deposits powered by LI.FI
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
