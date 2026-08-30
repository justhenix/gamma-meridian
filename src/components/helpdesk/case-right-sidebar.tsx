"use client";

import * as React from "react";
import {
  Sparkles,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  PanelRightClose,
} from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";
import type { HandoffBrief, Citation } from "@/lib/assistant/types";
import { CitationModal } from "@/components/assistant/citation-modal";

interface CaseRightSidebarProps {
  handoffBrief: HandoffBrief;
  onClose?: () => void;
}

export function CaseRightSidebar({ handoffBrief, onClose }: CaseRightSidebarProps) {
  const t = useLocalizedMessage();
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);

  return (
    <aside className="w-full lg:w-80 xl:w-96 shrink-0 border-l border-border bg-card p-5 space-y-6 overflow-y-auto text-sm">
      {/* 1. Executive AI Briefing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="size-3" />
            </div>
            <h3 className="font-heading font-semibold text-xs text-muted-foreground">
              {t(m.helpdesk_ai_brief_title)}
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={t(m.helpdesk_toggle_right_sidebar)}
              className="hidden lg:flex size-6 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer active:scale-95"
            >
              <PanelRightClose className="size-3.5" />
            </button>
          )}
        </div>

        <div className="bg-muted/40 p-4 rounded-lg border border-border/70 space-y-3 text-xs">
          <div>
            <span className="text-xs font-semibold text-muted-foreground block mb-0.5">
              {t(m.helpdesk_client_objective)}
            </span>
            <p className="text-foreground leading-relaxed">{handoffBrief.clientIntent}</p>
          </div>

          <div className="pt-2 border-t border-border/50">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 block mb-0.5">
              {t(m.helpdesk_escalation_trigger)}
            </span>
            <p className="text-foreground leading-relaxed bg-amber-50/80 dark:bg-amber-950/40 p-2.5 rounded border border-amber-200/80 dark:border-amber-900/60 font-medium">
              {handoffBrief.escalationTrigger}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Statutory Risks & Verification Checklist */}
      {(handoffBrief.riskFlags.length > 0 || handoffBrief.missingFacts.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <h3 className="font-heading font-semibold text-xs text-muted-foreground">
              {t(m.helpdesk_risks_checklist_title)}
            </h3>
          </div>

          <div className="space-y-2.5">
            {/* Risk Flags */}
            {handoffBrief.riskFlags.map((risk) => (
              <div
                key={risk.id}
                className="p-3 rounded-lg bg-muted/30 border border-border/80 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{risk.title}</span>
                  <span className="text-xs font-medium px-2 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800">
                    {risk.severity} {t(m.helpdesk_risk_suffix)}
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">{risk.description}</p>
                {risk.statuteRef && (
                  <span className="text-xs text-foreground/80 font-medium block">
                    {t(m.helpdesk_reference_label)} {risk.statuteRef}
                  </span>
                )}
              </div>
            ))}

            {/* Missing Facts */}
            {handoffBrief.missingFacts.map((fact) => (
              <div
                key={fact.key}
                className="p-2.5 rounded-lg bg-background border border-border/70 flex items-start gap-2.5 text-xs"
              >
                {fact.status === "provided" && (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                {fact.status === "missing" && (
                  <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                {fact.status === "needs_verification" && (
                  <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">{fact.label}</span>
                    <span
                      className={`text-xs font-semibold capitalize whitespace-nowrap ${
                        fact.status === "provided"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : fact.status === "missing"
                            ? "text-rose-700 dark:text-rose-400"
                            : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {fact.status.replace("_", " ")}
                    </span>
                  </div>
                  {fact.value && (
                    <span className="text-xs text-muted-foreground block mt-0.5 truncate">
                      {fact.value}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Applicable Regulatory Sources */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <h3 className="font-heading font-semibold text-xs text-muted-foreground">
            {t(m.helpdesk_regulations_title)}
          </h3>
        </div>

        <div className="space-y-2">
          {handoffBrief.matchedRegulations.map((citation) => (
            <button
              key={citation.id}
              type="button"
              onClick={() => setSelectedCitation(citation)}
              className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/70 border border-border/80 hover:border-amber-400/80 transition-all cursor-pointer group space-y-1 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary dark:text-amber-400 group-hover:underline">
                  {citation.code}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {citation.title}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Statutory Citation Modal for Staff */}
      <CitationModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </aside>
  );
}
