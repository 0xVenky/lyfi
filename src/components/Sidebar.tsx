"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  label: string;
  param?: Record<string, string>;
  href?: string;
  disabled?: boolean;
  children?: NavItem[];
};

const DISCOVER_ITEMS: NavItem[] = [
  {
    label: "All Yields",
    param: {},
  },
  { label: "Projects", href: "/projects" },
  {
    label: "Stablecoins",
    href: "/stables",
    children: [
      { label: "USD", href: "/stables/usd" },
      { label: "EUR", href: "/stables/eur" },
    ],
  },
  { label: "ETH & LSTs", href: "/eth" },
  { label: "Bitcoin", href: "/btc" },
  { label: "RWA", href: "/rwa" },
  { label: "Yield-Bearing", href: "/yield-bearing" },
];

const RESEARCH_ITEMS: NavItem[] = [
  { label: "Yield Feed", href: "/feed" },
  { label: "Research", disabled: true },
  { label: "Copy trading", disabled: true },
  { label: "Bookmarked", disabled: true },
];

const DEALS_ITEMS: NavItem[] = [
  { label: "Liquidity Deals", href: "/deals" },
];

const PRESET_ITEMS: NavItem[] = [
  { label: "Stablecoin Vaults", param: { exposure_category: "stablecoin", pool_type: "vault" } },
  { label: "Maximize ETH", param: { exposure: "ETH", sort: "apr_total", order: "desc" } },
];

function buildUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `/?${qs}` : "/";
}

export function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stablesExpanded, setStablesExpanded] = useState(
    pathname.startsWith("/stables"),
  );

  function isActive(item: NavItem): boolean {
    // href-based items: match pathname
    if (item.href) return pathname === item.href;
    // param-based items: match when on home page with matching params
    if (item.param) {
      if (pathname !== "/") return false;
      if (Object.keys(item.param).length === 0) {
        // "All Yields" — active on home with no asset filters
        return !searchParams.get("pool_type") && !searchParams.get("exposure_category");
      }
      return Object.entries(item.param).every(([k, v]) => searchParams.get(k) === v);
    }
    return false;
  }

  function navigateTo(item: NavItem) {
    if (item.href) {
      router.push(item.href);
    } else if (item.param) {
      const qs = new URLSearchParams(item.param).toString();
      router.push(qs ? `/?${qs}` : "/");
    }
    setMobileOpen(false);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-zinc-800">
        <span className="text-lg font-bold font-[family-name:var(--font-geist-mono)] text-gray-900 dark:text-zinc-100 tracking-tight">
          YEELDS
        </span>
        <ThemeToggle />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main navigation">
        {/* DISCOVER */}
        <Section title="DISCOVER">
          {DISCOVER_ITEMS.map((item) => (
            <div key={item.label}>
              {item.children ? (
                <>
                  <button
                    onClick={() => {
                      setStablesExpanded(!stablesExpanded);
                      navigateTo(item);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item)
                        ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                        : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    <span>{item.label}</span>
                    <svg
                      className={`h-4 w-4 transition-transform ${stablesExpanded ? "rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {stablesExpanded && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {item.children.map((child) => (
                        <button
                          key={child.label}
                          onClick={() => navigateTo(child)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                            isActive(child)
                              ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-medium"
                              : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                          }`}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : item.disabled ? (
                <DisabledItem label={item.label} />
              ) : (
                <button
                  onClick={() => navigateTo(item)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive(item)
                      ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-medium"
                      : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </Section>

        {/* RESEARCH */}
        <Section title="RESEARCH">
          {RESEARCH_ITEMS.map((item) =>
            item.disabled ? (
              <DisabledItem key={item.label} label={item.label} />
            ) : (
              <button
                key={item.label}
                onClick={() => navigateTo(item)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive(item)
                    ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-medium"
                    : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200"
                }`}
              >
                {item.label}
              </button>
            )
          )}
        </Section>

        {/* DEALS */}
        <Section title="DEALS">
          {DEALS_ITEMS.map((item) => (
            <DisabledItem key={item.label} label={item.label} />
          ))}
        </Section>

        {/* PRESET */}
        <Section title="PRESET">
          {PRESET_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => navigateTo(item)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item)
                  ? "bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 font-medium"
                  : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/50 hover:text-gray-900 dark:hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </Section>
      </nav>

      {/* Bottom CTA */}
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="absolute top-3 left-3 z-30 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 md:hidden"
        aria-label="Open navigation"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-56 h-full bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 overflow-y-auto">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 h-screen sticky top-0 overflow-y-auto">
        {sidebarContent}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-600">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DisabledItem({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-300 dark:text-zinc-700 cursor-not-allowed">
      <span>{label}</span>
      <span className="text-[10px] text-gray-300 dark:text-zinc-700">Coming soon</span>
    </div>
  );
}
