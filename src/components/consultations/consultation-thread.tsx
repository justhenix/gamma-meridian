"use client";

import * as React from "react";
import Link from "next/link";

import { EmailVerificationPanel } from "@/components/auth/email-verification-panel";

interface ConsultationDetail {
  caseId: string;
  caseReference: string;
  title: string;
  clientStatus: "Under review" | "Expert reviewing" | "Action needed" | "Completed";
  updatedAt: string;
  conversationId: string;
  messages: Array<{
    id: string;
    sender: "ai" | "system" | "staff" | "client";
    bodyMarkdown: string;
    language: string;
    createdAt: string;
    authorName: string | null;
  }>;
}

export function ConsultationThread({ caseId }: { caseId: string }) {
  const [detail, setDetail] = React.useState<ConsultationDetail | null>(null);
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const response = await fetch(`/api/consultations/${caseId}`, { cache: "no-store" });
    if (response.status === 401) {
      setNeedsVerification(true);
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      setError(body.error?.message ?? "This consultation could not be opened.");
      return;
    }
    setDetail(await response.json() as ConsultationDetail);
    setNeedsVerification(false);
  }, [caseId]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (needsVerification) {
    return <EmailVerificationPanel purpose="consultations" onVerified={load} />;
  }
  if (error) return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  if (!detail) return <p className="text-sm text-muted-foreground">Loading consultation…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/consultations" className="text-xs font-semibold text-muted-foreground hover:text-foreground">← My Consultations</Link>
          <div className="mt-3 text-xs font-semibold text-muted-foreground">{detail.caseReference}</div>
          <h1 className="mt-1 font-heading text-xl font-bold text-foreground">{detail.title}</h1>
        </div>
        <span className="w-fit rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold">{detail.clientStatus}</span>
      </div>

      <div className="space-y-3">
        {detail.messages.map((message) => {
          const label = message.sender === "staff"
            ? message.authorName ?? "Meridian Expert"
            : message.sender === "ai"
              ? "Meridian Assistant"
              : message.sender === "client"
                ? "You"
                : "Consultation update";
          return (
            <div key={message.id} className={`rounded-lg border p-4 ${message.sender === "staff" ? "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-foreground">{label}</span>
                <span className="text-muted-foreground">{new Date(message.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.bodyMarkdown}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
