import { en, type EnDictionary } from "./en";
import { th } from "./th";

export { en, th, type EnDictionary };

export const locales = ["en", "th"] as const;
export type Locale = (typeof locales)[number];

export const dictionaries: Record<Locale, EnDictionary> = { en, th };

export function getDictionary(locale: Locale): EnDictionary {
  return dictionaries[locale] ?? en;
}
