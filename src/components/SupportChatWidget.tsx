"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import {
  BreakEvenSummary,
  StoreAuditReport,
  SupportChatMessage,
} from "@/types/audit";
import {
  buildMailtoLink,
  buildWhatsAppLink,
  PORTFOLIO_URL,
} from "@/lib/agencyConfig";
import { RenderRichText } from "@/lib/renderRichText";
import { StoreDoctorPulseIcon } from "./StoreDoctorLogo";

interface SupportChatWidgetProps {
  activeReport: StoreAuditReport | null;
  breakEvenSummary: BreakEvenSummary | null;
  hasStickyBar: boolean;
}

export function SupportChatWidget({
  activeReport,
  breakEvenSummary,
  hasStickyBar,
}: SupportChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<SupportChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm **StoreDoctor Support**. Ask me about your store health score, replacing paid Shopify apps with native code, or getting a fixed-price quote.",
      timestamp: new Date().toISOString(),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const quickStarters = activeReport
    ? [
        `What should I fix first on ${activeReport.domain}?`,
        "How fast does native code pay for itself?",
        "How do I send my Prescription Plan to Bola?",
      ]
    : [
        "How does the Shopify URL audit work?",
        "Which paid apps slow stores down most?",
        "How fast do custom native fixes ship?",
      ];

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isStreaming) return;

    const userMsg: SupportChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    const assistantId = `a-${Date.now()}`;
    setMessages([
      ...nextHistory,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      },
    ]);
    if (!textOverride) setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextHistory,
          activeReport,
          breakEvenSummary,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "Support assistant is temporarily offline. You can reach Bola directly via Email or WhatsApp below.",
                }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snap = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: snap } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "Connection interrupted. Please try sending your question again.",
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content: activeReport
          ? `Fresh chat ready for **${activeReport.shopName}** (${activeReport.overallScore}%). How can I help?`
          : "Fresh chat ready. Ask me anything about Shopify store diagnostics or native app replacement!",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const bottomOffsetClass = hasStickyBar ? "bottom-20 sm:bottom-20" : "bottom-4 sm:bottom-5";

  return (
    <div className={`fixed right-4 sm:right-5 ${bottomOffsetClass} z-50 no-print`}>
      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="StoreDoctor AI Customer Support Chat"
          className="mb-3 w-[calc(100vw-2rem)] sm:w-[390px] max-h-[min(560px,76dvh)] rounded-2xl border border-[var(--sd-border)] bg-[var(--sd-surface)] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[var(--sd-ink)] text-[var(--sd-bg)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <StoreDoctorPulseIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold leading-tight truncate">
                  StoreDoctor Support
                </p>
                <p className="text-[12px] opacity-80 truncate">
                  {activeReport
                    ? `Context: ${activeReport.domain} (${activeReport.overallScore}%)`
                    : "AI Store Diagnostic Assistant"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset support conversation"
                className="p-1.5 rounded-lg opacity-80 hover:opacity-100 hover:bg-white/10 sd-transition cursor-pointer"
                title="New conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close support chat"
                className="p-1.5 rounded-lg opacity-80 hover:opacity-100 hover:bg-white/10 sd-transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[var(--sd-bg)]"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 space-y-1 ${
                    msg.role === "user"
                      ? "bg-[var(--sd-ink)] text-[var(--sd-bg)] rounded-br-sm"
                      : "bg-[var(--sd-surface)] border border-[var(--sd-border)] text-[var(--sd-ink)] rounded-bl-sm"
                  }`}
                >
                  {msg.content ? (
                    <RenderRichText
                      content={msg.content}
                      compact
                      tone={msg.role === "user" ? "inverted" : "default"}
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--sd-ink-muted)]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--sd-emerald)]" />
                      Thinking...
                    </span>
                  )}
                </div>
              </div>
            ))}

            {messages.length <= 2 && !isStreaming && (
              <div className="pt-1 flex flex-wrap gap-1.5">
                {quickStarters.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="text-left text-[12px] font-medium px-2.5 py-1.5 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-surface)] text-[var(--sd-ink)] hover:border-[var(--sd-emerald)] sd-transition cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input + Direct Human Handoff */}
          <div className="p-3 border-t border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your store audit or ROI..."
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--sd-border)] bg-[var(--sd-bg)] text-[13px] text-[var(--sd-ink)] focus:outline-none focus:border-[var(--sd-emerald)]"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className="w-9 h-9 rounded-xl bg-[var(--sd-emerald)] text-white flex items-center justify-center hover:opacity-92 disabled:opacity-45 sd-transition cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[12px] text-[var(--sd-ink-muted)] px-0.5">
              <span>Talk to Bola:</span>
              <div className="flex items-center gap-3 font-medium">
                <a
                  href={buildMailtoLink(
                    `StoreDoctor Question${activeReport ? ` (${activeReport.domain})` : ""}`,
                    "Hi Bola, I have a question about optimizing my Shopify store:"
                  )}
                  className="inline-flex items-center gap-1 hover:text-[var(--sd-ink)]"
                >
                  <Mail className="w-3 h-3" />
                  Email
                </a>
                <a
                  href={buildWhatsAppLink(
                    `Hi Bola, I just ran a StoreDoctor audit${activeReport ? ` on ${activeReport.domain}` : ""} and had a quick question.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--sd-emerald-ink)] hover:underline"
                >
                  <MessageCircle className="w-3 h-3" />
                  WhatsApp
                </a>
                <a
                  href={PORTFOLIO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[var(--sd-ink)]"
                >
                  <Globe className="w-3 h-3" />
                  Portfolio
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Support Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close AI support chat" : "Open AI customer support chat"}
        className="ml-auto flex items-center gap-2.5 rounded-full border border-[var(--sd-border)] bg-[var(--sd-ink)] text-[var(--sd-bg)] shadow-lg px-3.5 py-2.5 sm:px-4 sm:py-2.5 hover:scale-[1.02] sd-transition cursor-pointer"
      >
        <span className="relative flex items-center justify-center">
          <StoreDoctorPulseIcon className="w-5 h-5" />
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--sd-emerald)] ring-2 ring-[var(--sd-ink)]"
            aria-hidden="true"
          />
        </span>
        <span className="hidden sm:inline text-[13px] font-semibold whitespace-nowrap">
          {isOpen ? "Hide Support" : "AI Support"}
        </span>
      </button>
    </div>
  );
}
