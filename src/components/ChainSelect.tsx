"use client";

import { useState, useRef, useEffect } from "react";
import { SUPPORTED_CHAINS, CHAIN_BY_ID } from "@/lib/constants";
import { ChainDot } from "./ChainDot";

export function ChainSelect({
  selectedChainId,
  onChange,
}: {
  selectedChainId: number;
  onChange: (chainId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = CHAIN_BY_ID[selectedChainId];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
        style={{ backgroundColor: "var(--surface-container-low)", color: "var(--on-surface)" }}
      >
        <ChainDot chain={selected?.network ?? ""} size={18} />
        <span className="flex-1 text-left">
          {selected?.name ?? "Select chain"}
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--outline)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-2xl shadow-lg"
          style={{ backgroundColor: "var(--surface-container-lowest)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.08)" }}
        >
          {SUPPORTED_CHAINS.map((chain) => {
            const isSelected = chain.chainId === selectedChainId;
            return (
              <button
                key={chain.chainId}
                onClick={() => {
                  onChange(chain.chainId);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: isSelected ? "var(--primary)" : "var(--on-surface)",
                  backgroundColor: isSelected ? "var(--surface-container-low)" : "transparent",
                }}
              >
                <ChainDot chain={chain.network} size={18} />
                {chain.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
