"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe, ChevronDown, Check, LogOut, UserCheck } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { useAppLocale, useLocalizedMessage } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

interface StaffSessionUser {
  displayName: string;
  email: string;
  role: "consultant" | "admin";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "MS";
}

export function StaffNavbar() {
  const router = useRouter();
  const { locale: currentLocale, setLocale: changeLocale } = useAppLocale();
  const t = useLocalizedMessage();

  const [currentUser, setCurrentUser] = React.useState<StaffSessionUser | null>(null);
  const [langMenuOpen, setLangMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  const menuRef = React.useRef<HTMLDivElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unauthenticated");
        return response.json() as Promise<{ user: StaffSessionUser }>;
      })
      .then(({ user }) => {
        if (cancelled) return;
        if (user.role !== "consultant" && user.role !== "admin") {
          router.replace("/staff/login?redirect=/staff/helpdesk");
          return;
        }
        setCurrentUser(user);
      })
      .catch(() => {
        if (!cancelled) router.replace("/staff/login?redirect=/staff/helpdesk");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectLocale = (target: "id" | "en") => {
    changeLocale(target);
    setLangMenuOpen(false);
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    router.push("/staff/login?redirect=/staff/helpdesk");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left branding */}
        <div className="flex items-center gap-4">
          <Link href="/staff/helpdesk" className="flex items-center gap-2.5 group">
            <span className="font-heading font-bold text-base tracking-tight text-foreground">
              {t(m.helpdesk_title)}
            </span>
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 px-2 py-0.5 rounded-full">
              {t(m.helpdesk_workspace_badge)}
            </span>
          </Link>
        </div>

        {/* Right user & language controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Language Switcher */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/80 transition-colors cursor-pointer border border-border/60"
              aria-label="Change language"
              aria-expanded={langMenuOpen}
            >
              <Globe className="size-3.5 text-muted-foreground" />
              <span className="uppercase font-semibold text-xs">{currentLocale}</span>
              <ChevronDown className={`size-3 text-muted-foreground transition-transform duration-150 ${langMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-36 rounded-md bg-card border border-border shadow-lg py-1 z-50 text-xs animate-in fade-in-0 zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => handleSelectLocale("en")}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer ${
                    currentLocale === "en" ? "font-semibold text-foreground bg-muted/40" : "text-muted-foreground"
                  }`}
                >
                  <span>English (EN)</span>
                  {currentLocale === "en" && <Check className="size-3 text-primary" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLocale("id")}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-muted transition-colors cursor-pointer ${
                    currentLocale === "id" ? "font-semibold text-foreground bg-muted/40" : "text-muted-foreground"
                  }`}
                >
                  <span>Bahasa (ID)</span>
                  {currentLocale === "id" && <Check className="size-3 text-primary" />}
                </button>
              </div>
            )}
          </div>

          {/* Consultant Profile Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg p-1.5 hover:bg-muted/60 transition-all cursor-pointer border border-transparent hover:border-border/60"
            >
              <div className="size-7 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-400/30">
                {initials(currentUser?.displayName ?? "Meridian Staff")}
              </div>
              <div className="hidden sm:block text-left">
                <span className="font-medium text-foreground block leading-tight truncate max-w-[130px]">
                  {currentUser?.displayName ?? "Meridian Staff"}
                </span>
                <span className="text-xs text-muted-foreground block truncate max-w-[130px]">
                  {currentUser?.role === "admin" ? "Meridian Administrator" : "Meridian Tax Consultant"}
                </span>
              </div>
              <ChevronDown className="size-3 text-muted-foreground hidden sm:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-lg bg-card border border-border shadow-xl py-1.5 z-50 text-xs animate-in fade-in-0 zoom-in-95 duration-100 divide-y divide-border/60">
                <div className="px-3.5 py-2">
                  <span className="font-semibold text-foreground block truncate">
                    {currentUser?.displayName ?? "Meridian Staff"}
                  </span>
                  <span className="text-xs text-muted-foreground block truncate mt-0.5">
                    {currentUser?.email ?? ""}
                  </span>
                </div>

                <div className="py-1">
                  <Link
                    href="/staff/login"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <UserCheck className="size-3.5 text-amber-500" />
                    <span>{t(m.helpdesk_switch_account)}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="size-3.5" />
                    <span>{t(m.helpdesk_logout)}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <Link href="/">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5 mr-1" />
              {t(m.helpdesk_portal_link)}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
