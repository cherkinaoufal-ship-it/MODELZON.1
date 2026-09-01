import { generateGraphic } from "@/lib/ai-graphic.functions";

/**
 * Client-side AI design-image pipeline (§3 of the overhaul brief).
 *
 * Priority order:
 *   1. The owner's OWN provider key (set in Settings → API Keys, stored in
 *      localStorage — never leaves the device except in the direct request
 *      to the provider they chose). Any OpenAI-compatible
 *      POST {baseUrl}/images/generations endpoint works (OpenAI gpt-image-1,
 *      or a compatible proxy). Runs straight from the browser, so it works
 *      even when the managed server gateway is unreachable.
 *   2. The managed MODELZON gateway (server function → Lovable AI Gateway).
 *
 * Both paths get the same internal quality prompt (flat print-ready
 * artwork, high detail, coherent palette, clean background) and one
 * automatic retry with a reinforced prompt before surfacing a friendly
 * error — never a raw "Not found".
 */

export interface AiProviderConfig {
  aiKey: string;
  aiBaseUrl: string;
  aiModel: string;
}

const STORAGE = "modelzon_api_keys_v1";

export const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_AI_MODEL = "gpt-image-1";

export function readAiProviderConfig(): AiProviderConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j.aiKey || typeof j.aiKey !== "string" || j.aiKey.trim().length < 8) return null;
    return {
      aiKey: j.aiKey.trim(),
      aiBaseUrl: (j.aiBaseUrl ?? DEFAULT_AI_BASE_URL).trim().replace(/\/+$/, ""),
      aiModel: (j.aiModel ?? DEFAULT_AI_MODEL).trim(),
    };
  } catch {
    return null;
  }
}

/** Internal quality prompt — §3(أ): always prepended, whatever the user
 *  typed, so results are print-ready garment graphics rather than
 *  photos/mockups. */
export function buildQualityPrompt(userPrompt: string, attempt = 0): string {
  const base =
    `High-detail flat graphic design for printing on a garment (T-shirt / hoodie print), ` +
    `centered isolated artwork on a transparent background, bold clean vector-style shapes, ` +
    `cohesive harmonious color palette, crisp edges, print-ready, no photo, no mockup, ` +
    `no garment, no frame, no watermark, no signature, no text unless explicitly requested. ` +
    `Design concept: ${userPrompt}`;
  if (attempt > 0) {
    return base + ` Emphasize craftsmanship: balanced composition, professional illustration quality, sharp details.`;
  }
  return base;
}

/** Vague / "surprise me" detection — §3: instead of erroring, these get 3
 *  concrete idea suggestions the user can tap. */
export function isVaguePrompt(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  const vague = [
    "فاجئني", "فاجئنى", "فاجئ", "ما أعرف", "ما اعرف", "لا أعرف", "لا اعرف",
    "أي شي", "اي شي", "أي شيء", "اي حاجة", "surprise", "random", "anything",
    "you choose", "choose for me", "i can't draw", "cant draw", "ما عندي", "idek", "شو",
  ];
  if (vague.some((v) => t.includes(v))) return true;
  // extremely short with no color/style/subject hints
  if (t.length < 8 && !/[\u0600-\u06FF]{4,}/.test(t)) return true;
  return false;
}

export interface DesignIdea {
  title: string;
  prompt: string;
  emoji: string;
  gradient: string;
}

const IDEA_POOL: DesignIdea[] = [
  {
    title: "نمر نيون ياباني", emoji: "🐅",
    prompt: "fierce Japanese-style tiger head with neon cyan and magenta outline strokes, streetwear graphic, bold and symmetrical",
    gradient: "from-fuchsia-500/40 to-cyan-500/40",
  },
  {
    title: "خط عربي ذهبي", emoji: "✒️",
    prompt: "elegant golden Arabic calligraphy lettering composition with flowing strokes and small geometric accents, luxury streetwear",
    gradient: "from-amber-500/40 to-fuchsia-500/40",
  },
  {
    title: "جمجمة سايبربانك", emoji: "💀",
    prompt: "cyberpunk skull with circuit-board lines, glitch effect, electric violet and teal palette, high contrast streetwear",
    gradient: "from-violet-500/40 to-emerald-500/40",
  },
  {
    title: "وردة ميكانيكية", emoji: "🥀",
    prompt: "a rose blooming through broken mechanical gears, dark background elements removed, crimson and steel-blue palette, detailed illustration",
    gradient: "from-rose-500/40 to-slate-400/40",
  },
  {
    title: "فضاء ريترو", emoji: "🚀",
    prompt: "retro 80s space scene: astronaut helmet reflection with planets, sunset gradient of orange pink and deep blue, synthwave style",
    gradient: "from-orange-500/40 to-indigo-500/40",
  },
  {
    title: "تنين خطوط حرة", emoji: "🐉",
    prompt: "dragon coiled into a circle, single-weight minimal line art, one accent color, modern minimal streetwear logo style",
    gradient: "from-emerald-500/40 to-cyan-500/40",
  },
  {
    title: "عين الصقر", emoji: "🦅",
    prompt: "hyper-detailed hawk eye with geometric feather rays spreading outward, gold and midnight blue, heraldic streetwear emblem",
    gradient: "from-amber-400/40 to-blue-600/40",
  },
  {
    title: "موجة تسونامي", emoji: "🌊",
    prompt: "great wave in ukiyo-e style reimagined with neon gradients, foam details, cyan-magenta palette, dynamic composition",
    gradient: "from-cyan-400/40 to-fuchsia-500/40",
  },
  {
    title: "قلب من زجاج", emoji: "💔",
    prompt: "anatomical heart made of cracked glass with glowing seams, iridescent shards, dark aesthetic illustration",
    gradient: "from-rose-500/40 to-violet-500/40",
  },
];

/** 3 distinct idea suggestions for the "surprise me" path. */
export function suggestDesignIdeas(): DesignIdea[] {
  const pool = [...IDEA_POOL];
  const picks: DesignIdea[] = [];
  while (picks.length < 3 && pool.length > 0) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
  }
  return picks;
}

/* ------------------------------------------------------------------ */
/* generation                                                         */
/* ------------------------------------------------------------------ */

async function generateWithOwnKey(cfg: AiProviderConfig, prompt: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${cfg.aiBaseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.aiKey}`,
    },
    body: JSON.stringify({
      model: cfg.aiModel,
      prompt,
      n: 1,
      size: "1024x1024",
      ...(cfg.aiModel.startsWith("gpt-image") ? { background: "transparent" } : {}),
    }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PROVIDER_${res.status}: ${text.slice(0, 160)}`);
  }
  const json = await res.json();
  const item = json?.data?.[0];
  const b64: string | undefined = item?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;
  const url: string | undefined = item?.url;
  if (url) return url;
  throw new Error("PROVIDER_NO_IMAGE");
}

async function generateViaGateway(
  call: (input: { data: { userId: string; prompt: string; transparentBackground: boolean } }) => Promise<{ imageUrl: string }>,
  userId: string,
  prompt: string,
): Promise<string> {
  const result = await call({ data: { userId, prompt, transparentBackground: true } });
  if (!result?.imageUrl) throw new Error("GATEWAY_NO_IMAGE");
  return result.imageUrl;
}

export interface GenerateDesignResult {
  imageUrl: string;
  via: "own" | "gateway";
}

/** Full pipeline with §3's quality rules: quality prompt prepended, one
 *  automatic regeneration attempt on failure/empty result, and a friendly
 *  localized error (never raw "Not found"). `gatewayCall` is the
 *  useServerFn(generateGraphic) handle created once by the calling
 *  component (hooks can't run inside this plain async function). */
export async function generateDesignImage(input: {
  userId: string;
  prompt: string;
  gatewayCall: (input: { data: { userId: string; prompt: string; transparentBackground: boolean } }) => Promise<{ imageUrl: string }>;
}): Promise<GenerateDesignResult> {
  const cfg = readAiProviderConfig();

  // attempt 0 = normal, attempt 1 = reinforced retry
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildQualityPrompt(input.prompt, attempt);
    if (cfg) {
      try {
        const imageUrl = await generateWithOwnKey(cfg, prompt);
        return { imageUrl, via: "own" };
      } catch {
        if (attempt === 1) break; // own key failed twice → try the gateway
        continue;
      }
    }
    try {
      const imageUrl = await generateViaGateway(input.gatewayCall, input.userId, prompt);
      return { imageUrl, via: "gateway" };
    } catch {
      if (attempt === 1) break;
    }
  }

  // own key failed twice → one last try via the managed gateway
  try {
    const imageUrl = await generateViaGateway(input.gatewayCall, input.userId, buildQualityPrompt(input.prompt, 1));
    return { imageUrl, via: "gateway" };
  } catch {
    /* fall through to the friendly error */
  }

  throw new Error("AI_GENERATION_FAILED");
}

/** Localized friendly error text for the UI. */
export function aiErrorText(error: unknown, lang: "ar" | "en"): string {
  return lang === "ar"
    ? "تعذر إنشاء التصميم، حاول مجددًا"
    : "Couldn't create the design — please try again";
}
