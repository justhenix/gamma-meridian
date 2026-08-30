"use client";

import * as React from "react";
import { UserCheck, Sparkles } from "lucide-react";
import type { ChatMessage as ChatMessageType, Citation } from "@/lib/assistant/types";
import { StreamingText } from "./streaming-text";
import { RecommendationCard } from "./recommendation-card";

interface ChatMessageProps {
  message: ChatMessageType;
  isEnglish?: boolean;
  onCitationClick?: (citation: Citation) => void;
  onFollowUpClick?: (question: string) => void;
  onEscalate?: () => void;
  onStreamComplete?: () => void;
}

export function ChatMessage({
  message,
  isEnglish = false,
  onCitationClick,
  onFollowUpClick,
  onEscalate,
  onStreamComplete,
}: ChatMessageProps) {
  const isClient = message.sender === "client";
  const isConsultant = message.sender === "consultant";
  const isSystem = message.sender === "system";

  if (isSystem) {
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
          {message.body}
        </span>
      </div>
    );
  }

  if (isClient) {
    return (
      <div className="flex justify-end my-4 animate-in fade-in-0 duration-150">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-lg rounded-tr-xs bg-primary text-primary-foreground px-4 py-3 shadow-xs">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.body}</p>
          <span className="block text-xs text-slate-300/90 text-right mt-1.5 font-normal">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    );
  }

  if (isConsultant) {
    return (
      <div className="flex gap-3 my-5 items-start max-w-[92%] sm:max-w-[85%] animate-in fade-in-0 duration-150">
        <div className="size-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ring-2 ring-amber-300/80">
          <UserCheck className="size-4" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-semibold text-xs text-foreground">
              {message.authorName || "Meridian Senior Consultant"}
            </span>
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-300/60 dark:border-amber-800 px-2 py-0.5 rounded">
              {message.authorTitle || "Licensed Partner"}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="rounded-lg rounded-tl-xs bg-amber-50/40 dark:bg-slate-900/90 border border-amber-200/80 dark:border-amber-900/60 p-4 text-sm text-foreground shadow-xs leading-relaxed">
            <p className="whitespace-pre-wrap">{message.body}</p>
          </div>
        </div>
      </div>
    );
  }

  // AI Message
  return (
    <div className="flex gap-3 my-5 items-start max-w-[95%] sm:max-w-[90%] animate-in fade-in-0 duration-150">
      <div className="size-8 rounded-full bg-slate-900 text-amber-400 border border-amber-400/40 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
        <Sparkles className="size-4" />
      </div>

      <div className="flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="font-heading font-semibold text-xs text-foreground">
            Meridian Assistant
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="rounded-lg rounded-tl-xs bg-card border border-border p-4 text-sm text-foreground shadow-xs space-y-3">
          <StreamingText
            content={message.body}
            isStreaming={message.isStreaming}
            onStreamComplete={onStreamComplete}
          />

          {/* Subtle Legal Source Citations after actual answer */}
          {message.citations && message.citations.length > 0 && !message.isStreaming && (
            <div className="pt-2.5 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-foreground/80">
                {isEnglish ? "Sources:" : "Sumber:"}
              </span>
              {message.citations.map((citation, idx) => (
                <button
                  key={citation.id}
                  type="button"
                  onClick={() => onCitationClick?.(citation)}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span>{citation.code}</span>
                  {idx < message.citations!.length - 1 && (
                    <span className="text-muted-foreground/60">·</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Recommendation Card for Expert Escalation */}
          {message.escalationRecommended && !message.isStreaming && (
            <RecommendationCard
              isEnglish={isEnglish}
              freeEscalationConfirmed={message.freeEscalationConfirmed}
              state={message.escalationState || "recommended"}
              onEscalate={onEscalate}
            />
          )}
        </div>

        {/* Suggested Follow-up Questions */}
        {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && !message.isStreaming && (
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-medium text-muted-foreground block">
              {isEnglish ? "Suggested follow-ups:" : "Pertanyaan lanjutan terkait:"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {message.suggestedFollowUps.map((question, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onFollowUpClick?.(question)}
                  className="text-left text-xs px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted border border-border text-foreground transition-colors cursor-pointer select-none"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
