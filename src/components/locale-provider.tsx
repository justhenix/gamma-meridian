"use client";

import * as React from "react";
import { type Locale, setLocale as paraglideSetLocale } from "@/paraglide/runtime.js";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = React.createContext<LocaleContextType>({
  locale: "en",
  setLocale: () => {},
});

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [currentLocale, setCurrentLocale] = React.useState<Locale>(initialLocale);

  React.useEffect(() => {
    setCurrentLocale(initialLocale);
  }, [initialLocale]);

  const handleSetLocale = React.useCallback((newLocale: Locale) => {
    setCurrentLocale(newLocale);
    if (newLocale !== initialLocale) {
      void paraglideSetLocale(newLocale);
    }
  }, [initialLocale]);

  return (
    <LocaleContext.Provider value={{ locale: currentLocale, setLocale: handleSetLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useAppLocale() {
  return React.useContext(LocaleContext);
}

type MessageWithoutInputs = (
  inputs?: Record<never, never>,
  options?: { locale?: Locale },
) => string;

export function useLocalizedMessage() {
  const { locale } = useAppLocale();

  return React.useCallback(
    (message: MessageWithoutInputs) => message({}, { locale }),
    [locale],
  );
}
