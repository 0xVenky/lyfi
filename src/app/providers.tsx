"use client";

import dynamic from "next/dynamic";

// RainbowKit accesses localStorage during SSR, which breaks on Node.js 25
// (localStorage exists as a global but getItem is undefined).
// Wrap the actual providers in a dynamic import with ssr: false.
const ProvidersInner = dynamic(() => import("./providers-inner").then(m => ({ default: m.ProvidersInner })), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <ProvidersInner>{children}</ProvidersInner>;
}
