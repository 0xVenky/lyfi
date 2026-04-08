"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { key: "all", label: "All" },
  { key: "highest_yield", label: "Highest Yield" },
  { key: "safest", label: "Safest" },
  { key: "best_long_term", label: "Best Long Term" },
  { key: "trending", label: "Trending" },
] as const;

export function DiscoveryTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("view") ?? "all";

  function selectTab(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("view");
    } else {
      params.set("view", key);
    }
    // Reset to page 1 on tab change
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <nav className="flex gap-1 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-zinc-800 overflow-x-auto" aria-label="Discovery modes">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => selectTab(tab.key)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === tab.key
              ? "bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100"
              : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
          }`}
          aria-current={active === tab.key ? "page" : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
