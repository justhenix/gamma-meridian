"use client";

import * as React from "react";
import Image from "next/image";
import * as m from "@/paraglide/messages.js";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-[#0b0f17] text-white min-h-[500px] sm:min-h-[540px] lg:min-h-[600px] flex items-center">
      {/* Full-bleed Background Image Layer */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero-boardroom.webp"
          alt="Meridian Tax Advisory Boardroom Meeting"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[85%_center] md:object-[right_center] select-none"
        />
        {/* KPMG Style Gradient Overlay: Solid on left for typography, smoothly fading to reveal the boardroom team */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(90deg, #0b0f17 0%, #0b0f17 35%, rgba(11, 15, 23, 0.96) 48%, rgba(11, 15, 23, 0.6) 66%, rgba(11, 15, 23, 0.1) 85%, transparent 100%)",
          }}
          aria-hidden="true"
        />
        {/* Mobile Gradient Overlay */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(180deg, #0b0f17 0%, rgba(11, 15, 23, 0.95) 60%, rgba(11, 15, 23, 0.75) 100%)",
          }}
          aria-hidden="true"
        />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 md:py-28 lg:py-32">
        <div className="max-w-xl lg:max-w-2xl space-y-6 md:space-y-8">
          {/* Main Display Headline */}
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-[46px] tracking-tight text-white leading-[1.15] text-balance">
            <span suppressHydrationWarning>{m.hero_title_line1()}</span>{" "}
            <span suppressHydrationWarning className="text-white">
              {m.hero_title_line2()}
            </span>
          </h1>

          {/* Lead Description */}
          <p
            suppressHydrationWarning
            className="text-base sm:text-lg text-slate-200/90 leading-relaxed font-normal max-w-lg text-pretty"
          >
            {m.hero_lead()}
          </p>

          {/* Action CTAs */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            <a href="#consultation">
              <Button
                variant="accent"
                size="lg"
                className="w-full sm:w-auto h-12 px-8 text-sm font-semibold cursor-pointer shadow-sm transition-all"
                suppressHydrationWarning
              >
                {m.hero_cta_primary()}
              </Button>
            </a>
            <a href="#practice-areas">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/25 hover:border-white/40 h-12 px-7 text-sm font-medium cursor-pointer backdrop-blur-xs transition-all"
                suppressHydrationWarning
              >
                {m.hero_cta_secondary()}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

