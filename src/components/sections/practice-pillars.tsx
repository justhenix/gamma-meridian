"use client";

import * as React from "react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";

export function PracticePillars() {
  const t = useLocalizedMessage();
  const pillars = [
    {
      id: "corporate-tax",
      title: t(m.pillar1_title),
      summary: t(m.pillar1_summary),
      statute: t(m.pillar1_statute),
    },
    {
      id: "transfer-pricing",
      title: t(m.pillar2_title),
      summary: t(m.pillar2_summary),
      statute: t(m.pillar2_statute),
    },
    {
      id: "dispute-resolution",
      title: t(m.pillar3_title),
      summary: t(m.pillar3_summary),
      statute: t(m.pillar3_statute),
    },
    {
      id: "cross-border",
      title: t(m.pillar4_title),
      summary: t(m.pillar4_summary),
      statute: t(m.pillar4_statute),
    },
  ];

  return (
    <section id="practice-areas" className="w-full py-20 md:py-28 bg-background border-b border-border scroll-mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 md:space-y-16">
        {/* Section Header */}
        <div className="max-w-2xl space-y-3">
          <h2 suppressHydrationWarning className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl text-foreground tracking-tight text-balance">
            {t(m.practice_section_title)}
          </h2>
          <p suppressHydrationWarning className="text-base text-muted-foreground leading-relaxed text-pretty font-normal">
            {t(m.practice_section_subtitle)}
          </p>
        </div>

        {/* 4-Column Minimalist Practice Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar) => (
            <div
              key={pillar.id}
              className="bg-card border border-border rounded-lg p-6 flex flex-col justify-between hover:border-slate-400 dark:hover:border-slate-600 transition-colors duration-200 shadow-xs group"
            >
              <div className="space-y-4">
                <span className="text-[13px] font-medium text-muted-foreground tracking-wide block">
                  {pillar.statute}
                </span>

                <h3 suppressHydrationWarning className="font-heading font-bold text-base text-foreground tracking-tight leading-snug text-balance">
                  {pillar.title}
                </h3>

                <p suppressHydrationWarning className="text-[13px] text-muted-foreground leading-relaxed text-pretty">
                  {pillar.summary}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-border/40">
                <a
                  href="#consultation"
                  className="text-[13px] font-semibold text-foreground hover:text-amber-800 dark:hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span suppressHydrationWarning>{t(m.pillar_cta)}</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
