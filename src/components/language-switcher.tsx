"use client";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as "en" | "th")}
      aria-label="Switch language"
      className={cn(
        // Base
        "rounded-md border px-3 py-1 text-sm shadow-sm cursor-pointer",
        "bg-background text-foreground",
        "border-border",

        // Focus
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",

        // Light mode
        "dark:border-white/15 dark:bg-white/4 dark:text-white",

        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",

        // Native dropdown options
        "[&>option]:bg-background [&>option]:text-foreground",
        "dark:[&>option]:bg-slate-900 dark:[&>option]:text-white",
      )}
    >
      <option value="en">EN</option>
      <option value="th">ไทย</option>
    </select>
  );
}
