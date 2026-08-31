import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import EqualizerStrip from "./EqualizerStrip";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: number;
  user: string;
  color: string;
  self: boolean;
  text: string;
  avatar: string;
}

const seedMsgs: Message[] = [
  { id: 1, user: "NovaSkye", color: "#f472b6", self: false, text: "Ready to battle! 🔥", avatar: "N" },
  { id: 2, user: "You", color: "#22d3ee", self: true, text: "Bring it on 😎", avatar: "Y" },
  { id: 3, user: "ZeroFade", color: "#a855f7", self: false, text: "Love that hoodie palette", avatar: "Z" },
];

export default function ChatPanel() {
  const [msgs, setMsgs] = useState<Message[]>(seedMsgs);
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [
      ...m,
      { id: Date.now(), user: "You", color: "#22d3ee", self: true, text: input, avatar: "Y" },
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Voice bar */}
      <div className="flex items-center gap-3 p-3 border-b border-white/10 bg-white/[0.02]">
        <motion.div
          animate={!muted ? { boxShadow: ["0 0 0 0 #06b6d4", "0 0 0 12px transparent"] } : {}}
          transition={{ repeat: Infinity, duration: 1.4 }}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-black font-bold"
        >
          Y
        </motion.div>
        <div className="flex-1">
          <div className="text-xs text-white/60">Live voice</div>
          <EqualizerStrip active={!muted} />
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          className={`p-2 rounded-lg transition ${muted ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-300"}`}
        >
          {muted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {msgs.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex gap-2 ${m.self ? "flex-row-reverse" : ""}`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                style={{ background: m.color }}
              >
                {m.avatar}
              </div>
              <div
                className="max-w-[75%] rounded-2xl px-3 py-2 backdrop-blur-md border text-sm"
                style={{
                  background: m.self ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.05)",
                  borderColor: m.self ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.1)",
                  color: "white",
                }}
              >
                <div className="text-[10px] mb-0.5" style={{ color: m.color }}>{m.user}</div>
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message the arena…"
          className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 border border-white/10 focus:border-cyan-400/50 outline-none"
        />
        <button
          onClick={send}
          className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
