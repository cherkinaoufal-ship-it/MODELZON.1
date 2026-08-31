import type { Lang } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Sparkles, Wand2, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateDesign, getChatQuota } from "@/lib/ai-design.functions";
import { useAuth } from "@/lib/auth";
import type { GarmentType } from "@/components/Studio3D";

type Msg = {
  id: number;
  role: "user" | "assistant";
  content: string;
  design?: { garment: string; color: string; accent: string; vibe: string } | null;
};

interface Props {
  onApply: (garment: GarmentType, color: string) => void;
  lang: Lang;
}

const SUGGESTIONS_EN = [
  "Design a cyber-Tokyo neon hoodie",
  "Y2K holographic tee for me",
  "Surprise me — I can't draw!",
];
const SUGGESTIONS_AR = [
  "صمم لي هودي نيون طوكيو",
  "تيشيرت هولوغرافيك Y2K",
  "فاجئني — ما أعرف أرسم!",
];

export default function AIDesignChat({ onApply, lang }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const call = useServerFn(generateDesign);
  const quotaFn = useServerFn(getChatQuota);
  const { user } = useAuth();
  const [quota, setQuota] = useState<{ remaining: number; max: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    quotaFn({ data: { userId: user.id } }).then(setQuota).catch(() => {});
  }, [user, quotaFn]);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: "assistant",
      content: t(
        "Hey! I'm your MODELZON AI stylist. Tell me a vibe and I'll design a piece for you — even if you can't draw.",
        "أهلاً! أنا مصممك الذكي في MODELZON. قل لي الأجواء وأصمم لك قطعة — حتى لو ما تعرف ترسم.",
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

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    if (!user) {
      setMessages((m) => [...m, { id: idRef.current++, role: "assistant", content: t("Please sign in first.", "سجّل دخولك أولاً.") }]);
      return;
    }
    const userMsg: Msg = { id: idRef.current++, role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setBusy(true);
    try {
      const res = await call({
        data: {
          userId: user.id,
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      const aMsg: Msg = {
        id: idRef.current++,
        role: "assistant",
        content: res.reply || "…",
        design: res.design,
      };
      setMessages((m) => [...m, aMsg]);
      setQuota((q) => (q ? { ...q, remaining: Math.max(0, q.remaining - 1) } : q));
    } catch (e: any) {
      const raw: string = e?.message ?? "AI unavailable";
      const friendly = raw.startsWith("RATE_LIMITED")
        ? t("You're sending messages too fast — take a short break and try again.", "ترسل رسايل بسرعة كبيرة — استريح شوي وحاول مرة ثانية.")
        : raw;
      setMessages((m) => [...m, { id: idRef.current++, role: "assistant", content: `⚠ ${friendly}` }]);
    } finally {
      setBusy(false);
    }
  };

  const apply = (d: NonNullable<Msg["design"]>) => {
    const g = (["tee", "hoodie", "cap", "pants"] as const).includes(d.garment as any)
      ? (d.garment as GarmentType)
      : "hoodie";
    onApply(g, d.color);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.5)]">
          <Bot size={14} className="text-black" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-widest">{t("AI Stylist", "المصمم الذكي")}</div>
          <div className="text-[10px] text-white/40 -mt-0.5">{t("Designs for you", "يصمم لك")}</div>
        </div>
        <Sparkles size={14} className="text-fuchsia-300 animate-pulse" />
      </div>

      {quota && quota.remaining <= 5 && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-400/20 text-[10px] text-amber-200 text-center">
          {quota.remaining === 0
            ? t("Message limit reached — try again in a few minutes.", "وصلت للحد الأقصى للرسائل — حاول بعد شوي.")
            : t(`${quota.remaining} messages left for now`, `باقي لك ${quota.remaining} رسايل حالياً`)}
        </div>
      )}

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
                    : "bg-white/[0.06] border border-white/10 text-white/90"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.design && (
                  <div className="mt-2 rounded-xl p-2 bg-black/40 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md border border-white/20" style={{ background: m.design.color }} />
                      <div className="w-6 h-6 rounded-md border border-white/20" style={{ background: m.design.accent }} />
                      <span className="text-[10px] font-bold text-white/70 uppercase tracking-wide">{m.design.vibe}</span>
                      <span className="ml-auto text-[10px] text-cyan-300 font-mono">{m.design.garment}</span>
                    </div>
                    <button
                      onClick={() => apply(m.design!)}
                      className="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black font-black text-[11px] flex items-center justify-center gap-1 shadow-[0_0_15px_rgba(6,182,212,0.5)] hover:scale-[1.02] transition"
                    >
                      <Wand2 size={12} /> {t("Apply to Studio", "طبّق في الاستوديو")}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy && (
          <div className="flex items-center gap-2 text-white/50 text-xs">
            <Loader2 size={12} className="animate-spin" />
            {t("Designing…", "يصمم…")}
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
          placeholder={t("Describe a vibe…", "صف لي الأجواء…")}
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
