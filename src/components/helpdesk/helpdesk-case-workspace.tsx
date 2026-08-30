"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as m from "@/paraglide/messages.js";

import { useLocalizedMessage } from "@/components/locale-provider";
import { CaseHeader } from "@/components/helpdesk/case-header";
import { CaseLeftSidebar } from "@/components/helpdesk/case-left-sidebar";
import { CaseRightSidebar } from "@/components/helpdesk/case-right-sidebar";
import { CaseThread } from "@/components/helpdesk/case-thread";
import { StaffNavbar } from "@/components/helpdesk/staff-navbar";
import type { HelpdeskCase } from "@/lib/assistant/types";

type MobileTab = "client_info" | "thread" | "ai_brief";
type StaffCaseDetail = HelpdeskCase & { conversationId: string; rowVersion: number };

async function responseError(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
  return body.error?.message ?? `Request failed (${response.status})`;
}

export function HelpdeskCaseWorkspace({ caseId }: { caseId: string }) {
  const router = useRouter();
  const t = useLocalizedMessage();
  const [caseData, setCaseData] = React.useState<StaffCaseDetail | null>(null);
  const [activeMobileTab, setActiveMobileTab] = React.useState<MobileTab>("thread");
  const [isLeftOpen, setIsLeftOpen] = React.useState(true);
  const [isRightOpen, setIsRightOpen] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const getDetail = React.useCallback(async () => {
    const response = await fetch(`/api/staff/helpdesk/${caseId}`, { cache: "no-store" });
    if (response.status === 401) {
      router.replace(`/staff/login?redirect=${encodeURIComponent(`/staff/helpdesk/${caseId}`)}`);
      return null;
    }
    if (!response.ok) throw new Error(await responseError(response));
    const detail = await response.json() as StaffCaseDetail;
    setCaseData(detail);
    return detail;
  }, [caseId, router]);

  React.useEffect(() => {
    let cancelled = false;
    async function claimAndLoad() {
      try {
        const claim = await fetch(`/api/staff/helpdesk/${caseId}/claim`, { method: "POST" });
        if (claim.status === 401) {
          router.replace(`/staff/login?redirect=${encodeURIComponent(`/staff/helpdesk/${caseId}`)}`);
          return;
        }
        if (!claim.ok) throw new Error(await responseError(claim));
        if (!cancelled) await getDetail();
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    }
    void claimAndLoad();
    return () => {
      cancelled = true;
    };
  }, [caseId, getDetail, router]);

  async function handleSendMessage(bodyMarkdown: string) {
    setError(null);
    const response = await fetch(`/api/staff/helpdesk/${caseId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bodyMarkdown,
        language: "en",
        clientRequestId: crypto.randomUUID(),
      }),
    });
    if (!response.ok) {
      const message = await responseError(response);
      setError(message);
      throw new Error(message);
    }
    await getDetail();
  }

  async function handleStatusChange(status: "waiting_for_client" | "resolved") {
    setError(null);
    const endpoint = status === "resolved" ? "resolve" : "waiting";
    const response = await fetch(`/api/staff/helpdesk/${caseId}/${endpoint}`, { method: "POST" });
    if (!response.ok) {
      const message = await responseError(response);
      setError(message);
      throw new Error(message);
    }
    await getDetail();
  }

  if (!caseData) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <StaffNavbar />
        <main className="flex-1 grid place-items-center p-6">
          <div className={`max-w-lg rounded-lg border p-5 text-sm ${error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-card text-muted-foreground"}`}>
            {error ?? "Opening consultation and securing assignment…"}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <StaffNavbar />
      <CaseHeader
        caseData={caseData}
        currentStatus={caseData.status}
        onStatusChange={handleStatusChange}
        isLeftOpen={isLeftOpen}
        onToggleLeft={() => setIsLeftOpen((value) => !value)}
      />
      {error && <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">{error}</div>}

      <div className="lg:hidden flex border-b border-border bg-card">
        {([
          ["client_info", t(m.helpdesk_mobile_tab_info)],
          ["thread", `${t(m.helpdesk_mobile_tab_thread)} (${caseData.messages.length})`],
          ["ai_brief", t(m.helpdesk_mobile_tab_brief)],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveMobileTab(id)}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors ${activeMobileTab === id ? "border-primary text-primary dark:text-amber-400 bg-muted/30" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0 h-[calc(100vh-7rem)] overflow-hidden">
        <div className={`h-full overflow-y-auto transition-all duration-300 shrink-0 ${activeMobileTab === "client_info" ? "flex flex-col" : isLeftOpen ? "hidden lg:flex lg:flex-col lg:w-72 xl:w-80" : "hidden lg:flex lg:w-0 opacity-0 overflow-hidden pointer-events-none"}`}>
          <CaseLeftSidebar caseData={caseData} onClose={() => setIsLeftOpen(false)} />
        </div>
        <div className={`flex-1 min-w-0 h-full ${activeMobileTab === "thread" ? "flex" : "hidden lg:flex"}`}>
          <CaseThread
            messages={caseData.messages}
            onSendMessage={handleSendMessage}
            isLeftOpen={isLeftOpen}
            onToggleLeft={() => setIsLeftOpen((value) => !value)}
            isRightOpen={isRightOpen}
            onToggleRight={() => setIsRightOpen((value) => !value)}
          />
        </div>
        <div className={`h-full overflow-y-auto transition-all duration-300 shrink-0 ${activeMobileTab === "ai_brief" ? "flex flex-col" : isRightOpen ? "hidden lg:flex lg:flex-col lg:w-80 xl:w-96" : "hidden lg:flex lg:w-0 opacity-0 overflow-hidden pointer-events-none"}`}>
          <CaseRightSidebar handoffBrief={caseData.handoffBrief} onClose={() => setIsRightOpen(false)} />
        </div>
      </main>
    </div>
  );
}
