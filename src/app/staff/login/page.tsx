"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Check, ChevronDown, Globe, KeyRound, Shield } from "lucide-react";

import * as m from "@/paraglide/messages.js";
import { useAppLocale, useLocalizedMessage } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { PRESET_USERS } from "@/lib/auth/session";

function safeStaffRedirect(value: string | null) {
  if (!value) return "/staff/helpdesk";
  return value === "/staff" || value.startsWith("/staff/") ? value : "/staff/helpdesk";
}

export default function StaffLoginPage() {
  const searchParams = useSearchParams();
  const redirectTarget = safeStaffRedirect(searchParams.get("redirect"));
  const { locale: currentLocale, setLocale: changeLocale } = useAppLocale();
  const t = useLocalizedMessage();

  const [langMenuOpen, setLangMenuOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
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

  const handleStaffLogin = async (email: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/auth/development/staff-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Could not start the development staff session.");
      }
      window.location.href = redirectTarget;
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : String(cause));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-amber-400 selection:text-slate-900">
      <header className="w-full border-b border-border bg-card/95 backdrop-blur-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex flex-col group">
            <span suppressHydrationWarning className="font-heading font-bold text-lg tracking-tight text-foreground leading-none">
              {t(m.brand_name)}
            </span>
            <span suppressHydrationWarning className="text-xs font-semibold text-amber-800 dark:text-amber-300 mt-0.5">
              {t(m.staff_login_workspace_label)}
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
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-slate-900 text-amber-400 dark:bg-amber-400 dark:text-slate-900 mx-auto shadow-xs">
              <Shield className="size-5" />
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground tracking-tight">
              {t(m.staff_login_title)}
            </h1>
            <p className="text-[13px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {t(m.staff_login_subtitle)}
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 sm:p-7 shadow-sm space-y-5">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              type="button"
              variant="default"
              size="default"
              onClick={() => handleStaffLogin(PRESET_USERS.partner.email)}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 font-semibold cursor-pointer h-10"
            >
              <KeyRound className="size-4" />
              <span>{t(m.login_sso_button)}</span>
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-card px-3 text-xs font-semibold text-muted-foreground shrink-0">
                {t(m.login_quick_roles_title)}
              </span>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleStaffLogin(PRESET_USERS.partner.email)}
                disabled={isLoading}
                className="w-full text-left p-3.5 rounded-lg bg-muted/40 hover:bg-muted border border-border hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer group flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 text-foreground flex items-center justify-center font-bold text-xs shrink-0 border border-border">
                    HP
                  </div>
                  <div>
                    <span className="font-heading font-semibold text-sm text-foreground block group-hover:text-primary dark:group-hover:text-amber-400 transition-colors">
                      {PRESET_USERS.partner.name}
                    </span>
                    <span className="text-xs text-muted-foreground block">{t(m.login_role_partner)}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-foreground group-hover:translate-x-0.5 transition-transform">→</span>
              </button>

              <button
                type="button"
                onClick={() => handleStaffLogin(PRESET_USERS.consultant.email)}
                disabled={isLoading}
                className="w-full text-left p-3.5 rounded-lg bg-muted/40 hover:bg-muted border border-border hover:border-slate-400 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer group flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 text-foreground flex items-center justify-center font-bold text-xs shrink-0 border border-border">
                    MK
                  </div>
                  <div>
                    <span className="font-heading font-semibold text-sm text-foreground block group-hover:text-primary dark:group-hover:text-amber-400 transition-colors">
                      {PRESET_USERS.consultant.name}
                    </span>
                    <span className="text-xs text-muted-foreground block">{t(m.login_role_consultant)}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-foreground group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {t(m.staff_login_security_notice)}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
