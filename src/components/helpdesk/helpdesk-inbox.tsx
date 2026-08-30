"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CasesTable } from "@/components/helpdesk/cases-table";
import type { StaffHelpdeskListItem } from "@/lib/assistant/types";

export function HelpdeskInbox() {
  const router = useRouter();
  const [cases, setCases] = React.useState<StaffHelpdeskListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/staff/helpdesk", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/staff/login?redirect=/staff/helpdesk");
          return;
        }
        if (!response.ok) throw new Error("Could not load the staff helpdesk.");
        const result = await response.json() as { cases: StaffHelpdeskListItem[] };
        if (!cancelled) setCases(result.cases);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">Loading helpdesk…</div>;
  }
  if (error) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  }
  return <CasesTable cases={cases} />;
}
