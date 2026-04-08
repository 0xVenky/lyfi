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
      className={`sticky top-0 bg-white dark:bg-zinc-950 px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-600 dark:hover:text-zinc-300 transition-colors ${
        align === "right" ? "text-right" : ""
      }`}
      onClick={toggleSort}
      aria-sort={isActive ? (currentOrder === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-gray-300 dark:text-zinc-600" aria-hidden="true">
          {isActive ? (currentOrder === "desc" ? "\u2193" : "\u2191") : "\u2195"}
        </span>
      </span>
    </th>
  );
}
