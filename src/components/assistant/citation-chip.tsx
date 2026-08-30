"use client";

import * as React from "react";
import { BookOpen, CheckCircle2 } from "lucide-react";
import type { Citation } from "@/lib/assistant/types";

interface CitationChipProps {
  citation: Citation;
  onClick?: (citation: Citation) => void;
}

export function CitationChip({ citation, onClick }: CitationChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 mx-1 text-[13px] font-medium rounded-md bg-slate-100 hover:bg-amber-50 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 hover:border-amber-400/80 dark:hover:border-amber-500/80 transition-all cursor-pointer select-none group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
      title={`Click to view: ${citation.title}`}
    >
      <BookOpen className="size-3.5 text-slate-500 group-hover:text-amber-700 dark:text-slate-400 dark:group-hover:text-amber-400 shrink-0 transition-colors" />
      <span className="whitespace-nowrap">{citation.code}</span>
      {citation.verified && (
        <span title="Verified Statutory Source" className="inline-flex items-center">
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        </span>
      )}
    </button>
  );
}
