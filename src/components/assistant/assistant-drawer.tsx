"use client";

import * as React from "react";
import { Sparkles, MessageSquare } from "lucide-react";
import { useAppLocale } from "@/components/locale-provider";
import { ChatContainer } from "./chat-container";

export function AssistantDrawer() {
  const { locale } = useAppLocale();
  const isEnglish = locale === "en";
  const [isOpen, setIsOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Open Meridian Assistant"
          className="flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-lg bg-primary text-primary-foreground dark:bg-amber-400 dark:text-slate-950 font-semibold text-xs sm:text-sm shadow-lg border border-border/80 hover:border-amber-400/80 hover:shadow-xl active:scale-95 transition-all duration-150 cursor-pointer select-none"
        >
          <Sparkles className="size-4 text-amber-400 dark:text-slate-950 shrink-0" />
          <span className="font-heading tracking-tight">
            {isEnglish ? "Meridian Assistant" : "Konsultasi AI Meridian"}
          </span>
        </button>
      </div>

      {/* Slide-over Drawer / Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            className={`relative w-full h-[88vh] sm:h-[640px] bg-background border border-border shadow-2xl overflow-hidden rounded-t-lg sm:rounded-lg flex flex-col transition-all duration-200 animate-in slide-in-from-bottom-6 sm:slide-in-from-right-6 ${
              isExpanded ? "sm:max-w-4xl sm:h-[85vh]" : "sm:max-w-xl"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <ChatContainer
              isEnglish={isEnglish}
              onClose={() => setIsOpen(false)}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded((prev) => !prev)}
            />
          </div>
        </div>
      )}
    </>
  );
}
