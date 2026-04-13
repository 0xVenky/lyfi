"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "yeelds_disclaimer_dismissed";

export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== "true") {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  }

  if (dismissed) return null;

  return (
    <div
      className="px-4 py-2.5 text-sm flex items-center justify-between gap-4"
      style={{ backgroundColor: "var(--surface-container-low)", color: "var(--on-surface-variant)" }}
    >
      <p className="flex items-center gap-2">
        <span className="material-symbols-outlined text-amber-500 text-[18px]">warning</span>
        <span>
          Yeelds doesn&apos;t audit nor endorse any of the protocols listed. We just focus on providing accurate data. Ape at your own risk.
        </span>
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 transition-colors hover:opacity-70"
        style={{ color: "var(--outline)" }}
        aria-label="Dismiss disclaimer"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}
