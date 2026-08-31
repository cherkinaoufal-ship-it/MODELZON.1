import type { Lang } from "@/lib/i18n";
import { Users, Palette } from "lucide-react";
import { RankBadge } from "./RankCards";
import type { OnlinePlayer } from "@/lib/presence";

interface Props {
  lang: Lang;
  online: OnlinePlayer[];
  myUserId?: string;
  onOpenStudio?: () => void;
}

const COLORS = ["#22d3ee", "#f472b6", "#a855f7", "#f59e0b", "#34d399"];

export default function CompetitorsRoom({ lang, online, myUserId, onOpenStudio }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const sorted = [...online].sort((a, b) => (a.userId === myUserId ? -1 : b.userId === myUserId ? 1 : 0));

  return (
    <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 text-white/90 font-bold">
          <Users size={16} className="text-cyan-300" />
          {t("Room Competitors", "متسابقو الغرفة")} ({online.length})
        </div>
        <div className="text-[11px] text-emerald-300 text-right leading-tight">
          {t("Live —", "مباشر —")}<br />{t("real players online now", "لاعبون حقيقيون متصلون الحين")}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-white/40 text-center py-6">
          {t("No one else is here yet — you're the first!", "ما فيه أحد الحين — أنت أول واحد!")}
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((c, i) => {
            const you = c.userId === myUserId;
            return (
              <div
                key={c.userId}
                className={`rounded-xl p-3 flex items-center gap-3 border ${
                  you ? "border-cyan-400/60 bg-cyan-500/5 shadow-[0_0_20px_rgba(6,182,212,0.2)]" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-black shrink-0"
                  style={{ background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, #000)` }}
                >
                  {c.username[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate flex items-center gap-1.5">
                    {c.username} {you && <span className="text-cyan-300 text-[10px]">({t("YOU", "أنت")})</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <RankBadge level={c.level} lang={lang} size={11} />
                  </div>
                </div>
                <div className="text-[10px] px-2 py-1 rounded-lg border border-cyan-400/40 text-cyan-200 font-bold whitespace-nowrap">
                  {c.status}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={onOpenStudio}
        className="mt-3 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5"
      >
        <Palette size={12} /> {t("Open Studio", "افتح الاستوديو")} 🎨
      </button>
    </div>
  );
}
