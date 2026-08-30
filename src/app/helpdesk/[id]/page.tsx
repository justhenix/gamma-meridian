"use client";

import * as React from "react";
import { useParams, notFound } from "next/navigation";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";
import { StaffNavbar } from "@/components/helpdesk/staff-navbar";
import { CaseHeader } from "@/components/helpdesk/case-header";
import { CaseLeftSidebar } from "@/components/helpdesk/case-left-sidebar";
import { CaseThread } from "@/components/helpdesk/case-thread";
import { CaseRightSidebar } from "@/components/helpdesk/case-right-sidebar";
import { SEED_HELPDESK_CASES } from "@/lib/assistant/mock-cases";
import type { HelpdeskCase, HelpdeskCaseStatus, ChatMessage } from "@/lib/assistant/types";

type MobileTab = "client_info" | "thread" | "ai_brief";

export default function CaseDetailPage() {
  const t = useLocalizedMessage();
  const params = useParams();
  const caseId = params?.id as string;

  const initialCase = SEED_HELPDESK_CASES.find((c) => c.id === caseId) || SEED_HELPDESK_CASES[0];

  const [caseData, setCaseData] = React.useState<HelpdeskCase>(initialCase);
  const [currentStatus, setCurrentStatus] = React.useState<HelpdeskCaseStatus>(
    initialCase.status
  );
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialCase.messages);
  const [activeMobileTab, setActiveMobileTab] = React.useState<MobileTab>("thread");

  // Collapsible workspace sidebar states for deep focus reading
  const [isLeftOpen, setIsLeftOpen] = React.useState(true);
  const [isRightOpen, setIsRightOpen] = React.useState(true);

  const handleStatusChange = (newStatus: HelpdeskCaseStatus) => {
    setCurrentStatus(newStatus);
    setCaseData((prev) => ({ ...prev, status: newStatus }));
  };

  const handleSendConsultantMessage = (body: string) => {
    const newMsg: ChatMessage = {
      id: `consultant-${Date.now()}`,
      sender: "consultant",
      authorName: caseData.assignedConsultant?.name || "Hendrik Prasetyo, BAP, S.H.",
      authorTitle: caseData.assignedConsultant?.title || "Senior Tax Partner",
      body,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    // Update status to consultant_working if it was needs_expert
    if (currentStatus === "needs_expert" || currentStatus === "ai_handling") {
      handleStatusChange("consultant_working");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <StaffNavbar />

      {/* Case Header with Collapsible Workspace Toggle */}
      <CaseHeader
        caseData={caseData}
        currentStatus={currentStatus}
        onStatusChange={handleStatusChange}
        isLeftOpen={isLeftOpen}
        onToggleLeft={() => setIsLeftOpen((prev) => !prev)}
      />

      {/* Mobile Tab Switcher (Visible only on lg and smaller) */}
      <div className="lg:hidden flex border-b border-border bg-card">
        <button
          type="button"
          onClick={() => setActiveMobileTab("client_info")}
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
            activeMobileTab === "client_info"
              ? "border-primary text-primary dark:text-amber-400 bg-muted/30"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(m.helpdesk_mobile_tab_info)}
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab("thread")}
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
            activeMobileTab === "thread"
              ? "border-primary text-primary dark:text-amber-400 bg-muted/30"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(m.helpdesk_mobile_tab_thread)} ({messages.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab("ai_brief")}
          className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${
            activeMobileTab === "ai_brief"
              ? "border-primary text-primary dark:text-amber-400 bg-muted/30"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(m.helpdesk_mobile_tab_brief)}
        </button>
      </div>

      {/* 3-Column Desktop View & Mobile Tabbed View with Smooth Collapse/Expand Transitions */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 h-[calc(100vh-3.5rem-3.5rem)] overflow-hidden">
        {/* Left Column: Metadata & Intake Facts */}
        <div
          className={`h-full overflow-y-auto transition-all duration-300 ease-in-out shrink-0 ${
            activeMobileTab === "client_info"
              ? "flex flex-col"
              : isLeftOpen
                ? "hidden lg:flex lg:flex-col lg:w-72 xl:w-80 opacity-100"
                : "hidden lg:flex lg:flex-col lg:w-0 xl:w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none"
          }`}
        >
          <CaseLeftSidebar
            caseData={caseData}
            onClose={() => setIsLeftOpen(false)}
          />
        </div>

        {/* Center Column: Unified Conversation Thread */}
        <div className={`flex-1 min-w-0 h-full transition-all duration-300 ease-in-out ${activeMobileTab === "thread" ? "flex" : "hidden lg:flex"}`}>
          <CaseThread
            messages={messages}
            onSendMessage={handleSendConsultantMessage}
            isLeftOpen={isLeftOpen}
            onToggleLeft={() => setIsLeftOpen((prev) => !prev)}
            isRightOpen={isRightOpen}
            onToggleRight={() => setIsRightOpen((prev) => !prev)}
          />
        </div>

        {/* Right Column: AI Handoff Brief, Risk Flags, Sources */}
        <div
          className={`h-full overflow-y-auto transition-all duration-300 ease-in-out shrink-0 ${
            activeMobileTab === "ai_brief"
              ? "flex flex-col"
              : isRightOpen
                ? "hidden lg:flex lg:flex-col lg:w-80 xl:w-96 opacity-100"
                : "hidden lg:flex lg:flex-col lg:w-0 xl:w-0 opacity-0 overflow-hidden border-l-0 pointer-events-none"
          }`}
        >
          <CaseRightSidebar
            handoffBrief={caseData.handoffBrief}
            onClose={() => setIsRightOpen(false)}
          />
        </div>
      </main>
    </div>
  );
}
