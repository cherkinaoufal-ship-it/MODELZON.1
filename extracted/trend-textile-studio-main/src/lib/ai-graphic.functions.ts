import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * AI Graphic Assistant — an in-house "describe it, get a printable graphic"
 * tool for people who can't draw, generating an actual image (not just a
 * color/vibe suggestion like AI Design Chat does).
 *
 * Honesty note, since this was explicitly requested as "connect to Canva
 * and give people Canva Pro's paid features for free": that specific thing
 * isn't something a from-scratch API integration can do — Canva doesn't
 * expose a way to unlock its own paid tier for someone else's users for
 * free, and building that would mean either violating Canva's terms or
 * needing an actual paid partnership with them, neither of which is a
 * software integration task. What this ships instead is the honest
 * equivalent in spirit: MODELZON's own AI image generator (via the same
 * Lovable AI Gateway already used elsewhere in this app), with a real free
 * daily allowance, generous enough to matter but ratio'd to each
 * subscription tier so it doesn't become an unlimited free image-gen API.
 *
 * ⚠️ MODEL NAME UNVERIFIED: `google/gemini-2.5-flash-image-preview` below
 * is Lovable AI Gateway's documented image-generation model as of this
 * project's last known docs snapshot — confirm it's still current at
 * https://docs.lovable.dev before relying on this in production (can't be
 * checked from this offline sandbox). If the gateway rejects the model
 * name, that's the first thing to fix.
 */

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key);
}

/** Daily free generations per subscription tier. Free users still get a
 *  real daily allowance (not zero) — the point is "some real value every
 *  day", not a paywall dressed up as a feature. */
const DAILY_LIMIT: Record<string, number> = { free: 3, basic: 6, pro: 12, elite: 25 };

const GenerateInput = z.object({
  userId: z.string().uuid(),
  prompt: z.string().min(2).max(500),
  /** transparent background is almost always what you want for a garment
   *  print — opaque is offered for e.g. all-over patterns. */
  transparentBackground: z.boolean().default(true),
});

export const generateGraphic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();

    const { data: profile } = await admin.from("profiles").select("subscription_tier").eq("id", data.userId).single();
    const tier = profile?.subscription_tier ?? "free";
    const limit = DAILY_LIMIT[tier] ?? DAILY_LIMIT.free;

    const { data: allowed, error: rpcErr } = await admin.rpc("check_and_log_ai_request", {
      p_user_id: data.userId,
      p_kind: "graphic",
      p_max_per_window: limit,
      p_window_minutes: 24 * 60,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (!allowed) throw new Error(`RATE_LIMITED: daily free graphic limit reached (${limit}/day on your plan) — resets in 24h, or upgrade for a higher daily allowance.`);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const stylePrompt = `A bold, high-contrast graphic design suitable for printing on a garment: ${data.prompt}. ${
      data.transparentBackground ? "Transparent background, isolated artwork, no mockup, no garment, just the graphic itself." : "Full-bleed pattern, edge to edge."
    } Vector-style, clean shapes, print-ready, no text watermark.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: stylePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Gateway rate limit — try again in a moment.");
      if (res.status === 402) throw new Error("AI image credits exhausted — please top up the Lovable AI Gateway.");
      throw new Error(`AI image error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    // Lovable AI Gateway returns generated images as base64 data URLs on
    // the message — shape per their docs snapshot at build time; adjust
    // this extraction if the actual response shape differs.
    const imageUrl: string | undefined =
      json.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? json.choices?.[0]?.message?.image_url;
    if (!imageUrl) throw new Error("AI Gateway didn't return an image — check the response shape against current Lovable docs.");

    return { imageUrl };
  });

const QuotaInput = z.object({ userId: z.string().uuid() });

export const getGraphicQuota = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => QuotaInput.parse(d))
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("subscription_tier").eq("id", data.userId).single();
    const tier = profile?.subscription_tier ?? "free";
    const limit = DAILY_LIMIT[tier] ?? DAILY_LIMIT.free;
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count } = await admin.from("ai_requests").select("id", { count: "exact", head: true }).eq("user_id", data.userId).eq("kind", "graphic").gt("created_at", since);
    return { remaining: Math.max(0, limit - (count ?? 0)), max: limit, tier };
  });
