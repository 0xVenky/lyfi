import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/Sidebar";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lyfi — DeFi Yield Discovery",
  description: "Discover and deposit into 670+ yield vaults across 17 chains via LI.FI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} h-full antialiased`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-full flex flex-col font-[family-name:var(--font-inter)]"
        style={{ backgroundColor: "var(--surface)", color: "var(--on-surface)" }}
      >
        <Providers>
          <DisclaimerBanner />
          <div className="relative flex flex-1 min-h-0">
            <Suspense><Sidebar /></Suspense>
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
