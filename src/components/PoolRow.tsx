"use client";

import { useRouter } from "next/navigation";

export function PoolRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      className="transition-colors cursor-pointer"
      style={{ borderBottom: "1px solid var(--surface-container-low)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-bright)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "";
      }}
      tabIndex={0}
      role="row"
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
