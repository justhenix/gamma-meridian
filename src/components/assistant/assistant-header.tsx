"use client";

import * as React from "react";
import { Sparkles, UserCheck, RefreshCw, X, Maximize2, Minimize2 } from "lucide-react";
import type { ClientConversationState } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";

interface AssistantHeaderProps {
  state: ClientConversationState;
  isEnglish?: boolean;
  onReset?: () => void;
  onClose?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function AssistantHeader({
  state,
  isEnglish = false,
  onReset,
  onClose,
  isExpanded,
  onToggleExpand,
}: AssistantHeaderProps) {
  const getStateBadge = () => {
    switch (state) {
      case "expert_joined":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-2.5 py-0.5 rounded-full">
            <UserCheck className="size-3" />
            {isEnglish ? "Expert joined" : "Konsultan bergabung"}
          </span>
        );
      case "waiting_for_expert":
      case "expert_requested":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-2.5 py-0.5 rounded-full">
            <UserCheck className="size-3 animate-pulse" />
            {isEnglish ? "Waiting for expert" : "Menunggu penelaahan ahli"}
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-0.5 rounded-full">
            {isEnglish ? "Resolved" : "Terselesaikan"}
          </span>
        );
      case "ai_assistant":
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/95 backdrop-blur-xs select-none">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm sm:text-base tracking-tight text-foreground">
              Meridian Assistant
            </span>
            {getStateBadge()}
          </div>
          <span className="text-xs text-muted-foreground mt-0.5">
            {isEnglish
              ? "Initial guidance for Indonesian tax and business matters"
              : "Panduan awal untuk urusan perpajakan dan bisnis di Indonesia"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title={isEnglish ? "Start new inquiry" : "Mulai konsultasi baru"}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <RefreshCw className="size-4" />
          </button>
        )}

        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            title={isExpanded ? "Restore size" : "Expand"}
            className="hidden sm:block p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title={isEnglish ? "Close assistant" : "Tutup"}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
