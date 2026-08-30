"use client";

import * as React from "react";
import { ShieldCheck, Building2 } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";

export function ClientStoriesSection() {
  const t = useLocalizedMessage();

  const stories = [
    {
      id: "story-1",
      client: t(m.story1_client),
      title: t(m.story1_title),
      desc: t(m.story1_desc),
      result: t(m.story1_result),
    },
    {
      id: "story-2",
      client: t(m.story2_client),
      title: t(m.story2_title),
      desc: t(m.story2_desc),
      result: t(m.story2_result),
    },
    {
      id: "story-3",
      client: t(m.story3_client),
      title: t(m.story3_title),
      desc: t(m.story3_desc),
      result: t(m.story3_result),
    },
  ];

  return (
    <section id="client-stories" className="w-full py-20 md:py-28 bg-card border-b border-border scroll-mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 md:space-y-16">
        {/* Section Header */}
        <div className="max-w-2xl space-y-3">
          <h2 suppressHydrationWarning className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl text-foreground tracking-tight text-balance">
            {t(m.stories_title)}
          </h2>
          <p suppressHydrationWarning className="text-sm sm:text-base text-muted-foreground leading-relaxed text-pretty font-normal">
            {t(m.stories_subtitle)}
          </p>
        </div>

        {/* 3-Column Stories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stories.map((story) => (
            <div
              key={story.id}
              className="bg-background border border-border rounded-lg p-6 flex flex-col justify-between hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 shadow-xs group"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="font-medium text-foreground">{story.client}</span>
                </div>

                <h3 className="font-heading font-bold text-base text-foreground tracking-tight leading-snug">
                  {story.title}
                </h3>

                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-pretty font-normal">
                  {story.desc}
                </p>
              </div>

              <div className="pt-5 mt-6 border-t border-border/50 space-y-3">
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{story.result}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
