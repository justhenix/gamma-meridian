"use client";

import * as React from "react";
import * as m from "@/paraglide/messages.js";

export function Footer() {
  return (
    <footer className="w-full bg-card border-t border-border pt-16 pb-12 text-[13px] text-muted-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-border/60">
          {/* Brand & Mission */}
          <div className="md:col-span-5 space-y-4">
            <span suppressHydrationWarning className="font-heading font-bold text-base tracking-tight text-foreground block">
              {m.brand_name()}
            </span>
            <p suppressHydrationWarning className="text-[13px] leading-relaxed text-muted-foreground max-w-sm text-pretty">
              {m.footer_disclaimer()}
            </p>
          </div>

          {/* Practice Areas */}
          <div className="md:col-span-3 space-y-3">
            <h4 suppressHydrationWarning className="font-heading font-semibold text-[13px] tracking-wider uppercase text-foreground">
              {m.nav_practice_areas()}
            </h4>
            <ul className="space-y-2 text-[13px]">
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {m.pillar1_title()}
                </a>
              </li>
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {m.pillar2_title()}
                </a>
              </li>
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {m.pillar3_title()}
                </a>
              </li>
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {m.pillar4_title()}
                </a>
              </li>
            </ul>
          </div>

          {/* Jakarta Advisory Office & Confidential Desk */}
          <div className="md:col-span-4 space-y-4">
            <div>
              <h4 suppressHydrationWarning className="font-heading font-semibold text-[13px] tracking-wider uppercase text-foreground mb-1">
                {m.footer_office_title()}
              </h4>
              <p suppressHydrationWarning className="text-[13px] text-muted-foreground leading-relaxed text-pretty">
                {m.footer_office_address()}
              </p>
            </div>

            <div>
              <h4 suppressHydrationWarning className="font-heading font-semibold text-[13px] tracking-wider uppercase text-foreground mb-1">
                {m.footer_contact_title()}
              </h4>
              <p className="text-[13px] text-muted-foreground">
                Email:{" "}
                <a
                  href={`mailto:${m.footer_contact_email()}`}
                  suppressHydrationWarning
                  className="text-foreground hover:underline font-medium"
                >
                  {m.footer_contact_email()}
                </a>
              </p>
              <p className="text-[13px] text-muted-foreground">
                Tel:{" "}
                <a
                  href={`tel:${m.footer_contact_phone()}`}
                  suppressHydrationWarning
                  className="text-foreground hover:underline font-medium"
                >
                  {m.footer_contact_phone()}
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Rights */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-muted-foreground">
          <p suppressHydrationWarning>
            &copy; {new Date().getFullYear()} {m.brand_name()} Advisory Group. {m.footer_rights()}
          </p>
          <div className="flex items-center gap-4 text-[13px]">
            <span suppressHydrationWarning className="font-medium text-foreground">
              {m.footer_badge1()}
            </span>
            <span>•</span>
            <span suppressHydrationWarning className="font-medium text-foreground">
              {m.footer_badge2()}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
