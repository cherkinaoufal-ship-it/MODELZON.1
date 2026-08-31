import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GenerateInput = z.object({ hint: z.string().max(200).optional() });

/** "AI makes a shop for people who don't know how to design one" — a
 *  simple branding generator (name + tagline + a matching gradient) using
 *  the same Lovable AI Gateway text model as AI Design Chat. */
export const generateShopBranding = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              'You name streetwear/clothing brand shops. Respond ONLY with JSON: {"name": "...", "tagline": "...", "colorFrom": "#hex", "colorTo": "#hex"}. Name under 24 chars, tagline under 60 chars, colors should be a striking neon gradient.',
          },
          { role: "user", content: data.hint?.trim() || "Surprise me with something bold and modern." },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    return {
      name: String(parsed.name ?? "My Shop").slice(0, 24),
      tagline: String(parsed.tagline ?? "").slice(0, 60),
      colorFrom: /^#[0-9a-f]{6}$/i.test(parsed.colorFrom) ? parsed.colorFrom : "#22d3ee",
      colorTo: /^#[0-9a-f]{6}$/i.test(parsed.colorTo) ? parsed.colorTo : "#d946ef",
    };
  });
