"use client";

import * as React from "react";
import { Factory, Zap, Landmark, Cpu, ArrowRight } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";

export function IndustriesSection() {
  const t = useLocalizedMessage();

  const industries = [
    {
      id: "manufacturing",
      icon: Factory,
      title: t(m.ind1_title),
      desc: t(m.ind1_desc),
    },
    {
      id: "energy",
      icon: Zap,
      title: t(m.ind2_title),
      desc: t(m.ind2_desc),
    },
    {
      id: "financial",
      icon: Landmark,
      title: t(m.ind3_title),
      desc: t(m.ind3_desc),
    },
    {
      id: "tech",
      icon: Cpu,
      title: t(m.ind4_title),
      desc: t(m.ind4_desc),
    },
  ];

  return (
    <section id="industries" className="w-full py-20 md:py-28 bg-background border-b border-border scroll-mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 md:space-y-16">
        {/* Section Header */}
        <div className="max-w-2xl space-y-3">
          <h2 suppressHydrationWarning className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl text-foreground tracking-tight text-balance">
            {t(m.industries_title)}
          </h2>
          <p suppressHydrationWarning className="text-sm sm:text-base text-muted-foreground leading-relaxed text-pretty font-normal">
            {t(m.industries_subtitle)}
          </p>
        </div>

        {/* 4-Column Industry Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {industries.map((ind) => {
            const Icon = ind.icon;
            return (
              <div
                key={ind.id}
                className="bg-card border border-border rounded-lg p-6 flex flex-col justify-between hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 shadow-xs group"
              >
                <div className="space-y-4">
                  <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-amber-400 border border-border">
                    <Icon className="size-5" />
                  </div>

                  <h3 className="font-heading font-bold text-base text-foreground tracking-tight leading-snug">
                    {ind.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-pretty font-normal">
                    {ind.desc}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-border/50">
                  <a
                    href="#consultation"
                    className="text-xs font-semibold text-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{t(m.pillar_cta)}</span>
                    <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
