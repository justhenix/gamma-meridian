"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Globe, ShieldCheck } from "lucide-react";

import * as m from "@/paraglide/messages.js";
import { EmailVerificationPanel } from "@/components/auth/email-verification-panel";
import { useAppLocale, useLocalizedMessage } from "@/components/locale-provider";

export default function LoginPage() {
  const router = useRouter();
  const { locale: currentLocale, setLocale: changeLocale } = useAppLocale();
  const t = useLocalizedMessage();
  const [langMenuOpen, setLangMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-amber-400 selection:text-slate-900">
      <header className="w-full border-b border-border bg-card/95 backdrop-blur-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex flex-col group">
            <span suppressHydrationWarning className="font-heading font-bold text-lg tracking-tight text-foreground leading-none">
              {t(m.brand_name)}
            </span>
            <span suppressHydrationWarning className="text-xs font-medium text-muted-foreground mt-0.5">
              {t(m.brand_tagline)}
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setLangMenuOpen((previous) => !previous)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md bg-muted/50 border border-border transition-colors cursor-pointer"
              >
                <Globe className="size-3.5 text-primary dark:text-amber-400" />
                <span>{currentLocale === "id" ? "Bahasa Indonesia" : "English"}</span>
                <ChevronDown className={`size-3 transition-transform ${langMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {langMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-md bg-card border border-border shadow-md py-1 z-50 text-xs">
                  {(["en", "id"] as const).map((locale) => (
                    <button
                      key={locale}
                      type="button"
                      onClick={() => {
                        changeLocale(locale);
                        setLangMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted transition-colors cursor-pointer ${
                        currentLocale === locale ? "text-primary dark:text-amber-400 font-semibold bg-muted/60" : "text-foreground"
                      }`}
                    >
                      <span>{locale === "en" ? "English" : "Bahasa Indonesia"}</span>
                      {currentLocale === locale && <Check className="size-3.5 text-primary dark:text-amber-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 font-medium"
            >
              <ArrowLeft className="size-3.5" />
              <span>{t(m.login_back_home)}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2.5">
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground dark:bg-amber-400 dark:text-slate-900 mx-auto shadow-xs">
              <ShieldCheck className="size-5" />
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground tracking-tight">
              {t(m.login_title)}
            </h1>
            <p className="text-[13px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {t(m.login_subtitle)}
            </p>
          </div>

          <EmailVerificationPanel
            purpose="consultations"
            isEnglish={currentLocale === "en"}
            onVerified={() => router.replace("/consultations")}
          />

          <div className="text-center">
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {t(m.login_security_notice)}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
