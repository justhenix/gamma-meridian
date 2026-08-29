"use client";

import * as React from "react";
import * as m from "@/paraglide/messages.js";

export function StatutoryStrip() {
  const items = [
    {
      title: m.stat_p1_title(),
      desc: m.stat_p1_desc(),
    },
    {
      title: m.stat_p2_title(),
      desc: m.stat_p2_desc(),
    },
    {
      title: m.stat_p3_title(),
      desc: m.stat_p3_desc(),
    },
    {
      title: m.stat_p4_title(),
      desc: m.stat_p4_desc(),
    },
  ];

  return (
    <section className="w-full bg-card border-b border-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-8">
          {items.map((item, idx) => (
            <div key={idx} className="space-y-1.5 border-l-2 border-slate-200 dark:border-slate-800 pl-4">
              <h4 suppressHydrationWarning className="font-heading font-bold text-sm text-foreground text-balance">
                {item.title}
              </h4>
              <p suppressHydrationWarning className="text-[13px] text-muted-foreground leading-relaxed text-pretty">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
