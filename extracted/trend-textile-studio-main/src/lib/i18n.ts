/**
 * Central language type + metadata. Widened from the original "en" | "ar"
 * to support the newly-requested languages. Honest scope note: only
 * Arabic and English have full string-level translation coverage across
 * the app right now (every UI string uses a small `t(en, ar)` helper
 * per-component) — French/Spanish/Russian/Japanese are wired up at the
 * infrastructure level (selectable in Settings, stored on the profile,
 * RTL/LTR handled correctly) but will display English text for anything
 * that hasn't been translated yet, since `t(en, ar)` falls back to the
 * English string for any non-"ar" language. That's a deliberate, honest
 * choice over doing a blind mechanical rewrite of every `t()` call in the
 * codebase (hundreds of call sites) with no way to verify the result here
 * — full translation is real, incremental work per string, best done
 * inside Lovable where it can be checked live.
 */
export type Lang = "en" | "ar" | "fr" | "es" | "ru" | "ja";

export const LANGUAGES: { code: Lang; native: string; rtl?: boolean }[] = [
  { code: "en", native: "English" },
  { code: "ar", native: "العربية", rtl: true },
  { code: "fr", native: "Français" },
  { code: "es", native: "Español" },
  { code: "ru", native: "Русский" },
  { code: "ja", native: "日本語" },
];

export function isRtl(lang: Lang): boolean {
  return lang === "ar";
}
