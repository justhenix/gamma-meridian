"use client";

import * as React from "react";
import { Send, UserCheck, Sparkles, User, PanelLeftOpen, PanelRightOpen } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";
import type { ChatMessage, Citation } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";
import { CitationChip } from "@/components/assistant/citation-chip";
import { CitationModal } from "@/components/assistant/citation-modal";

interface CaseThreadProps {
  messages: ChatMessage[];
  onSendMessage: (body: string) => void;
  isLeftOpen?: boolean;
  onToggleLeft?: () => void;
  isRightOpen?: boolean;
  onToggleRight?: () => void;
}

export function CaseThread({
  messages,
  onSendMessage,
  isLeftOpen = true,
  onToggleLeft,
  isRightOpen = true,
  onToggleRight,
}: CaseThreadProps) {
  const t = useLocalizedMessage();
  const [replyText, setReplyText] = React.useState("");
  const [activeCitation, setActiveCitation] = React.useState<Citation | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onSendMessage(replyText.trim());
    setReplyText("");
  };

  const renderMessageContent = (text: string, citations?: Citation[]) => {
    const parts = text.split(/(\[[^\]]+\])/g);
    return parts.map((part, idx) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        const code = part.slice(1, -1).trim();
        const matched = citations?.find(
          (c) =>
            c.code.toLowerCase() === code.toLowerCase() ||
            c.code.toLowerCase().includes(code.toLowerCase()) ||
            code.toLowerCase().includes(c.code.toLowerCase())
        );
        if (matched) {
          return (
            <CitationChip
              key={idx}
              citation={matched}
              onClick={(c) => setActiveCitation(c)}
            />
          );
        }
      }

      const lines = part.split("\n");
      return (
        <React.Fragment key={idx}>
          {lines.map((line, lIdx) => {
            const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
              <React.Fragment key={lIdx}>
                {lIdx > 0 && <br />}
                {boldParts.map((bPart, bIdx) => {
                  if (bPart.startsWith("**") && bPart.endsWith("**")) {
                    return (
                      <strong key={bIdx} className="font-semibold text-foreground">
                        {bPart.slice(2, -2)}
                      </strong>
                    );
                  }
                  return <span key={bIdx}>{bPart}</span>;
                })}
              </React.Fragment>
            );
          })}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Timeline Header with responsive workspace collapse & expand triggers */}
      <div className="px-4 sm:px-5 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between text-xs text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          {!isLeftOpen && onToggleLeft && (
            <button
              type="button"
              onClick={onToggleLeft}
              title={t(m.helpdesk_toggle_left_sidebar)}
              className="hidden lg:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/70 hover:bg-muted text-foreground text-xs font-semibold border border-border/80 hover:border-border transition-all duration-200 ease-out cursor-pointer active:scale-95 shadow-2xs group"
            >
              <PanelLeftOpen className="size-3.5 text-primary dark:text-amber-400 group-hover:scale-105 transition-transform" />
              <span>{t(m.helpdesk_expand_client_info)}</span>
            </button>
          )}
          <span className="font-heading font-semibold text-xs text-foreground">
            {t(m.helpdesk_transcript_title)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {messages.length} {t(m.helpdesk_messages_count)}
          </span>

          {!isRightOpen && onToggleRight && (
            <button
              type="button"
              onClick={onToggleRight}
              title={t(m.helpdesk_toggle_right_sidebar)}
              className="hidden lg:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/70 hover:bg-muted text-foreground text-xs font-semibold border border-border/80 hover:border-border transition-all duration-200 ease-out cursor-pointer active:scale-95 shadow-2xs group"
            >
              <span>{t(m.helpdesk_expand_case_assessment)}</span>
              <PanelRightOpen className="size-3.5 text-primary dark:text-amber-400 group-hover:scale-105 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.map((msg) => {
          const isClient = msg.sender === "client";
          const isAI = msg.sender === "ai";

          if (isClient) {
            return (
              <div key={msg.id} className="flex gap-3 items-start max-w-[85%]">
                <div className="size-7 rounded-full bg-slate-200 dark:bg-slate-800 text-foreground flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  <User className="size-3.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">{t(m.helpdesk_sender_client)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-card border border-border text-xs sm:text-sm text-foreground shadow-2xs leading-relaxed">
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                  </div>
                </div>
              </div>
            );
          }

          if (isAI) {
            return (
              <div key={msg.id} className="flex gap-3 items-start max-w-[90%]">
                <div className="size-7 rounded-full bg-slate-900 text-amber-400 border border-amber-400/40 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground">
                      {t(m.helpdesk_sender_ai)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-border text-xs sm:text-sm text-foreground/90 shadow-2xs leading-relaxed">
                    {renderMessageContent(msg.body, msg.citations)}
                  </div>
                </div>
              </div>
            );
          }

          // Consultant Message
          return (
            <div key={msg.id} className="flex gap-3 items-start max-w-[90%] ml-auto flex-row-reverse">
              <div className="size-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                <UserCheck className="size-3.5" />
              </div>
              <div className="space-y-1.5 flex-1 text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-semibold text-xs text-amber-800 dark:text-amber-400">
                    {msg.authorName || t(m.helpdesk_sender_consultant)}
                  </span>
                </div>
                <div className="p-3.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs sm:text-sm text-foreground text-left shadow-2xs leading-relaxed">
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Composer */}
      <form onSubmit={handleSend} className="p-4 bg-card border-t border-border space-y-3">
        <div className="relative">
          <textarea
            rows={3}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={t(m.helpdesk_reply_placeholder)}
            className="w-full resize-none bg-background p-3 text-xs sm:text-sm rounded-lg border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
          />
        </div>
        <div className="flex items-center justify-end">
          <Button
            type="submit"
            size="sm"
            variant="accent"
            disabled={!replyText.trim()}
            className="gap-1.5 cursor-pointer font-semibold text-xs shadow-xs"
          >
            <Send className="size-3.5" />
            <span>{t(m.helpdesk_send_button)}</span>
          </Button>
        </div>
      </form>

      {/* Citation Modal for Staff */}
      <CitationModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}
