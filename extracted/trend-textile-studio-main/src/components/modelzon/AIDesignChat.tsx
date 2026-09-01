import type { Lang } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Loader2, RefreshCcw, Send, Sparkles, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateGraphic } from "@/lib/ai-graphic.functions";
import {
  aiErrorText, generateDesignImage, isVaguePrompt, suggestDesignIdeas, type DesignIdea,
} from "@/lib/ai-image";
import { useAuth } from "@/lib/auth";

/**
 * AI Stylist chat (§3 of the overhaul brief) — actually generates printable
 * designs now:
 *  • any descriptive message (ar/en) → a real PNG via the AI image pipeline
 *    (own provider key from Settings → API Keys, with the managed gateway
 *    as fallback) with an internal quality prompt + one auto-regeneration;
 *  • vague messages ("فاجئني — ما أعرف أرسم!") → 3 concrete design-idea
 *    thumbnails to pick from instead of an error;
 *  • failures show a friendly "تعذر إنشاء التصميم، حاول مجددًا" with a
 *    retry button — never a raw "Not found";
 *  • every result has "تطبيق على القطعة" which drops it straight onto the
 *    mockup board's active panel (same handles as uploaded artwork).
 */

type Msg = {
  id: number;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  ideas?: DesignIdea[];
  failed?: boolean;
  /** the prompt to resend when tapping "إعادة المحاولة" */
  retryPrompt?: string;
};

interface Props {
  onApplyDesign: (imageUrl: string) => void;
  lang: Lang;
}

const SUGGESTIONS_EN = [
  "Design a cyber-Tokyo neon hoodie graphic",
  "Golden Arabic calligraphy print",
  "Surprise me — I can't draw!",
];
const SUGGESTIONS_AR = [
  "صمم لي رسمة نيون طوكيو",
  "خط عربي ذهبي للطباعة",
  "فاجئني — ما أعرف أرسم!",
];

export default function AIDesignChat({ onApplyDesign, lang }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const gatewayCall = useServerFn(generateGraphic);
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: "assistant",
      content: t(
        "Hey! I'm your MODELZON AI designer. Describe anything — colors, style, vibe — and I'll create a print-ready graphic you can drop straight onto the garment.",
        "أهلاً! أنا مصممك الذكي في MODELZON. اوصف أي شي — ألوان، ستايل، أجواء — وأصنع لك رسمة جاهزة للطباعة تحطها على القطعة مباشرة.",
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e6, behavior: "smooth" });
  }, [messages, busy]);

  const generate = async (rawPrompt: string) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const result = await generateDesignImage({
        userId: user.id,
        prompt: rawPrompt,
        gatewayCall: gatewayCall as any,
      });
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: "assistant",
          content: t("Design is ready ✨ apply it to the piece:", "تصميمك جاهز ✨ طبّقه على القطعة:"),
          imageUrl: result.imageUrl,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: "assistant",
          content: `${aiErrorText(e, lang === "ar" ? "ar" : "en")}\n${t(
            "(Set your own provider key in Settings → API Keys for guaranteed generation.)",
            "(حط مفتاح مزودك الخاص من الإعدادات ← مفاتيح API عشان توليد مضمون.)",
          )}`,
          failed: true,
          retryPrompt: rawPrompt,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    if (!user) {
      setMessages((m) => [...m, { id: idRef.current++, role: "assistant", content: t("Please sign in first.", "سجّل دخولك أولاً.") }]);
      return;
    }
    setMessages((m) => [...m, { id: idRef.current++, role: "user", content: text }]);
    setInput("");

    if (isVaguePrompt(text)) {
      // vague / "surprise me" → 3 concrete ideas to pick from (§3)
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: "assistant",
          content: t("I got you! Here are 3 ideas — tap one and I'll design it:", "على راسي! هذي ٣ أفكار — اختر وحدة وأصممها لك:"),
          ideas: suggestDesignIdeas(),
        },
      ]);
      return;
    }
    await generate(text);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.5)]">
          <Bot size={14} className="text-black" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-widest">{t("AI Stylist", "المصمم الذكي")}</div>
          <div className="text-[10px] text-white/40 -mt-0.5">{t("Creates real printable designs", "يولّد تصاميم حقيقية للطباعة")}</div>
        </div>
        <Sparkles size={14} className="text-fuchsia-300 animate-pulse" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-cyan-500 to-fuchsia-500 text-black font-semibold"
                    : m.failed
                      ? "bg-red-500/10 border border-red-400/30 text-red-100"
                      : "bg-white/[0.06] border border-white/10 text-white/90"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* 3 idea thumbnails for vague requests */}
                {m.ideas && (
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    {m.ideas.map((idea) => (
                      <button
                        key={idea.title}
                        disabled={busy}
                        onClick={() => {
                          setMessages((ms) => [...ms, { id: idRef.current++, role: "user", content: idea.title }]);
                          void generate(idea.prompt);
                        }}
                        className={`rounded-xl p-2 bg-gradient-to-br ${idea.gradient} border border-white/15 hover:border-cyan-300/60 flex flex-col items-center gap-1 transition disabled:opacity-40`}
                      >
                        <span className="text-xl leading-none">{idea.emoji}</span>
                        <span className="text-[9px] font-black text-white/90 text-center leading-tight">{idea.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* generated design + apply button */}
                {m.imageUrl && (
                  <div className="mt-2 rounded-xl overflow-hidden bg-black/40 border border-white/10">
                    <img src={m.imageUrl} alt="" className="w-full max-h-56 object-contain bg-[repeating-conic-gradient(#1a1a24_0%_25%,#101018_0%_50%)] bg-[length:22px_22px]" />
                    <button
                      onClick={() => onApplyDesign(m.imageUrl!)}
                      className="w-full py-2 rounded-b-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black font-black text-[11px] flex items-center justify-center gap-1 hover:brightness-110 transition"
                    >
                      <Wand2 size={12} /> {t("تطبيق على القطعة", "Apply to garment")}
                    </button>
                  </div>
                )}

                {/* retry button on failures */}
                {m.failed && m.retryPrompt && (
                  <button
                    onClick={() => { setMessages((ms) => ms.filter((x) => x.id !== m.id)); void generate(m.retryPrompt!); }}
                    disabled={busy}
                    className="mt-2 w-full py-2 rounded-lg bg-white/10 border border-white/20 text-white/85 text-[11px] font-black flex items-center justify-center gap-1.5 hover:bg-white/20 transition disabled:opacity-40"
                  >
                    <RefreshCcw size={12} /> {t("إعادة المحاولة", "Try again")}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex items-center gap-2 text-white/50 text-xs">
            <Loader2 size={12} className="animate-spin" />
            {t("جاري إنشاء التصميم…", "Creating your design…")}
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {(lang === "ar" ? SUGGESTIONS_AR : SUGGESTIONS_EN).map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400/40 text-white/70 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="p-3 border-t border-white/10 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("صف التصميم…", "Describe a design…")}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-400/60 placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black flex items-center justify-center font-bold disabled:opacity-40 shadow-[0_0_12px_rgba(6,182,212,0.5)]"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
