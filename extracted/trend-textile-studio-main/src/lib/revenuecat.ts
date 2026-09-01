import { Capacitor } from "@capacitor/core";
import type { SubTier } from "./subscription.functions";

/**
 * Google Play Billing compliance layer.
 *
 * Google Play policy requires any subscription bought *inside* an Android
 * app to go through Google Play Billing — a Stripe-only checkout (what this
 * app had before) is a real rejection risk on Android. RevenueCat wraps
 * Google Play Billing behind a normal-looking purchase API, so this file is
 * the ONLY place that decides which payment rail to use:
 *   - running as a native Android app (Capacitor) → RevenueCat / Google Play Billing
 *   - anywhere else (mobile web, desktop web, iOS web) → existing Stripe flow, unchanged
 *
 * Setup still required outside of code (can't be done from this sandbox):
 *  1. `npm install @revenuecat/purchases-capacitor` then `npx cap sync android`.
 *  2. Create the app + 3 subscription products (basic/pro/elite monthly) in
 *     the RevenueCat dashboard, linked to matching Google Play Console
 *     in-app products with the SAME ids as TIER_PRICES_CENTS keys below.
 *  3. Put the RevenueCat Android public SDK key in VITE_REVENUECAT_ANDROID_API_KEY.
 *  4. Point a RevenueCat webhook at /api/revenuecat-webhook (see that file).
 */

const PRODUCT_IDS: Record<SubTier, string> = {
  basic: "modelzon_basic_monthly",
  pro: "modelzon_pro_monthly",
  elite: "modelzon_elite_monthly",
};

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

let initialized = false;

/** Call once, as early as possible after the user's id is known (e.g. on login). */
export async function initRevenueCat(userId: string): Promise<void> {
  if (!isNativeAndroid() || initialized) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined;
  if (!apiKey) {
    console.error("Missing VITE_REVENUECAT_ANDROID_API_KEY — Android subscriptions will fail Google Play review without it.");
    return;
  }
  // Dynamic import: this package only needs to exist in the native Android
  // build, and dynamic import keeps the web bundle from requiring it.
  const { Purchases, LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
  await Purchases.configure({ apiKey, appUserID: userId });
  await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });
  initialized = true;
}

export type PurchaseResult = { ok: true; tier: SubTier } | { ok: false; cancelled: boolean; message?: string };

/** Buys a tier through Google Play Billing. Only call this on native Android. */
export async function purchaseTierNative(tier: SubTier): Promise<PurchaseResult> {
  if (!isNativeAndroid()) return { ok: false, cancelled: false, message: "Not on native Android" };
  const { Purchases } = await import("@revenuecat/purchases-capacitor");

  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages.find((p) => p.product.identifier === PRODUCT_IDS[tier]);
  if (!pkg) return { ok: false, cancelled: false, message: `Product ${PRODUCT_IDS[tier]} not configured in RevenueCat offerings` };

  try {
    await Purchases.purchasePackage({ aPackage: pkg });
    // The actual entitlement write to Supabase happens server-side via the
    // RevenueCat webhook (see /api/revenuecat-webhook) — that's the source
    // of truth Google/RevenueCat themselves confirm, not this client call.
    return { ok: true, tier };
  } catch (e: any) {
    return { ok: false, cancelled: Boolean(e?.userCancelled), message: e?.message };
  }
}

export async function restorePurchasesNative(): Promise<void> {
  if (!isNativeAndroid()) return;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  await Purchases.restorePurchases();
}

/** Opens Google Play's own subscription management screen — the Android
 * equivalent of Stripe's Customer Portal, and required by Play policy
 * (users must be able to cancel through Google, not just in-app). */
export async function openNativeSubscriptionManagement(): Promise<void> {
  if (!isNativeAndroid()) return;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const info = await Purchases.getCustomerInfo();
  const url = info.customerInfo.managementURL;
  if (url) window.open(url, "_system");
}
