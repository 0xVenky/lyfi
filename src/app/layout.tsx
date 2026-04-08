import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yeelds — DeFi Yield Discovery",
  description: "Discover and compare yield opportunities across EVM chains.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('yeelds_theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}`,
          }}
        />
        <DisclaimerBanner />
        <div className="relative flex flex-1 min-h-0">
          <Suspense><Sidebar /></Suspense>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
