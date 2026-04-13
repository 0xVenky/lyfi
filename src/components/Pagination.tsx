"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  page: number;
  totalPages: number;
  total: number;
};

export function Pagination({ page, totalPages, total }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(newPage));
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-6 sm:px-8 py-5 text-sm">
      <span style={{ color: "var(--outline)" }}>
        Page {page} of {totalPages} ({total} pools)
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => navigate(page - 1)}
          disabled={page <= 1}
          className="px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--surface-container-high)",
            color: "var(--on-surface-variant)",
          }}
        >
          Previous
        </button>
        <button
          onClick={() => navigate(page + 1)}
          disabled={page >= totalPages}
          className="px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--surface-container-high)",
            color: "var(--on-surface-variant)",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
