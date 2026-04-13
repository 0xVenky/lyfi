"use client";

import { useState } from "react";

// Mock data for prototyping
const MOCK_VAULTS = [
  { id: "1", protocol: "Aave V3", symbol: "USDC", chain: "Base", apy: 8.4, tvl: "$142M", risk: "Low", gasEst: "$0.12" },
  { id: "2", protocol: "Morpho", symbol: "USDC", chain: "Ethereum", apy: 12.1, tvl: "$89M", risk: "Medium", gasEst: "$2.40" },
  { id: "3", protocol: "Euler V2", symbol: "USDC", chain: "Ethereum", apy: 15.3, tvl: "$34M", risk: "Medium", gasEst: "$2.80" },
  { id: "4", protocol: "Fluid", symbol: "USDC", chain: "Arbitrum", apy: 6.9, tvl: "$210M", risk: "Low", gasEst: "$0.08" },
];

type WizardStep = 1 | 2 | 3;

export default function WizardStepperPrototype() {
  const [step, setStep] = useState<WizardStep>(1);
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [selectedVault, setSelectedVault] = useState<string | null>(null);

  const vault = MOCK_VAULTS.find((v) => v.id === selectedVault);
  const amountNum = parseFloat(amount) || 0;

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-10 overflow-auto">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-medium text-violet-600 uppercase tracking-widest mb-2">
            Prototype A — Vertical Stepper
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Earn Yield</h1>
          <p className="text-sm text-gray-400 mt-1">
            3 steps. Any token, any chain, best vault.
          </p>
        </div>

        {/* Step 1: What do you have? */}
        <div className="mb-6">
          <StepHeader number={1} title="What do you have?" active={step >= 1} />
          {step >= 1 && (
            <div className="ml-10 mt-3 p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    if (/^\d*\.?\d*$/.test(e.target.value)) setAmount(e.target.value);
                  }}
                  placeholder="1000"
                  className="flex-1 text-3xl font-bold text-gray-900 bg-transparent placeholder:text-gray-200 focus:outline-none"
                  autoFocus
                />
                <select
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="rounded-full bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 border-none focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  <option>USDC</option>
                  <option>USDT</option>
                  <option>ETH</option>
                  <option>WETH</option>
                  <option>DAI</option>
                </select>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">on Ethereum</span>
                <span className="text-xs text-gray-400">Balance: 4,200.00 USDC</span>
              </div>
              {step === 1 && (
                <button
                  onClick={() => amountNum > 0 && setStep(2)}
                  disabled={amountNum <= 0}
                  className="mt-4 w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-gray-200 disabled:text-gray-400 py-3 text-sm font-semibold text-white transition-colors"
                >
                  Find best vaults
                </button>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Pick a vault */}
        <div className="mb-6">
          <StepHeader number={2} title="Where should it go?" active={step >= 2} />
          {step >= 2 && (
            <div className="ml-10 mt-3 space-y-2">
              {MOCK_VAULTS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedVault(v.id);
                    setStep(3);
                  }}
                  className={`w-full p-4 rounded-2xl border text-left transition-all ${
                    selectedVault === v.id
                      ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                      : "border-gray-200 bg-white hover:border-violet-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">
                        {v.protocol}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {v.chain}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-emerald-600">
                        {v.apy}%
                      </span>
                      <span className="text-[10px] text-gray-400 ml-1">APY</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>TVL {v.tvl}</span>
                    <span>Risk: {v.risk}</span>
                    <span>Gas: {v.gasEst}</span>
                    {amountNum > 0 && (
                      <span className="ml-auto text-emerald-600 font-medium">
                        ${((amountNum * v.apy) / 100 / 365).toFixed(2)}/day
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Confirm */}
        <div className="mb-6">
          <StepHeader number={3} title="Confirm & deposit" active={step >= 3} />
          {step >= 3 && vault && (
            <div className="ml-10 mt-3 p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Depositing</span>
                  <span className="font-semibold text-gray-900">
                    {amount} {token}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Into</span>
                  <span className="font-semibold text-gray-900">
                    {vault.protocol} ({vault.chain})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">APY</span>
                  <span className="font-semibold text-emerald-600">{vault.apy}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Est. daily earnings</span>
                  <span className="font-semibold text-emerald-600">
                    ${((amountNum * vault.apy) / 100 / 365).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Gas cost</span>
                  <span className="text-gray-600">{vault.gasEst}</span>
                </div>
              </div>
              <button className="mt-5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-sm font-semibold text-white transition-colors">
                Deposit {amount} {token}
              </button>
              <p className="text-[10px] text-gray-300 text-center mt-2">
                Powered by LI.FI Composer
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({
  number,
  title,
  active,
}: {
  number: number;
  title: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
          active
            ? "bg-violet-600 text-white"
            : "bg-gray-100 text-gray-300"
        }`}
      >
        {number}
      </div>
      <span
        className={`text-sm font-semibold transition-colors ${
          active ? "text-gray-900" : "text-gray-300"
        }`}
      >
        {title}
      </span>
    </div>
  );
}
