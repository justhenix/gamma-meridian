"use client";

import * as React from "react";
import Link from "next/link";

import { EmailVerificationPanel } from "@/components/auth/email-verification-panel";

interface ConsultationListItem {
  caseId: string;
  caseReference: string;
  title: string;
  clientStatus: "Under review" | "Expert reviewing" | "Action needed" | "Completed";
  updatedAt: string;
}

export function ConsultationsList() {
  const [consultations, setConsultations] = React.useState<ConsultationListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const response = await fetch("/api/consultations", { cache: "no-store" });
    if (response.status === 401) {
      setNeedsVerification(true);
      setLoading(false);
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
      setError(body.error?.message ?? "Could not load consultations.");
      setLoading(false);
      return;
    }
    const result = await response.json() as { consultations: ConsultationListItem[] };
    setConsultations(result.consultations);
    setNeedsVerification(false);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (needsVerification) {
    return <EmailVerificationPanel purpose="consultations" onVerified={load} />;
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading consultations…</p>;
  if (error) return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  if (consultations.length === 0) {
    return <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No consultations are linked to this account yet.</div>;
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {consultations.map((consultation) => (
        <Link
          key={consultation.caseId}
          href={`/consultations/${consultation.caseId}`}
          className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-muted-foreground">{consultation.caseReference}</div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">{consultation.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">Updated {new Date(consultation.updatedAt).toLocaleString()}</div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground">
            {consultation.clientStatus}
          </span>
        </Link>
      ))}
    </div>
  );
}
