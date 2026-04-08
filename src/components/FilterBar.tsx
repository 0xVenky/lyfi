"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { FiltersResponse } from "@/lib/types";

const TVL_OPTIONS = [
  { label: "Any TVL", value: "" },
  { label: "$100K+", value: "100000" },
  { label: "$1M+", value: "1000000" },
  { label: "$10M+", value: "10000000" },
  { label: "$100M+", value: "100000000" },
];

const APR_OPTIONS = [
  { label: "Any APR", value: "" },
  { label: "0–10%", min: "0", max: "10" },
  { label: "10–50%", min: "10", max: "50" },
  { label: "50–100%", min: "50", max: "100" },
  { label: "100%+", min: "100", max: "" },
];

const ACTION_OPTIONS = [
  { label: "All Actions", value: "" },
  { label: "Lending", value: "lending" },
  { label: "LP into AMM", value: "amm_lp" },
  { label: "Vault", value: "vault" },
  { label: "Staking", value: "staking" },
];

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  useEffect(() => {
    fetch("/api/v1/filters")
      .then((r) => r.json())
      .then(setFilters)
      .catch((e) => console.error("Failed to fetch filters:", e));
  }, []);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  function setAprRange(option: (typeof APR_OPTIONS)[number]) {
    const params = new URLSearchParams(searchParams.toString());
    if ("min" in option && option.min) {
      params.set("min_apr", option.min);
    } else {
      params.delete("min_apr");
    }
    if ("max" in option && option.max) {
      params.set("max_apr", option.max);
    } else {
      params.delete("max_apr");
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  function applyPreset(params: Record<string, string>) {
    const sp = new URLSearchParams(params);
    const qs = sp.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    const view = params.get("view");
    const cleared = new URLSearchParams();
    if (view) cleared.set("view", view);
    const qs = cleared.toString();
    router.push(qs ? `/?${qs}` : "/");
    setSearch("");
  }

  function handleSearch(value: string) {
    setSearch(value);
    setParam("search", value);
  }

  const activeCount = Array.from(searchParams.entries()).filter(
    ([k]) => !["view", "page", "limit"].includes(k),
  ).length;

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors cursor-pointer";
  const chipDefault =
    "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-600";

  return (
    <div className="px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-zinc-800/50 space-y-3">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors md:hidden"
        aria-expanded={mobileOpen}
        aria-controls="filter-panel"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {/* Filter row */}
      <div
        id="filter-panel"
        className={`flex-wrap items-center gap-2 ${mobileOpen ? "flex" : "hidden md:flex"}`}
      >
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search pools..."
            className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-gray-400 dark:focus:border-zinc-500 w-48"
            aria-label="Search pools"
          />
        </div>

        {/* Chain chip select */}
        <select
          value={searchParams.get("chain") ?? ""}
          onChange={(e) => setParam("chain", e.target.value)}
          className={`${chipBase} ${chipDefault}`}
          aria-label="Filter by chain"
        >
          <option value="">All Chains</option>
          {filters?.chains.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>

        {/* Protocol chip select */}
        <select
          value={searchParams.get("protocol") ?? ""}
          onChange={(e) => setParam("protocol", e.target.value)}
          className={`${chipBase} ${chipDefault}`}
          aria-label="Filter by protocol"
        >
          <option value="">All Protocols</option>
          {filters?.protocols.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} ({p.pool_count})
            </option>
          ))}
        </select>

        {/* Action chip select */}
        <select
          value={searchParams.get("pool_type") ?? ""}
          onChange={(e) => setParam("pool_type", e.target.value)}
          className={`${chipBase} ${chipDefault}`}
          aria-label="Filter by action"
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* TVL chip select */}
        <select
          value={searchParams.get("min_tvl") ?? ""}
          onChange={(e) => setParam("min_tvl", e.target.value)}
          className={`${chipBase} ${chipDefault}`}
          aria-label="Filter by TVL"
        >
          {TVL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* APR range chip select */}
        <select
          value={
            searchParams.get("min_apr") && searchParams.get("max_apr")
              ? `${searchParams.get("min_apr")}-${searchParams.get("max_apr")}`
              : searchParams.get("min_apr")
                ? `${searchParams.get("min_apr")}-`
                : ""
          }
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              setAprRange({ label: "", value: "" });
            } else {
              const match = APR_OPTIONS.find((o) => {
                if (!("min" in o)) return false;
                return `${o.min}-${o.max}` === val;
              });
              if (match) setAprRange(match);
            }
          }}
          className={`${chipBase} ${chipDefault}`}
          aria-label="Filter by APR range"
        >
          <option value="">Any APR</option>
          {APR_OPTIONS.filter((o) => "min" in o).map((o) => (
            <option key={o.label} value={`${"min" in o ? o.min : ""}-${"max" in o ? o.max : ""}`}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Presets dropdown */}
        <select
          value=""
          onChange={(e) => {
            const val = e.target.value;
            if (val === "stablecoin_vaults") {
              applyPreset({ exposure_category: "stablecoin", pool_type: "vault" });
            } else if (val === "maximize_eth") {
              applyPreset({ exposure: "ETH", sort: "apr_total", order: "desc" });
            }
          }}
          className={`${chipBase} ${chipDefault} ml-auto`}
          aria-label="Apply preset"
        >
          <option value="">Presets</option>
          <option value="stablecoin_vaults">Stablecoin Vaults</option>
          <option value="maximize_eth">Maximize ETH</option>
        </select>

        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            Clear ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
}
