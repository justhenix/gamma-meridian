"use client";

import * as React from "react";
import { X, ExternalLink, ShieldCheck, FileText, Calendar, Building } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";
import type { Citation } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";

interface CitationModalProps {
  citation: Citation | null;
  onClose: () => void;
}

export function CitationModal({ citation, onClose }: CitationModalProps) {
  const t = useLocalizedMessage();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (citation) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [citation, onClose]);

  if (!citation) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="citation-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-card border border-border rounded-lg shadow-xl overflow-hidden p-6 text-foreground animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-xs text-primary dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 px-2.5 py-0.5 rounded">
                {citation.code}
              </span>
              {citation.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded">
                  <ShieldCheck className="size-3.5" />
                  {t(m.helpdesk_citation_verified)}
                </span>
              )}
            </div>
            <h3 id="citation-title" className="font-heading font-semibold text-base text-foreground leading-snug pt-1">
              {citation.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Details Grid */}
        <div className="py-4 space-y-3.5 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2.5 bg-muted/40 p-3 rounded-lg border border-border/60">
              <Building className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="block text-muted-foreground font-medium text-xs mb-0.5">
                  {t(m.helpdesk_citation_authority)}
                </span>
                <span className="font-semibold text-foreground text-xs">{citation.authority}</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 bg-muted/40 p-3 rounded-lg border border-border/60">
              <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="block text-muted-foreground font-medium text-xs mb-0.5">
                  {t(m.helpdesk_citation_locator)}
                </span>
                <span className="font-semibold text-foreground text-xs">{citation.locator}</span>
              </div>
            </div>
          </div>

          {citation.effectiveDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="size-4" />
              <span>{t(m.helpdesk_citation_effective)} <strong className="text-foreground font-medium">{citation.effectiveDate}</strong></span>
            </div>
          )}

          {/* Excerpt Box */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-semibold text-muted-foreground block">
              {t(m.helpdesk_citation_excerpt)}
            </span>
            <div className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-900 border-l-4 border-amber-500 border-y border-r border-border text-sm text-foreground leading-relaxed italic">
              &ldquo;{citation.excerpt}&rdquo;
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
          <a
            href={citation.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
          >
            <span>{t(m.helpdesk_citation_open_source)}</span>
            <ExternalLink className="size-3.5" />
          </a>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t(m.helpdesk_citation_close)}
          </Button>
        </div>
      </div>
    </div>
  );
}
