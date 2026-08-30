"use client";

import * as React from "react";
import { User, Mail, MapPin, Briefcase, ShieldCheck, PanelLeftClose } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";
import type { HelpdeskCase } from "@/lib/assistant/types";

interface CaseLeftSidebarProps {
  caseData: HelpdeskCase;
  onClose?: () => void;
}

export function CaseLeftSidebar({ caseData, onClose }: CaseLeftSidebarProps) {
  const t = useLocalizedMessage();

  return (
    <aside className="w-full lg:w-72 xl:w-80 shrink-0 border-r border-border bg-card p-5 space-y-6 overflow-y-auto text-sm">
      {/* Client & Account Chunk */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-xs text-muted-foreground">
            {t(m.helpdesk_client_profile)}
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={t(m.helpdesk_toggle_left_sidebar)}
              className="hidden lg:flex size-6 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer active:scale-95"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-3 bg-muted/40 p-4 rounded-lg border border-border/70">
          <div>
            <span className="text-xs text-muted-foreground block mb-0.5">{t(m.helpdesk_company_entity)}</span>
            <span className="font-heading font-bold text-sm text-foreground block leading-tight">
              {caseData.companyName}
            </span>
          </div>

          <div className="pt-2 border-t border-border/50 grid grid-cols-1 gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <User className="size-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground">{caseData.clientName}</span>
            </div>

            <div className="flex items-center gap-2">
              <Mail className="size-3.5 text-muted-foreground shrink-0" />
              <a
                href={`mailto:${caseData.email}`}
                className="font-medium text-blue-700 dark:text-blue-400 hover:underline truncate"
              >
                {caseData.email}
              </a>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{caseData.primaryJurisdiction}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Matter & Intake Summary Chunk */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-xs text-muted-foreground">
            {t(m.helpdesk_intake_summary)}
          </h3>
          <span className="text-xs text-muted-foreground">
            {new Date(caseData.receivedAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-foreground text-xs font-medium border border-border">
            <Briefcase className="size-3 text-muted-foreground" />
            <span>{caseData.practiceArea}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/30 border border-border/70 text-xs text-foreground/90 leading-relaxed space-y-2">
            <p>{caseData.intakeSummary}</p>
          </div>
        </div>
      </div>

      {/* Assigned Lead Consultant */}
      {caseData.assignedConsultant && (
        <div className="space-y-2.5 pt-4 border-t border-border">
          <h3 className="font-heading font-semibold text-xs text-muted-foreground">
            {t(m.helpdesk_assigned_lead)}
          </h3>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/70">
            <div className="size-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center border border-amber-300 dark:border-amber-700/60 shrink-0">
              <ShieldCheck className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-heading font-semibold text-xs text-foreground block truncate">
                {caseData.assignedConsultant.name}
              </span>
              <span className="text-xs text-muted-foreground block truncate">
                {caseData.assignedConsultant.title}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
