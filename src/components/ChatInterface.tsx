"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChatMessage } from "./ChatMessage";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type PortfolioInsight = {
  token: string;
  balanceUsd: number;
  vault: string;
  apr: number;
  yearlyEarnings: number;
  vaultId: string;
};

type PortfolioInsights = {
  totalIdleUsd: number;
  totalYearlyPotential: number;
  insights: PortfolioInsight[];
  updatedAt: number;
};

const SUGGESTED_PROMPTS = [
  "What are the best USDC vaults on Base?",
  "Compare ETH yield across chains",
  "Find vaults with >5% organic APY",
  "What's the safest stablecoin vault with highest TVL?",
];

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function loadPortfolioInsights(): PortfolioInsights | null {
  try {
    const raw = localStorage.getItem("yeelds:portfolio-insights");
    if (!raw) return null;
    const data = JSON.parse(raw) as PortfolioInsights;
    // Stale after 1 hour
    if (Date.now() - data.updatedAt > 3600_000) return null;
    if (!data.insights?.length) return null;
    return data;
  } catch {
    return null;
  }
}

function buildPortfolioContext(pi: PortfolioInsights): string {
  const lines = pi.insights.map(
    (i) => `- ${i.token}: ${fmtUsd(i.balanceUsd)} idle, best vault: ${i.vault} at ${i.apr.toFixed(1)}% APY (~${fmtUsd(i.yearlyEarnings)}/yr)`,
  );
  return `The user has ${fmtUsd(pi.totalIdleUsd)} in idle tokens that could earn ~${fmtUsd(pi.totalYearlyPotential)}/year:\n${lines.join("\n")}`;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [portfolioInsights, setPortfolioInsights] = useState<PortfolioInsights | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPortfolioInsights(loadPortfolioInsights());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const payload: { messages: Message[]; portfolioContext?: string } = { messages: newMessages };
      if (portfolioInsights) {
        payload.portfolioContext = buildPortfolioContext(portfolioInsights);
      }
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages([...newMessages, {
          role: "assistant",
          content: `Error: ${(err as { error?: string }).error ?? "Something went wrong. Please try again."}`,
        }]);
        return;
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) {
        setMessages([...newMessages, { role: "assistant", content: "No response received." }]);
        return;
      }

      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add empty assistant message that we'll update
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        // Update the last message
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
      }

      // Final update with complete content
      if (!assistantContent.trim()) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "I couldn't generate a response. Please try again." };
          return updated;
        });
      }
    } catch {
      setMessages([...newMessages, {
        role: "assistant",
        content: "Network error. Please check your connection and try again.",
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-gray-800">AI Yield Chat</h2>
                <p className="text-gray-500 text-sm max-w-md">
                  Ask me about yield vaults, compare APYs across chains, or get deposit quotes.
                  Powered by LI.FI Earn data.
                </p>
              </div>

              {/* Portfolio insight banner */}
              {portfolioInsights && (
                <div className="w-full max-w-lg rounded-2xl p-4" style={{ backgroundColor: "var(--primary-container)", boxShadow: "0 8px 40px rgba(25, 28, 30, 0.06)" }}>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: "var(--on-primary-container)" }}>
                      &#x1F4A1;
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: "var(--on-primary-container)" }}>
                        You have{" "}
                        <span className="font-semibold" style={{ color: "var(--on-primary)" }}>
                          {fmtUsd(portfolioInsights.totalIdleUsd)}
                        </span>{" "}
                        in idle tokens that could earn{" "}
                        <span className="font-semibold" style={{ color: "var(--on-primary)" }}>
                          ~{fmtUsd(portfolioInsights.totalYearlyPotential)}/yr
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {portfolioInsights.insights.slice(0, 3).map((ins) => (
                          <button
                            key={ins.vaultId}
                            onClick={() => sendMessage(`Tell me about the ${ins.vault} vault for ${ins.token}`)}
                            className="rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "var(--on-primary)" }}
                          >
                            {ins.token} &rarr; {ins.vault} {ins.apr.toFixed(1)}%
                          </button>
                        ))}
                      </div>
                      <Link
                        href="/portfolio"
                        className="inline-flex items-center gap-1 mt-2 text-xs transition-opacity hover:opacity-80"
                        style={{ color: "var(--on-primary-container)" }}
                      >
                        View portfolio &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50 text-sm text-gray-700 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))
          )}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about yield vaults..."
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="px-4 py-3 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          AI responses are based on current LI.FI data. Always verify before depositing.
        </p>
      </div>
    </div>
  );
}
