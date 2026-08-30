"use client";

import * as React from "react";
import { ArrowRight, BookOpen, Calendar, Tag } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";

export function InsightsSection() {
  const t = useLocalizedMessage();

  const insights = [
    {
      id: "pmk-172",
      tag: t(m.insight1_tag),
      title: t(m.insight1_title),
      date: t(m.insight1_date),
      desc: t(m.insight1_desc),
    },
    {
      id: "sp2dk-protocol",
      tag: t(m.insight2_tag),
      title: t(m.insight2_title),
      date: t(m.insight2_date),
      desc: t(m.insight2_desc),
    },
    {
      id: "form-dgt",
      tag: t(m.insight3_tag),
      title: t(m.insight3_title),
      date: t(m.insight3_date),
      desc: t(m.insight3_desc),
    },
  ];

  return (
    <section id="insights" className="w-full py-20 md:py-28 bg-card border-b border-border scroll-mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 md:space-y-16">
        {/* Section Header */}
        <div className="max-w-2xl space-y-3">
          <h2 suppressHydrationWarning className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl text-foreground tracking-tight text-balance">
            {t(m.insights_title)}
          </h2>
          <p suppressHydrationWarning className="text-sm sm:text-base text-muted-foreground leading-relaxed text-pretty font-normal">
            {t(m.insights_subtitle)}
          </p>
        </div>

        {/* 3-Column Editorial Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {insights.map((item) => (
            <article
              key={item.id}
              className="bg-background border border-border rounded-lg p-6 flex flex-col justify-between hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 shadow-xs group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                    <Tag className="size-3" />
                    {item.tag}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3" />
                    {item.date}
                  </span>
                </div>

                <h3 className="font-heading font-bold text-base text-foreground tracking-tight leading-snug group-hover:text-primary dark:group-hover:text-amber-400 transition-colors">
                  {item.title}
                </h3>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-pretty font-normal">
                  {item.desc}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-border/50">
                <a
                  href="#consultation"
                  className="text-xs font-semibold text-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span suppressHydrationWarning>{t(m.insights_cta)}</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
