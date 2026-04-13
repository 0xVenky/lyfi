"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function SortHeader({
  label,
  field,
  align,
}: {
  label: string;
  field: string;
  align?: "right";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort");
  const currentOrder = searchParams.get("order") ?? "desc";
  const isActive = currentSort === field;

  function toggleSort() {
    const params = new URLSearchParams(searchParams.toString());
    if (isActive) {
      params.set("order", currentOrder === "desc" ? "asc" : "desc");
    } else {
      params.set("sort", field);
      params.set("order", "desc");
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <th
      className={`sticky top-0 px-5 py-3.5 font-semibold cursor-pointer select-none transition-colors ${
        align === "right" ? "text-right" : ""
      }`}
      style={{
        backgroundColor: "var(--surface-container-low)",
        color: isActive ? "var(--primary)" : "var(--on-surface-variant)",
      }}
      onClick={toggleSort}
      aria-sort={isActive ? (currentOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span style={{ color: isActive ? "var(--primary)" : "var(--outline-variant)" }} aria-hidden="true">
          {isActive ? (currentOrder === "desc" ? "\u2193" : "\u2191") : "\u2195"}
        </span>
      </span>
    </th>
  );
}
