"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type NavItem = {
  label: string;
  param?: Record<string, string>;
  href?: string;
};

const DISCOVER_ITEMS: NavItem[] = [
  { label: "All Vaults", param: {} },
  { label: "Earn", href: "/earn" },
  { label: "AI Chat", href: "/chat" },
  { label: "Zap In", href: "/zap" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "AI Agent", href: "/agent" },
  { label: "About", href: "/about" },
];


export function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(item: NavItem): boolean {
    if (item.href) return pathname === item.href;
    if (item.param) {
      if (pathname !== "/") return false;
      if (Object.keys(item.param).length === 0) {
        return !searchParams.get("pool_type") && !searchParams.get("exposure_category") && !searchParams.get("sort");
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
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-lg font-bold font-[family-name:var(--font-geist-mono)] text-gray-900 tracking-tight">
          LYFI
        </span>
        <p className="text-[10px] text-gray-400 mt-0.5">By LI.FI Earn</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main navigation">
        <Section title="Discover">
          {DISCOVER_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => navigateTo(item)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                isActive(item)
                  ? "bg-violet-50 text-violet-700 font-medium border border-violet-100"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </Section>

      </nav>

      {/* Bottom */}
      <div className="px-5 py-3 border-t border-gray-100 text-[10px] text-gray-300">
        Powered by LI.FI Earn API
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="absolute top-3 left-3 z-30 p-2 rounded-lg bg-white border border-gray-200 text-gray-500 md:hidden"
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
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-56 h-full bg-white border-r border-gray-100 overflow-y-auto shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
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
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 border-r border-gray-100 bg-white h-screen sticky top-0 overflow-y-auto">
        {sidebarContent}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
