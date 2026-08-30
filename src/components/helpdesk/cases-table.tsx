"use client";

import * as React from "react";
import Link from "next/link";
import { Search, AlertTriangle, Clock, ArrowRight, ShieldCheck, UserCheck, Sparkles } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";
import type { HelpdeskCase, CaseStatusFilter, HelpdeskCaseStatus, RiskLevel } from "@/lib/assistant/types";
import { SEED_HELPDESK_CASES } from "@/lib/assistant/mock-cases";

export function CasesTable() {
  const t = useLocalizedMessage();
  const [activeFilter, setActiveFilter] = React.useState<CaseStatusFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [cases] = React.useState<HelpdeskCase[]>(SEED_HELPDESK_CASES);

  const filterTabs: { id: CaseStatusFilter; label: string }[] = [
    { id: "all", label: t(m.helpdesk_tab_all) },
    { id: "new", label: t(m.helpdesk_tab_new) },
    { id: "needs_expert", label: t(m.helpdesk_tab_needs_expert) },
    { id: "ai_handling", label: t(m.helpdesk_tab_ai) },
    { id: "waiting", label: t(m.helpdesk_tab_waiting) },
    { id: "resolved", label: t(m.helpdesk_tab_resolved) },
  ];

  const getStatusBadge = (status: HelpdeskCaseStatus) => {
    switch (status) {
      case "needs_expert":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded">
            <AlertTriangle className="size-3 text-rose-600" />
            {t(m.helpdesk_status_needs_expert)}
          </span>
        );
      case "ai_handling":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-border px-2 py-0.5 rounded">
            <Sparkles className="size-3 text-amber-500" />
            {t(m.helpdesk_status_ai_handling)}
          </span>
        );
      case "consultant_working":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 px-2 py-0.5 rounded">
            <UserCheck className="size-3 text-amber-600" />
            {t(m.helpdesk_status_consultant_working)}
          </span>
        );
      case "waiting_for_client":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">
            <Clock className="size-3" />
            {t(m.helpdesk_status_waiting_for_client)}
          </span>
        );
      case "resolved":
      case "closed":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
            <ShieldCheck className="size-3 text-emerald-600" />
            {t(m.helpdesk_status_resolved)}
          </span>
        );
    }
  };

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case "high":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
            {t(m.helpdesk_risk_high)}
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
            {t(m.helpdesk_risk_medium)}
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-border">
            {t(m.helpdesk_risk_low)}
          </span>
        );
      default:
        return null;
    }
  };

  const filteredCases = React.useMemo(() => {
    return cases.filter((c) => {
      // Filter tab check
      if (activeFilter === "new" && c.status !== "needs_expert" && c.status !== "ai_handling") return false;
      if (activeFilter === "needs_expert" && c.status !== "needs_expert") return false;
      if (activeFilter === "ai_handling" && c.status !== "ai_handling") return false;
      if (activeFilter === "waiting" && c.status !== "waiting_for_client") return false;
      if (activeFilter === "resolved" && c.status !== "resolved" && c.status !== "closed") return false;

      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.caseReference.toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.practiceArea.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cases, activeFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {filterTabs.map((tab) => {
            const count = cases.filter((c) => {
              if (tab.id === "all") return true;
              if (tab.id === "new") return c.status === "needs_expert" || c.status === "ai_handling";
              if (tab.id === "needs_expert") return c.status === "needs_expert";
              if (tab.id === "ai_handling") return c.status === "ai_handling";
              if (tab.id === "waiting") return c.status === "waiting_for_client";
              if (tab.id === "resolved") return c.status === "resolved" || c.status === "closed";
              return false;
            }).length;

            const isActive = activeFilter === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-background text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Box */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(m.helpdesk_search_placeholder)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Cases Filter Table */}
      <div className="border border-border rounded-lg bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold text-xs">
                <th className="py-3 px-4">{t(m.helpdesk_th_client)}</th>
                <th className="py-3 px-4">{t(m.helpdesk_th_matter)}</th>
                <th className="py-3 px-4">{t(m.helpdesk_th_status)}</th>
                <th className="py-3 px-4">{t(m.helpdesk_th_risk)}</th>
                <th className="py-3 px-4">{t(m.helpdesk_th_updated)}</th>
                <th className="py-3 px-4 text-right">{t(m.helpdesk_th_action)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    {t(m.helpdesk_no_cases)}
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-muted/40 transition-colors group cursor-pointer"
                  >
                    {/* Client & Company */}
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      <Link href={`/helpdesk/${c.id}`} className="block">
                        <div className="font-semibold text-sm text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                          {c.companyName}
                        </div>
                        <div className="text-xs text-muted-foreground font-normal mt-0.5">
                          {c.clientName}
                        </div>
                      </Link>
                    </td>

                    {/* Matter Title */}
                    <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                      <Link href={`/helpdesk/${c.id}`} className="block">
                        <div className="font-medium text-foreground text-xs sm:text-sm truncate">
                          {c.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {c.caseReference} · {c.practiceArea}
                        </div>
                      </Link>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>

                    {/* Risk */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getRiskBadge(c.riskLevel)}
                    </td>

                    {/* Updated Time */}
                    <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(c.updatedAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/helpdesk/${c.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors"
                      >
                        <span>{t(m.helpdesk_open_case)}</span>
                        <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
