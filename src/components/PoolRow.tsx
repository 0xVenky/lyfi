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
      className="hover:bg-gray-50 dark:hover:bg-zinc-900/70 transition-colors cursor-pointer"
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
