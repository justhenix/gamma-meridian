"use client";

import * as React from "react";
import * as m from "@/paraglide/messages.js";

export function Differentiators() {
  const items = [
    {
      title: m.diff1_title(),
      desc: m.diff1_desc(),
    },
    {
      title: m.diff2_title(),
      desc: m.diff2_desc(),
    },
    {
      title: m.diff3_title(),
      desc: m.diff3_desc(),
    },
  ];

  return (
    <section id="why-meridian" className="w-full py-20 md:py-28 bg-card border-b border-border scroll-mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 md:space-y-16">
        {/* Section Header */}
        <div className="max-w-2xl space-y-3">
          <h2 suppressHydrationWarning className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl text-foreground tracking-tight text-balance">
            {m.diff_section_title()}
          </h2>
          <p suppressHydrationWarning className="text-base text-muted-foreground leading-relaxed text-pretty font-normal">
            {m.diff_section_subtitle()}
          </p>
        </div>

        {/* 3-Column Clean Editorial Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-3 border-t-2 border-slate-200 dark:border-slate-800 pt-6">
              <h3 suppressHydrationWarning className="font-heading font-bold text-lg text-foreground tracking-tight text-balance">
                {item.title}
              </h3>
              <p suppressHydrationWarning className="text-sm text-muted-foreground leading-relaxed text-pretty font-normal">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
