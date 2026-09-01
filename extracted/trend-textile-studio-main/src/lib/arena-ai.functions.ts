import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const JudgeInput = z.object({
  userId: z.string().uuid(),
  lang: z.enum(["en", "ar"]),
  garment: z.string(),
  color: z.string(),
  topic: z.string(),
  description: z.string().min(1).max(1200),
  decalImage: z.string().startsWith("data:image").nullable().optional(),
});

const ChallengeInput = z.object({
  userId: z.string().uuid(),
  lang: z.enum(["en", "ar"]),
  garment: z.string(),
});

// Abuse protection — same pattern as ai-design.functions.ts. The judge call
// is the more expensive one (multimodal, larger model), so it gets a
// tighter cap than the lightweight challenge generator.
async function checkRateLimit(userId: string, kind: "judge" | "challenge", maxPerWindow: number, windowMinutes: number) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  const admin = createClient(url, key);
  const { data, error } = await admin.rpc("check_and_log_ai_request", {
    p_user_id: userId,
    p_kind: kind,
    p_max_per_window: maxPerWindow,
    p_window_minutes: windowMinutes,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("RATE_LIMITED: too many AI requests — try again in a few minutes.");
}

async function callGateway(system: string, user: string, opts?: { model?: string; imageDataUrl?: string | null }) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const userContent = opts?.imageDataUrl
    ? [
        { type: "text", text: user },
        { type: "image_url", image_url: { url: opts.imageDataUrl } },
      ]
    : user;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      // Same fix as ai-design.functions.ts — "gemini-3.6-flash" and
      // "gemini-3.1-pro-preview" (below) aren't real model ids, which
      // meant every judge/challenge call was failing at the Gateway.
      model: opts?.model ?? "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
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
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

const JUDGE_SYSTEM = `You are the MODELZON Arena Judge, an expert fashion & graphic design critic. Players design real 3D garments BY HAND and describe them; when an artwork image is attached, you are LOOKING AT THE ACTUAL DESIGN the player made — judge what you SEE first, and treat their written description as supporting context only, not a substitute for the image.
You never dictate what they should design — you only evaluate what they made, fairly and encouragingly.

Return ONLY this JSON:
{
  "score": <number 0-10, one decimal>,
  "creativity": <0-10>,
  "craft": <0-10>,
  "topicFit": <0-10>,
  "verdict": "<one short sentence>",
  "strengths": ["<short>", "<short>"],
  "improve": ["<short>", "<short>"]
}
Write all text in the requested language.`;

export const judgeDesign = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => JudgeInput.parse(d))
  .handler(async ({ data }) => {
    await checkRateLimit(data.userId, "judge", 15, 10);
    const out = await callGateway(
      JUDGE_SYSTEM,
      `Language: ${data.lang}
Arena topic (chosen by the community): ${data.topic}
Garment: ${data.garment}
Base color: ${data.color}
${data.decalImage ? "The attached image is a real render of the finished garment in the 3D studio — shape, base color, printed artwork, and any hand-painted details all together. Judge the whole garment as shown, not just an isolated logo." : "No garment image was provided — judge from the description alone."}
Player's own description of the design they hand-drew:
${data.description}`,
      // A stronger reasoning model for the actual judging call — this is the
      // "design-specialized" upgrade: it's multimodal (can see the artwork
      // image, not just read text about it) and reasons more carefully than
      // the fast chat model used for casual assistant replies.
      { model: "google/gemini-2.5-pro", imageDataUrl: data.decalImage ?? null },
    );
    return {
      score: Number(out["score"] ?? 0),
      creativity: Number(out["creativity"] ?? 0),
      craft: Number(out["craft"] ?? 0),
      topicFit: Number(out["topicFit"] ?? 0),
      verdict: String(out["verdict"] ?? ""),
      strengths: Array.isArray(out["strengths"]) ? (out["strengths"] as string[]) : [],
      improve: Array.isArray(out["improve"]) ? (out["improve"] as string[]) : [],
    };
  });

const CHALLENGE_SYSTEM = `You invent optional practice challenges for MODELZON: a reference design that the player must then RECREATE by hand.
Return ONLY this JSON:
{
  "title": "<3-6 words>",
  "brief": "<2 sentences describing exactly what the reference design looks like>",
  "steps": ["<short hand-drawing step>", "<short>", "<short>", "<short>"],
  "colors": ["#RRGGBB", "#RRGGBB", "#RRGGBB"]
}
Write text in the requested language.`;

export const generateChallenge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ChallengeInput.parse(d))
  .handler(async ({ data }) => {
    await checkRateLimit(data.userId, "challenge", 20, 10);
    const out = await callGateway(
      CHALLENGE_SYSTEM,
      `Language: ${data.lang}. Garment: ${data.garment}. Make it drawable by hand with brushes, stitches and spray.`,
    );
    return {
      title: String(out["title"] ?? ""),
      brief: String(out["brief"] ?? ""),
      steps: Array.isArray(out["steps"]) ? (out["steps"] as string[]) : [],
      colors: Array.isArray(out["colors"]) ? (out["colors"] as string[]) : [],
    };
  });
