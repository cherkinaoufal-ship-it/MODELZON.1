import type { Lang } from "@/lib/i18n";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Wand2, Loader2, Sparkles, RefreshCcw } from "lucide-react";
import { generateGraphic } from "@/lib/ai-graphic.functions";
import { aiErrorText, generateDesignImage } from "@/lib/ai-image";

interface Props {
  userId: string;
  lang: Lang;
  onGenerated: (imageUrl: string) => void;
}

/**
 * "AI Graphic Assistant" — describe an idea, get back an actual printable
 * graphic. Now runs on the shared pipeline (own provider key from Settings
 * → API Keys first, managed MODELZON gateway as fallback), with the
 * internal quality prompt, one automatic regeneration, friendly Arabic
 * error text and a retry button (§3).
 */
export default function AIGraphicAssistant({ userId, lang, onGenerated }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const gatewayCall = useServerFn(generateGraphic);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const run = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setLastPrompt(text.trim());
    try {
      const result = await generateDesignImage({ userId, prompt: text.trim(), gatewayCall: gatewayCall as any });
      setPreview(result.imageUrl);
    } catch (e) {
      setError(aiErrorText(e, lang === "ar" ? "ar" : "en"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl p-3 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 border border-fuchsia-400/20 space-y-2">
      <div className="flex items-center gap-2">
        <Wand2 size={13} className="text-fuchsia-300" />
        <span className="text-[11px] font-black uppercase tracking-wide text-fuchsia-200">
          {t("AI Graphic Assistant", "مساعد الرسوم بالذكاء الاصطناعي")}
        </span>
      </div>
      <p className="text-[10px] text-white/40">
        {t("Can't draw? Describe the graphic and get a print-ready image.", "ما تعرف ترسم؟ اوصف الرسمة واحصل على صورة جاهزة للطباعة.")}
      </p>

      <div className="flex gap-1.5">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(prompt)}
          placeholder={t("e.g. neon tiger head, minimal line art", "مثال: رأس نمر نيون، رسمة خطوط بسيطة")}
          className="flex-1 rounded-lg bg-black/40 border border-white/10 text-xs px-2.5 py-2 text-white outline-none focus:border-fuchsia-400/50"
        />
        <button
          onClick={() => run(prompt)}
          disabled={busy || !prompt.trim()}
          className="px-3 rounded-lg bg-fuchsia-500/25 border border-fuchsia-400/40 text-fuchsia-100 disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-[10px] text-red-300">{error}</p>
          <button
            onClick={() => lastPrompt && run(lastPrompt)}
            disabled={busy}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white/80 text-[10px] font-black disabled:opacity-40"
          >
            <RefreshCcw size={10} /> {t("إعادة المحاولة", "Retry")}
          </button>
        </div>
      )}

      {preview && (
        <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/10 p-2">
          <img src={preview} alt="" className="w-14 h-14 object-contain rounded bg-white/5" />
          <button
            onClick={() => onGenerated(preview)}
            className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-[11px] font-bold"
          >
            {t("Use this artwork", "استخدم هذي الرسمة")}
          </button>
        </div>
      )}
    </div>
  );
}
