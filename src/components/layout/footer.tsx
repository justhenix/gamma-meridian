"use client";

import * as m from "@/paraglide/messages.js";
import { useLocalizedMessage } from "@/components/locale-provider";

export function Footer() {
  const t = useLocalizedMessage();

  return (
    <footer className="w-full bg-card border-t border-border pt-16 pb-24 sm:pb-28 text-xs sm:text-sm text-muted-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-border/60">
          {/* Brand & Mission */}
          <div className="md:col-span-4 space-y-4">
            <span suppressHydrationWarning className="font-heading font-bold text-base tracking-tight text-foreground block">
              {t(m.brand_name)}
            </span>
            <p suppressHydrationWarning className="text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-sm text-pretty">
              {t(m.footer_disclaimer)}
            </p>
          </div>

          {/* Client Navigation */}
          <div className="md:col-span-2 space-y-3">
            <h4 suppressHydrationWarning className="font-heading font-semibold text-xs text-foreground">
              {t(m.footer_nav_title)}
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="#insights" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.nav_insights)}
                </a>
              </li>
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.nav_services)}
                </a>
              </li>
              <li>
                <a href="#industries" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.nav_industries)}
                </a>
              </li>
              <li>
                <a href="#client-stories" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.nav_client_stories)}
                </a>
              </li>
              <li>
                <a href="#why-meridian" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.nav_about_us)}
                </a>
              </li>
            </ul>
          </div>

          {/* Practice Areas */}
          <div className="md:col-span-3 space-y-3">
            <h4 suppressHydrationWarning className="font-heading font-semibold text-xs text-foreground">
              {t(m.footer_practice_title)}
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.pillar1_title)}
                </a>
              </li>
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.pillar2_title)}
                </a>
              </li>
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.pillar3_title)}
                </a>
              </li>
              <li>
                <a href="#practice-areas" suppressHydrationWarning className="hover:text-foreground transition-colors">
                  {t(m.pillar4_title)}
                </a>
              </li>
            </ul>
          </div>

          {/* Surakarta Advisory Office & Confidential Desk */}
          <div className="md:col-span-3 space-y-4">
            <div>
              <h4 suppressHydrationWarning className="font-heading font-semibold text-xs text-foreground mb-1">
                {t(m.footer_office_title)}
              </h4>
              <p suppressHydrationWarning className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-pretty">
                {t(m.footer_office_address)}
              </p>
            </div>

            <div>
              <h4 suppressHydrationWarning className="font-heading font-semibold text-xs text-foreground mb-1">
                {t(m.footer_contact_title)}
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                <span suppressHydrationWarning>{t(m.footer_contact_email_label)}</span>{" "}
                <a
                  href={`mailto:${t(m.footer_contact_email)}`}
                  suppressHydrationWarning
                  className="text-foreground hover:underline font-medium"
                >
                  {t(m.footer_contact_email)}
                </a>
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                <span suppressHydrationWarning>{t(m.footer_contact_tel_label)}</span>{" "}
                <a
                  href={`tel:${t(m.footer_contact_phone)}`}
                  suppressHydrationWarning
                  className="text-foreground hover:underline font-medium"
                >
                  {t(m.footer_contact_phone)}
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Rights & Accreditations */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground sm:pr-52">
          <p suppressHydrationWarning>
            &copy; {new Date().getFullYear()} {t(m.brand_name)} Advisory Group. {t(m.footer_rights)}
          </p>

          <div className="flex items-center gap-4 text-xs">
            <span suppressHydrationWarning className="font-medium text-foreground">
              {t(m.footer_badge1)}
            </span>
            <span>•</span>
            <span suppressHydrationWarning className="font-medium text-foreground">
              {t(m.footer_badge2)}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
