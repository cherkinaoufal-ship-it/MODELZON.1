/**
 * Country → currency mapping + approximate conversion rates, so a person
 * can see prices (and actually check out) in their own currency instead of
 * always USD.
 *
 * ⚠️ Honest limitation: these rates are a static snapshot, not a live feed
 * — this sandbox has no network access to call a live FX API. They're
 * close enough for everyday pricing display, but WILL drift from the real
 * exchange rate over time. For production accuracy, swap `RATES_TO_USD`
 * for a real feed (e.g. exchangerate.host, Stripe's own currency
 * conversion, or your bank's rate) — ideally refreshed daily via a
 * scheduled job, not hardcoded like this. Stripe itself is told the exact
 * converted amount at checkout time (via `price_data.currency` +
 * `unit_amount`), so what a customer is actually charged always matches
 * what they see on screen — the only real risk is that number being a bit
 * stale relative to the true market rate.
 */

export type CurrencyCode =
  | "USD" | "EUR" | "GBP" | "SAR" | "AED" | "EGP" | "KWD" | "QAR" | "BHD" | "OMR" | "JOD"
  | "TRY" | "INR" | "PKR" | "CNY" | "JPY" | "KRW" | "RUB" | "BRL" | "MXN" | "CAD" | "AUD"
  | "ZAR" | "NGN" | "IDR" | "MYR" | "PHP" | "THB" | "VND" | "SEK" | "NOK" | "DKK" | "CHF" | "PLN";

/** Units of this currency per 1 USD. */
const RATES_TO_USD: Record<CurrencyCode, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, SAR: 3.75, AED: 3.67, EGP: 49, KWD: 0.31, QAR: 3.64,
  BHD: 0.38, OMR: 0.38, JOD: 0.71, TRY: 34, INR: 84, PKR: 279, CNY: 7.24, JPY: 152,
  KRW: 1370, RUB: 92, BRL: 5.1, MXN: 17, CAD: 1.37, AUD: 1.52, ZAR: 18.5, NGN: 1550,
  IDR: 15800, MYR: 4.47, PHP: 57, THB: 34.5, VND: 25400, SEK: 10.9, NOK: 11.2, DKK: 6.9,
  CHF: 0.88, PLN: 4.0,
};

export const COUNTRIES: { country: string; countryAr: string; code: CurrencyCode; flag: string }[] = [
  { country: "United States", countryAr: "الولايات المتحدة", code: "USD", flag: "🇺🇸" },
  { country: "Saudi Arabia", countryAr: "السعودية", code: "SAR", flag: "🇸🇦" },
  { country: "United Arab Emirates", countryAr: "الإمارات", code: "AED", flag: "🇦🇪" },
  { country: "Egypt", countryAr: "مصر", code: "EGP", flag: "🇪🇬" },
  { country: "Kuwait", countryAr: "الكويت", code: "KWD", flag: "🇰🇼" },
  { country: "Qatar", countryAr: "قطر", code: "QAR", flag: "🇶🇦" },
  { country: "Bahrain", countryAr: "البحرين", code: "BHD", flag: "🇧🇭" },
  { country: "Oman", countryAr: "عُمان", code: "OMR", flag: "🇴🇲" },
  { country: "Jordan", countryAr: "الأردن", code: "JOD", flag: "🇯🇴" },
  { country: "Turkey", countryAr: "تركيا", code: "TRY", flag: "🇹🇷" },
  { country: "United Kingdom", countryAr: "بريطانيا", code: "GBP", flag: "🇬🇧" },
  { country: "European Union", countryAr: "الاتحاد الأوروبي", code: "EUR", flag: "🇪🇺" },
  { country: "Switzerland", countryAr: "سويسرا", code: "CHF", flag: "🇨🇭" },
  { country: "Sweden", countryAr: "السويد", code: "SEK", flag: "🇸🇪" },
  { country: "Norway", countryAr: "النرويج", code: "NOK", flag: "🇳🇴" },
  { country: "Denmark", countryAr: "الدنمارك", code: "DKK", flag: "🇩🇰" },
  { country: "Poland", countryAr: "بولندا", code: "PLN", flag: "🇵🇱" },
  { country: "Russia", countryAr: "روسيا", code: "RUB", flag: "🇷🇺" },
  { country: "India", countryAr: "الهند", code: "INR", flag: "🇮🇳" },
  { country: "Pakistan", countryAr: "باكستان", code: "PKR", flag: "🇵🇰" },
  { country: "China", countryAr: "الصين", code: "CNY", flag: "🇨🇳" },
  { country: "Japan", countryAr: "اليابان", code: "JPY", flag: "🇯🇵" },
  { country: "South Korea", countryAr: "كوريا الجنوبية", code: "KRW", flag: "🇰🇷" },
  { country: "Indonesia", countryAr: "إندونيسيا", code: "IDR", flag: "🇮🇩" },
  { country: "Malaysia", countryAr: "ماليزيا", code: "MYR", flag: "🇲🇾" },
  { country: "Philippines", countryAr: "الفلبين", code: "PHP", flag: "🇵🇭" },
  { country: "Thailand", countryAr: "تايلاند", code: "THB", flag: "🇹🇭" },
  { country: "Vietnam", countryAr: "فيتنام", code: "VND", flag: "🇻🇳" },
  { country: "Brazil", countryAr: "البرازيل", code: "BRL", flag: "🇧🇷" },
  { country: "Mexico", countryAr: "المكسيك", code: "MXN", flag: "🇲🇽" },
  { country: "Canada", countryAr: "كندا", code: "CAD", flag: "🇨🇦" },
  { country: "Australia", countryAr: "أستراليا", code: "AUD", flag: "🇦🇺" },
  { country: "South Africa", countryAr: "جنوب أفريقيا", code: "ZAR", flag: "🇿🇦" },
  { country: "Nigeria", countryAr: "نيجيريا", code: "NGN", flag: "🇳🇬" },
];

/** Converts a USD cents amount into the smallest unit of the target
 *  currency, the way Stripe expects `unit_amount` for that currency
 *  (mostly "×100", except zero-decimal currencies like JPY/KRW/VND). */
const ZERO_DECIMAL: Set<CurrencyCode> = new Set(["JPY", "KRW", "VND", "IDR"]);

export function convertUsdCentsToCurrency(usdCents: number, currency: CurrencyCode): number {
  const usd = usdCents / 100;
  const converted = usd * RATES_TO_USD[currency];
  return ZERO_DECIMAL.has(currency) ? Math.round(converted) : Math.round(converted * 100);
}

export function formatMoney(amountInSmallestUnit: number, currency: CurrencyCode): string {
  const major = ZERO_DECIMAL.has(currency) ? amountInSmallestUnit : amountInSmallestUnit / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: ZERO_DECIMAL.has(currency) ? 0 : 2 }).format(major);
  } catch {
    return `${major.toFixed(ZERO_DECIMAL.has(currency) ? 0 : 2)} ${currency}`;
  }
}
