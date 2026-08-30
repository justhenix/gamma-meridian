"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  ArrowLeft,
  KeyRound,
  AlertCircle,
  Globe,
  ChevronDown,
  Check,
} from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useAppLocale, useLocalizedMessage } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRESET_USERS, setClientSession, type AuthUser } from "@/lib/auth/session";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/helpdesk";

  const { locale: currentLocale, setLocale: changeLocale } = useAppLocale();
  const t = useLocalizedMessage();

  const [activeTab, setActiveTab] = React.useState<"staff" | "client">("staff");
  const [langMenuOpen, setLangMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Client login form state
  const [caseRef, setCaseRef] = React.useState("MER-2026-8921");
  const [clientEmail, setClientEmail] = React.useState("budi.santoso@nusantarajaya.co.id");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStaffLogin = (user: AuthUser) => {
    setIsLoading(true);
    setClientSession(user);
    setTimeout(() => {
      window.location.href = redirectTarget;
    }, 200);
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!caseRef.trim() || !clientEmail.trim()) {
      setErrorMessage("Please enter both case reference and registered work email.");
      return;
    }

    setIsLoading(true);
    const clientUser: AuthUser = {
      id: "usr-client-active",
      name: "Budi Santoso",
      role: "client",
      roleTitle: "Director of Finance",
      companyName: "PT Nusantara Jaya Abadi",
      caseReference: caseRef.trim().toUpperCase(),
      email: clientEmail.trim(),
      avatarInitials: "BS",
    };

    setClientSession(clientUser);
    setTimeout(() => {
      router.push("/helpdesk/case-001");
    }, 200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-amber-400 selection:text-slate-900">
      {/* Top Navigation Bar */}
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
            {/* Language Switcher */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setLangMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md bg-muted/50 border border-border transition-colors cursor-pointer"
              >
                <Globe className="size-3.5 text-primary dark:text-amber-400" />
                <span>{currentLocale === "id" ? "Bahasa Indonesia" : "English"}</span>
                <ChevronDown className={`size-3 transition-transform ${langMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {langMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-md bg-card border border-border shadow-md py-1 z-50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      changeLocale("en");
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted transition-colors cursor-pointer ${
                      currentLocale === "en" ? "text-primary dark:text-amber-400 font-semibold bg-muted/60" : "text-foreground"
                    }`}
                  >
                    <span>English</span>
                    {currentLocale === "en" && <Check className="size-3.5 text-primary dark:text-amber-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      changeLocale("id");
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted transition-colors cursor-pointer ${
                      currentLocale === "id" ? "text-primary dark:text-amber-400 font-semibold bg-muted/60" : "text-foreground"
                    }`}
                  >
                    <span>Bahasa Indonesia</span>
                    {currentLocale === "id" && <Check className="size-3.5 text-primary dark:text-amber-400" />}
                  </button>
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

      {/* Main Authentication Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2.5">
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground dark:bg-amber-400 dark:text-slate-900 mx-auto shadow-xs">
              <Shield className="size-5" />
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground tracking-tight">
              {t(m.login_title)}
            </h1>
            <p className="text-[13px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {t(m.login_subtitle)}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="p-1 bg-muted rounded-lg border border-border flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("staff")}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                activeTab === "staff"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(m.login_tab_staff)}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("client")}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                activeTab === "client"
                  ? "bg-card text-foreground shadow-xs border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(m.login_tab_client)}
            </button>
          </div>

          {/* Form Card Container */}
          <div className="bg-card border border-border rounded-lg p-6 sm:p-7 shadow-sm space-y-6">
            {activeTab === "staff" ? (
              /* Staff & Partner Flow */
              <div className="space-y-5">
                {/* Enterprise SSO Button */}
                <Button
                  type="button"
                  variant="default"
                  size="default"
                  onClick={() => handleStaffLogin(PRESET_USERS.partner)}
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

                {/* Role Switcher Cards */}
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleStaffLogin(PRESET_USERS.partner)}
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
                        <span className="text-xs text-muted-foreground block">
                          {t(m.login_role_partner)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-foreground group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStaffLogin(PRESET_USERS.consultant)}
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
                        <span className="text-xs text-muted-foreground block">
                          {t(m.login_role_consultant)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-foreground group-hover:translate-x-0.5 transition-transform">
                      →
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* Corporate Client Case Tracker Form */
              <form onSubmit={handleClientSubmit} className="space-y-4">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {t(m.login_client_desc)}
                </p>

                {errorMessage && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    {t(m.login_client_ref_label)}
                  </label>
                  <Input
                    type="text"
                    value={caseRef}
                    onChange={(e) => setCaseRef(e.target.value)}
                    placeholder="e.g. MER-2026-8921"
                    className="text-xs h-9 bg-background"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    {t(m.login_client_email_label)}
                  </label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="text-xs h-9 bg-background"
                    required
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="accent"
                    size="default"
                    disabled={isLoading}
                    className="w-full text-xs font-semibold h-9 cursor-pointer"
                  >
                    {t(m.login_client_btn)}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Security & Confidentiality Footer Note */}
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
