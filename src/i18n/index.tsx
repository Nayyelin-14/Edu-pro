"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  en,
  getDictionary,
  locales,
  type Locale,
  type EnDictionary,
} from "./dictionaries";

export { locales, getDictionary, type Locale, type EnDictionary };

const LOCALE_KEY = "elearning.locale";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: EnDictionary;
}>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "en" || stored === "th") {
      queueMicrotask(() => setLocaleState(stored));
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(LOCALE_KEY, l);
    document.cookie = `${LOCALE_KEY}=${l};path=/;max-age=31536000;samesite=lax`;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: getDictionary(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n() {
  return useContext(LocaleContext);
}
