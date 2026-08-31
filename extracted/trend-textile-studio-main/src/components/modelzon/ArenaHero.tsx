import type { Lang } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

interface Props {
  title: string;
  lang: Lang;
  onStart: () => void;
}

export default function ArenaHero({ title, lang, onStart }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  return (
    <div className="rounded-2xl p-5 bg-gradient-to-br from-black/60 to-cyan-950/30 border border-cyan-500/20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,0.4),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(217,70,239,0.4),transparent_50%)]" />
      {/* Badges + topic title removed — the person said this cluttered
          area above the button was confusing, and "3 ضد 3" was inaccurate
          anyway (real battles are 4 free-for-all, not 3v3 teams). The
          topic itself is still shown inside the room once matched. */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        onClick={onStart}
        className="relative mt-4 w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 text-black font-black tracking-wide flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(6,182,212,0.5)]"
      >
        <Zap size={16} fill="currentColor" />
        {t("START DESIGN BATTLE", "ابدأ معركة التصميم")}
        <span>⚡</span>
      </motion.button>
    </div>
  );
}
