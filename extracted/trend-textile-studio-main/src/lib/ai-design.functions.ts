import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const InputSchema = z.object({
  userId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1),
});

// Abuse protection: caps how many AI Design Chat calls one user can make in
// a rolling window, enforced in Postgres (public.check_and_log_ai_request,
// see 008_ai_rate_limit.sql) so it can't be bypassed by calling this
// server function directly. Generous enough for real use, tight enough to
// stop a script from draining the LOVABLE_API_KEY credit balance.
const CHAT_MAX_PER_WINDOW = 30;
const CHAT_WINDOW_MINUTES = 10;

async function checkRateLimit(userId: string) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  const admin = createClient(url, key);
  const { data, error } = await admin.rpc("check_and_log_ai_request", {
    p_user_id: userId,
    p_kind: "chat",
    p_max_per_window: CHAT_MAX_PER_WINDOW,
    p_window_minutes: CHAT_WINDOW_MINUTES,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("RATE_LIMITED: too many AI requests — try again in a few minutes.");
}

const QuotaInput = z.object({ userId: z.string().uuid() });

/** Lets the UI show "X messages left" BEFORE the user hits the wall,
 *  instead of only finding out via an error after sending. Read-only —
 *  doesn't log a request itself, just counts recent ones. */
export const getChatQuota = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => QuotaInput.parse(d))
  .handler(async ({ data }) => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase service-role configuration");
    const admin = createClient(url, key);
    const since = new Date(Date.now() - CHAT_WINDOW_MINUTES * 60_000).toISOString();
    const { count, error } = await admin
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.userId)
      .eq("kind", "chat")
      .gt("created_at", since);
    if (error) throw new Error(error.message);
    return { remaining: Math.max(0, CHAT_MAX_PER_WINDOW - (count ?? 0)), max: CHAT_MAX_PER_WINDOW, windowMinutes: CHAT_WINDOW_MINUTES };
  });

const SYSTEM = `You are MODELZON's AI Fashion Design Assistant. You help users who can't draw create stunning 3D garment designs.

You MUST respond with a JSON object of shape:
{
  "reply": "<short helpful message in the user's language, 1-3 sentences>",
  "design": {
    "garment": "tee" | "hoodie" | "cap" | "pants",
    "color": "#RRGGBB",
    "accent": "#RRGGBB",
    "vibe": "<2-5 word style label>"
  } | null
}

Set "design" when the user asks for a design idea, color combo, or style. Keep colors punchy and futuristic (neon, holographic, cyberpunk, Y2K, techwear). Otherwise set design to null and just chat.

Respond ONLY with the JSON object, no markdown, no code fences.`;

export const generateDesign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    await checkRateLimit(data.userId);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        // Bug fix: this was "google/gemini-3.6-flash" — not a real Gemini
        // model, so the AI Gateway rejected every single call and the
        // whole AI Design Chat looked "broken" from the user's side. This
        // is almost certainly why the AI icon appeared non-functional
        // throughout the app — verify against https://docs.lovable.dev
        // for the current supported model list before relying on this.
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          ...data.messages,
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up.");
      throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { reply: string; design: null | { garment: string; color: string; accent: string; vibe: string } };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { reply: content || "…", design: null };
    }
    return parsed;
  });
