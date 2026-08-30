"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";
import type { HelpdeskCase, HelpdeskCaseStatus } from "@/lib/assistant/types";
import { Button } from "@/components/ui/button";

interface CaseHeaderProps {
  caseData: HelpdeskCase;
  currentStatus: HelpdeskCaseStatus;
  onStatusChange: (newStatus: "waiting_for_client" | "resolved") => void | Promise<void>;
  isLeftOpen: boolean;
  onToggleLeft: () => void;
}

export function CaseHeader({
  caseData,
  currentStatus,
  onStatusChange,
  isLeftOpen,
  onToggleLeft,
}: CaseHeaderProps) {
  const t = useLocalizedMessage();
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleSelectStatus = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as HelpdeskCaseStatus;
    if (val !== "waiting_for_client" && val !== "resolved") return;
    setIsUpdating(true);
    try {
      await onStatusChange(val);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-card border-b border-border py-2.5 px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 select-none">
      {/* Left Back, Toggle & Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link href="/staff/helpdesk">
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 h-8 text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200"
            title={t(m.helpdesk_tab_all)}
          >
            <ArrowLeft className="size-4" />
          </Button>
        </Link>

        {/* Left Sidebar Collapse Toggle (Desktop) with gliding hover state */}
        <button
          type="button"
          onClick={onToggleLeft}
          title={t(m.helpdesk_toggle_left_sidebar)}
          className="hidden lg:flex items-center justify-center size-8 rounded-lg bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 hover:border-border transition-all duration-200 ease-out cursor-pointer active:scale-95"
        >
          {isLeftOpen ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4 text-primary dark:text-amber-400" />
          )}
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-foreground border border-border">
              {caseData.caseReference}
            </span>
            <h2 className="font-heading font-bold text-sm sm:text-base text-foreground truncate max-w-xs sm:max-w-sm md:max-w-md">
              {caseData.companyName}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block mt-0.5 truncate max-w-lg">
            {caseData.title}
          </p>
        </div>
      </div>

      {/* Right Controls: Status & Right Sidebar Toggle */}
      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
        <label htmlFor="case-status-select" className="text-xs text-muted-foreground font-medium whitespace-nowrap">
          {t(m.helpdesk_case_status_label)}
        </label>
        <div className="relative">
          <select
            id="case-status-select"
            value={currentStatus}
            onChange={handleSelectStatus}
            disabled={isUpdating || currentStatus === "resolved" || currentStatus === "closed"}
            className="h-8 pl-2.5 pr-8 text-xs font-semibold rounded-md bg-muted/70 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {currentStatus !== "waiting_for_client" && currentStatus !== "resolved" && currentStatus !== "closed" && (
              <option value={currentStatus} disabled>
                {currentStatus === "needs_expert"
                  ? t(m.helpdesk_status_needs_expert)
                  : currentStatus === "consultant_working"
                    ? t(m.helpdesk_status_consultant_working)
                    : t(m.helpdesk_status_ai_handling)}
              </option>
            )}
            <option value="waiting_for_client">{t(m.helpdesk_status_waiting_for_client)}</option>
            <option value="resolved">{t(m.helpdesk_status_resolved)}</option>
            {currentStatus === "closed" && <option value="closed">{t(m.helpdesk_status_closed)}</option>}
          </select>
        </div>

        {savedSuccess && (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check className="size-3" />
            {t(m.helpdesk_updated_badge)}
          </span>
        )}
      </div>
    </div>
  );
}
