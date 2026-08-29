"use client";

import * as React from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { getLocale, setLocale, type Locale } from "@/paraglide/runtime.js";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [currentLocale, setCurrentLocale] = React.useState<Locale>(() => getLocale());
  const [scrolled, setScrolled] = React.useState(false);
  const [langMenuOpen, setLangMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectLocale = (target: Locale) => {
    setLocale(target);
    setCurrentLocale(target);
    setLangMenuOpen(false);
  };

  return (
    <header
      suppressHydrationWarning
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border shadow-xs"
          : "bg-background/80 backdrop-blur-xs border-b border-border/50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Wordmark */}
        <a href="#" className="flex flex-col group">
          <span suppressHydrationWarning className="font-heading font-bold text-lg tracking-tight text-foreground leading-none">
            {m.brand_name()}
          </span>
          <span suppressHydrationWarning className="text-[13px] font-medium text-muted-foreground mt-0.5">
            {m.brand_tagline()}
          </span>
        </a>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#practice-areas"
            suppressHydrationWarning
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {m.nav_practice_areas()}
          </a>
          <a
            href="#why-meridian"
            suppressHydrationWarning
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {m.nav_differentiators()}
          </a>
          <a
            href="#consultation"
            suppressHydrationWarning
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {m.nav_consultation_link()}
          </a>
        </nav>

        {/* Right Action & KPMG-Style Language Switcher */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Language Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setLangMenuOpen((prev) => !prev)}
              aria-expanded={langMenuOpen}
              aria-haspopup="true"
              className="flex items-center gap-1.5 py-1 text-sm font-medium text-slate-700 hover:text-blue-700 dark:text-slate-200 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              <Globe className="size-4 text-blue-700 dark:text-blue-400 shrink-0" />
              <span>
                {currentLocale === "id" ? "Bahasa Indonesia" : "English"}
              </span>
              <ChevronDown
                className={`size-3.5 text-blue-700 dark:text-blue-400 transition-transform duration-200 ${
                  langMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {langMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 rounded-md bg-card border border-border shadow-md py-1 z-50 text-sm animate-in fade-in-0 zoom-in-95 duration-100"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectLocale("en")}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-muted transition-colors cursor-pointer ${
                    currentLocale === "en"
                      ? "text-blue-700 dark:text-blue-400 font-semibold bg-muted/50"
                      : "text-foreground font-normal"
                  }`}
                >
                  <span>English</span>
                  {currentLocale === "en" && <Check className="size-3.5 text-blue-700 dark:text-blue-400 shrink-0" />}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectLocale("id")}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-muted transition-colors cursor-pointer ${
                    currentLocale === "id"
                      ? "text-blue-700 dark:text-blue-400 font-semibold bg-muted/50"
                      : "text-foreground font-normal"
                  }`}
                >
                  <span>Bahasa Indonesia</span>
                  {currentLocale === "id" && <Check className="size-3.5 text-blue-700 dark:text-blue-400 shrink-0" />}
                </button>
              </div>
            )}
          </div>

          {/* Primary Consultation CTA */}
          <a href="#consultation" className="hidden sm:inline-flex">
            <Button variant="accent" size="sm" className="cursor-pointer font-semibold text-[13px]" suppressHydrationWarning>
              {m.nav_consultation()}
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}
