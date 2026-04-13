"use client";

import { useState, useRef, useEffect } from "react";
import { SUPPORTED_CHAINS, CHAIN_BY_ID } from "@/lib/constants";

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
        className="w-full flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-600 transition-colors"
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: selected?.color }}
        />
        <span className="flex-1 text-left">
          {selected?.name ?? "Select chain"}
        </span>
        <svg
          className={`h-4 w-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl">
          {SUPPORTED_CHAINS.map((chain) => (
            <button
              key={chain.chainId}
              onClick={() => {
                onChange(chain.chainId);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-700/50 transition-colors ${
                chain.chainId === selectedChainId
                  ? "bg-zinc-700/30 text-emerald-400"
                  : "text-zinc-300"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: chain.color }}
              />
              {chain.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
