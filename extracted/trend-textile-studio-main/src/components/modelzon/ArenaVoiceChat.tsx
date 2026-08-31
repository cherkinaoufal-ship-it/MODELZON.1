import type { Lang } from "@/lib/i18n";
import { useState } from "react";
import { Mic, Send } from "lucide-react";

interface ChatMsg {
  id: number;
  name: string;
  level: number;
  verified?: boolean;
  time: string;
  text: string;
}

const INITIAL_MESSAGES: ChatMsg[] = [
  { id: 1, name: "Ahmad_KSA", level: 42, time: "12:01", text: "جاهز للتحدي يا شباب! 🔥" },
  { id: 2, name: "CyberTaylor", level: 51, verified: true, time: "12:02", text: "Let's see who gets the 9.5+ rating today!" },
];

const CHIPS = [
  { emoji: "🔥", en: "Drip 10/10", ar: "درب 10/10" },
  { emoji: "🎨", en: "Need Spray", ar: "أحتاج بخاخ" },
  { emoji: "⚡", en: "Victory Mode", ar: "وضع الفوز" },
];

export default function ArenaVoiceChat({ lang }: { lang: Lang }) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [messages, setMessages] = useState<ChatMsg[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [micLive, setMicLive] = useState(true);

  const send = () => {
    if (!draft.trim()) return;
    setMessages((m) => [
      ...m,
      { id: Date.now(), name: t("You", "أنت"), level: 48, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), text: draft.trim() },
    ]);
    setDraft("");
  };

  return (
    <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 space-y-3">
      <button
        onClick={() => setMicLive((v) => !v)}
        className={`w-full flex items-center gap-3 rounded-xl p-3 border transition ${
          micLive ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/10 bg-white/[0.02]"
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${micLive ? "bg-cyan-500/20 text-cyan-300" : "bg-white/10 text-white/40"}`}>
          <Mic size={16} />
        </div>
        <div className="text-left flex-1">
          <div className="text-sm font-bold">{t("Spatial Voice Chat", "شات صوتي مكاني")}</div>
          <div className="text-[11px] text-white/50">{micLive ? t("Microphone Live 🎙️", "الميكروفون شغال 🎙️") : t("Muted", "مكتوم")}</div>
        </div>
        {micLive && (
          <div className="flex items-end gap-0.5 h-5">
            {[6, 14, 10].map((h, i) => (
              <span key={i} className="w-1 rounded-full bg-cyan-400 animate-pulse" style={{ height: h }} />
            ))}
          </div>
        )}
      </button>

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <span key={c.en} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/70">
            {c.emoji} {t(c.en, c.ar)}
          </span>
        ))}
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id} className="rounded-xl p-2.5 bg-black/30 border border-white/5">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-cyan-200">{m.name}</span>
              {m.verified && <span className="text-cyan-300">✓</span>}
              <span className="text-fuchsia-300 font-mono text-[10px]">Lvl {m.level}</span>
              <span className="ml-auto text-white/30 text-[10px]">{m.time}</span>
            </div>
            <div className="text-sm text-white/85 mt-0.5">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("Type chat message...", "اكتب رسالة...")}
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
        />
        <button onClick={send} className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 flex items-center justify-center">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
