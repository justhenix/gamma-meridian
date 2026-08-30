"use client";

import * as React from "react";
import Link from "next/link";

import { ConsultationsAccessGate } from "@/components/consultations/consultations-access-gate";
import { buttonVariants } from "@/components/ui/button";
import { useAppLocale } from "@/components/locale-provider";
import { localizeHref } from "@/paraglide/runtime.js";

interface ConsultationListItem {
  caseId: string;
  caseReference: string;
  title: string;
  clientStatus: "Under review" | "Expert reviewing" | "Action needed" | "Completed";
  updatedAt: string;
}

export function ConsultationsList() {
  const { locale } = useAppLocale();
  const isEnglish = locale === "en";
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
    return <ConsultationsAccessGate locale={locale} onVerified={load} />;
  }
  if (loading) {
    return <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6"><div className="mx-auto max-w-3xl"><p className="text-sm text-muted-foreground">{isEnglish ? "Loading consultations…" : "Memuat konsultasi…"}</p></div></main>;
  }

  const content = error ? (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
  ) : consultations.length === 0 ? (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-heading text-base font-semibold text-foreground">
        {isEnglish ? "No consultations yet" : "Belum ada konsultasi"}
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {isEnglish
          ? "Start with Meridian Assistant. If your question needs expert review, the same conversation will continue with our team."
          : "Mulai dari Asisten Meridian. Jika pertanyaan Anda memerlukan tinjauan ahli, percakapan yang sama akan dilanjutkan bersama tim kami."}
      </p>
      <Link
        href={localizeHref("/assistant", { locale })}
        className={buttonVariants({ variant: "accent", size: "sm", className: "mt-4" })}
      >
        {isEnglish ? "Start a consultation" : "Mulai konsultasi"}
      </Link>
    </div>
  ) : (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {consultations.map((consultation) => (
        <Link
          key={consultation.caseId}
          href={localizeHref(`/consultations/${consultation.caseId}`, { locale })}
          className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/40"
        >
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-muted-foreground">{consultation.caseReference}</div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">{consultation.title}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              {isEnglish ? "Updated " : "Diperbarui "}
              {new Date(consultation.updatedAt).toLocaleString(locale === "id" ? "id-ID" : "en-US")}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[13px] font-semibold text-foreground">
            {consultation.clientStatus}
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="font-heading text-2xl font-bold">{isEnglish ? "My Consultations" : "Konsultasi Saya"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEnglish
                ? "Continue from the same consultation history shared with Meridian."
                : "Lanjutkan dari riwayat konsultasi yang sama bersama Meridian."}
            </p>
          </div>
          <Link href={localizeHref("/", { locale })} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">
            {isEnglish ? "Back to Meridian" : "Kembali ke Meridian"}
          </Link>
        </div>
        {content}
      </div>
    </main>
  );
}
