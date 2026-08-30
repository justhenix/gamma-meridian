"use client";

import * as React from "react";
import { UserCheck, CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecommendationCardProps {
  isEnglish?: boolean;
  freeEscalationConfirmed?: boolean;
  state?: "none" | "recommended" | "requested" | "acknowledged";
  onEscalate?: () => void;
}

export function RecommendationCard({
  isEnglish = false,
  freeEscalationConfirmed = true,
  state = "recommended",
  onEscalate,
}: RecommendationCardProps) {
  if (state === "none") return null;

  const isEscalated = state === "requested" || state === "acknowledged";

  if (isEscalated) {
    return (
      <div className="mt-3 p-4 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-foreground animate-in fade-in-0 duration-200">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-heading font-semibold text-sm text-emerald-900 dark:text-emerald-300">
              {isEnglish ? "✓ Sent to a Meridian expert" : "✓ Diteruskan ke konsultan senior Meridian"}
            </h4>
            <p className="text-xs sm:text-sm text-emerald-800/90 dark:text-emerald-400/90 leading-relaxed">
              {isEnglish
                ? "We'll continue here when a consultant joins. You can add more information in the meantime."
                : "Konsultan kami akan melanjutkan pembahasan langsung di ruang percakapan ini. Anda dapat menambahkan detail dokumen atau kronologi tambahan."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 sm:p-5 rounded-lg bg-card border border-amber-300/80 dark:border-amber-700/60 shadow-xs text-foreground space-y-3.5 animate-in fade-in-0 duration-200">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-md bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-800 dark:text-amber-300 shrink-0 border border-amber-300 dark:border-amber-700/60">
          <UserCheck className="size-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-heading font-semibold text-sm sm:text-base text-foreground">
            {isEnglish ? "Expert review recommended" : "Peninjauan Konsultan Ahli Direkomendasikan"}
          </h4>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {isEnglish
              ? "This situation depends on additional facts or professional interpretation. A Meridian expert can continue from this conversation, so you will not need to explain everything again."
              : "Situasi ini memerlukan evaluasi fakta spesifik atau interpretasi yuridis formal. Konsultan senior Meridian dapat melanjutkan langsung dari percakapan ini, sehingga Anda tidak perlu mengulang penjelasan dari awal."}
          </p>
        </div>
      </div>

      {freeEscalationConfirmed && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800/50 w-fit">
          <ShieldCheck className="size-3.5 shrink-0" />
          <span>
            {isEnglish
              ? "Expert review is available at no additional cost for this conversation."
              : "Peninjauan awal oleh konsultan tersedia tanpa biaya tambahan untuk percakapan ini."}
          </span>
        </div>
      )}

      <div className="pt-1 flex items-center justify-end">
        <Button
          variant="accent"
          size="sm"
          onClick={onEscalate}
          className="gap-2 cursor-pointer font-semibold text-xs sm:text-sm shadow-sm"
        >
          <span>{isEnglish ? "Ask a Meridian Expert" : "Hubungi Konsultan Meridian"}</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
