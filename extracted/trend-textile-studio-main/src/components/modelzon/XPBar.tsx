import { motion, AnimatePresence } from "framer-motion";

interface XPBarProps {
  level: number;
  xp: number;
  xpToNext: number;
  popups: { id: number; text: string }[];
}

export default function XPBar({ level, xp, xpToNext, popups }: XPBarProps) {
  const pct = Math.min(100, (xp / xpToNext) * 100);
  const verified = level >= 50;

  return (
    <div className="relative">
      <div className="flex items-center gap-3 mb-2">
        <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center font-bold text-black shadow-[0_0_20px_rgba(6,182,212,0.6)]">
          {level}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">Designer</span>
          {verified && (
            <span
              className="w-5 h-5 rounded-full bg-cyan-400 text-black text-xs flex items-center justify-center font-bold shadow-[0_0_12px_#06b6d4]"
              title="Verified"
            >
              ✓
            </span>
          )}
        </div>
        <span className="ml-auto text-xs text-cyan-300 font-mono">
          {xp} / {xpToNext} XP
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-white/5 overflow-hidden border border-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #06b6d4, #a855f7, #d946ef)",
            boxShadow: "0 0 15px rgba(6,182,212,0.8), inset 0 0 8px rgba(255,255,255,0.4)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.15)_50%,transparent_100%)] animate-pulse" />
      </div>
      <AnimatePresence>
        {popups.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 0, scale: 0.8 }}
            animate={{ opacity: 1, y: -40, scale: 1.1 }}
            exit={{ opacity: 0, y: -70 }}
            transition={{ duration: 1.2 }}
            className="absolute right-2 -top-2 text-cyan-300 font-bold text-sm pointer-events-none"
            style={{ textShadow: "0 0 10px #06b6d4" }}
          >
            {p.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
