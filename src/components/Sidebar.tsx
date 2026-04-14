"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type NavItem = {
  label: string;
  icon?: string;
  param?: Record<string, string>;
  href?: string;
};

const DISCOVER_ITEMS: NavItem[] = [
  { label: "Discover", icon: "explore", param: {} },
  { label: "Earn", icon: "savings", href: "/earn" },
  { label: "AI Chat", icon: "smart_toy", href: "/chat" },
  { label: "Zap In", icon: "bolt", href: "/zap" },
  { label: "Portfolio", icon: "account_balance_wallet", href: "/portfolio" },
  { label: "Rescue", icon: "shield", href: "/rescue" },
  { label: "AI Agent", icon: "psychology", href: "/agent" },
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
      <div className="px-5 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="font-[family-name:var(--font-manrope)] font-extrabold text-lg tracking-tight" style={{ color: "var(--primary)" }}>
              Lyfi
            </div>
            <div className="font-[family-name:var(--font-manrope)] uppercase tracking-[0.2em] text-[9px] font-semibold" style={{ color: "var(--outline)" }}>
              Yield Finder
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6" aria-label="Main navigation">
        <Section title="Discover">
          {DISCOVER_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => navigateTo(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item) ? "font-semibold" : "hover:translate-x-0.5"
              }`}
              style={{
                color: isActive(item) ? "var(--primary)" : "var(--on-surface-variant)",
                backgroundColor: isActive(item) ? "var(--surface-container-lowest)" : "transparent",
                borderRight: isActive(item) ? "3px solid var(--primary)" : "3px solid transparent",
              }}
              aria-current={isActive(item) ? "page" : undefined}
            >
              {item.icon && (
                <span
                  className="text-[18px] material-symbols-outlined"
                  style={{ color: isActive(item) ? "var(--primary)" : "var(--outline)" }}
                >
                  {item.icon}
                </span>
              )}
              <span className="font-[family-name:var(--font-manrope)] uppercase tracking-[0.15em] text-[10px] font-bold">
                {item.label}
              </span>
            </button>
          ))}
        </Section>
      </nav>

      {/* Bottom */}
      <div className="px-5 py-3 text-[10px]" style={{ color: "var(--outline)" }}>
        Powered by LI.FI Earn API
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="absolute top-3 left-3 z-30 p-2 rounded-xl md:hidden transition-colors"
        style={{ backgroundColor: "var(--surface-container-lowest)", color: "var(--on-surface-variant)" }}
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
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative w-64 h-full overflow-y-auto shadow-2xl"
            style={{ backgroundColor: "var(--surface-container-low)" }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 transition-colors"
              style={{ color: "var(--outline)" }}
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
      <aside
        className="hidden md:flex md:flex-col md:w-60 md:shrink-0 h-screen sticky top-0 overflow-y-auto"
        style={{ backgroundColor: "var(--surface-container-low)" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.25em] font-[family-name:var(--font-manrope)]"
        style={{ color: "var(--outline)" }}
      >
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
