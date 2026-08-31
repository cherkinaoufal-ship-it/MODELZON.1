import type { Lang } from "@/lib/i18n";
import { useState } from "react";

export interface MatchTheme {
  id: string;
  en: string;
  ar: string;
  briefEn: string;
  briefAr: string;
}

export const THEMES: MatchTheme[] = [
  { id: "tokyo", en: "Cyber Tokyo Techwear Duel", ar: "مبارزة تكوير طوكيو السايبر", briefEn: "Design a futuristic neon jacket with Japanese street graffiti", briefAr: "صمم جاكيت نيون مستقبلي بجرافيتي شوارع ياباني" },
  { id: "desert", en: "Royal Desert Gold Couture", ar: "أزياء الصحراء الملكية الذهبية", briefEn: "Craft a luxurious garment with Arabic gold embroidery & silk weave", briefAr: "صمم قطعة فاخرة بتطريز عربي ذهبي ونسيج حرير" },
  { id: "obsidian", en: "Obsidian Matrix Oversize", ar: "ماتريكس الأوبسيديان الأوفرسايز", briefEn: "Minimalist dark streetwear with high contrast cyber typography", briefAr: "ستريت وير داكن بسيط بخطوط سايبر عالية التباين" },
];

interface Props {
  lang: Lang;
  selected: string;
  onSelect: (theme: MatchTheme) => void;
}

export default function MatchThemeSelector({ lang, selected, onSelect }: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-white/40 font-bold mb-2">
        {t("Select Match Theme Prompt", "اختر موضوع المبارزة")}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {THEMES.map((th) => (
          <button
            key={th.id}
            onClick={() => onSelect(th)}
            className={`text-left rounded-xl p-3 border transition ${
              selected === th.id
                ? "border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_16px_rgba(6,182,212,0.2)]"
                : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
            }`}
          >
            <div className="font-bold text-sm">{t(th.en, th.ar)}</div>
            <div className="text-[11px] text-white/50 mt-1">{t(th.briefEn, th.briefAr)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
