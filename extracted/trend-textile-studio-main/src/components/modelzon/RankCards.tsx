import type { Lang } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Sparkle, Zap, Crown, Flame, Gem, type LucideIcon } from "lucide-react";

/** Real ranks now gate on `level` (server-authoritative, see
 *  progress.functions.ts) instead of the old self-draggable "score" field —
 *  a rank you could set yourself with a slider isn't a rank. Each also
 *  carries a small game-style icon, reused by RankBadge below wherever a
 *  username needs to show rank at a glance (leaderboard, battle rooms,
 *  profile). */
export const RANKS = [
  { id: 1, en: "Beginner", ar: "مبتدئ", threshold: 1, color: "#94a3b8", glow: "rgba(148,163,184,0.5)", icon: Sparkle },
  { id: 2, en: "Advanced", ar: "متطور", threshold: 10, color: "#22d3ee", glow: "rgba(34,211,238,0.6)", icon: Zap },
  { id: 3, en: "Master", ar: "معلم", threshold: 25, color: "#a855f7", glow: "rgba(168,85,247,0.6)", icon: Flame },
  { id: 4, en: "Clothing Legend", ar: "اسطورة الملابس", threshold: 50, color: "#f59e0b", glow: "rgba(245,158,11,0.7)", icon: Crown },
  { id: 5, en: "Garment Sage", ar: "حكيم ملابس", threshold: 80, color: "#ec4899", glow: "rgba(236,72,153,0.8)", icon: Gem },
];

export function rankForLevel(level: number) {
  return [...RANKS].reverse().find((r) => level >= r.threshold) ?? RANKS[0];
}

/** Small game-style rank icon + label, meant to sit right next to a
 *  username anywhere in the app (leaderboard rows, battle room rosters,
 *  profile header, chat). */
export function RankBadge({ level, lang, size = 14 }: { level: number; lang: Lang; size?: number }) {
  const rank = rankForLevel(level);
  const Icon: LucideIcon = rank.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold shrink-0"
      style={{ color: rank.color, borderColor: `${rank.color}55`, background: `${rank.color}15` }}
      title={lang === "ar" ? rank.ar : rank.en}
    >
      <Icon size={size * 0.75} />
      {lang === "ar" ? rank.ar : rank.en}
    </span>
  );
}

interface RankCardsProps {
  level: number;
  missionsCompleted: number;
  lang: Lang;
}

export default function RankCards({ level, missionsCompleted, lang }: RankCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {RANKS.map((r, i) => {
        const unlocked = level >= r.threshold;
        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ scale: 1.04, y: -3 }}
            className="relative rounded-xl p-3 backdrop-blur-md border overflow-hidden"
            style={{
              background: unlocked
                ? `linear-gradient(135deg, ${r.color}22, transparent)`
                : "rgba(255,255,255,0.03)",
              borderColor: unlocked ? r.color : "rgba(255,255,255,0.08)",
              boxShadow: unlocked ? `0 0 20px ${r.glow}` : "none",
            }}
          >
            <div className="flex items-center gap-1.5">
              <r.icon size={13} style={{ color: r.color }} />
              <div className="text-[10px] uppercase tracking-widest text-white/50">
                Rank {r.id}
              </div>
            </div>
            <div className="font-bold text-white mt-1 text-sm">
              {lang === "ar" ? r.ar : r.en}
            </div>
            <div className="text-[11px] mt-1" style={{ color: r.color }}>
              LVL ≥ {r.threshold}
            </div>
            <div className="mt-2 text-[10px] text-white/60">
              Missions: {unlocked ? missionsCompleted : 0}
            </div>
            {!unlocked && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white/40 text-xs">
                🔒
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
