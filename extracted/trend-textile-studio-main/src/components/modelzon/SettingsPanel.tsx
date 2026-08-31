import { Globe, Cpu, Shield, Volume2, Sparkles, Wallet } from "lucide-react";
import { LANGUAGES, type Lang } from "@/lib/i18n";
import { COUNTRIES, type CurrencyCode } from "@/lib/currency";

interface Props {
  lang: Lang;
  setLang: (l: Lang) => void;
  quality: "low" | "medium" | "high";
  setQuality: (q: "low" | "medium" | "high") => void;
  privacy: boolean;
  setPrivacy: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  visualizer: boolean;
  setVisualizer: (v: boolean) => void;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition ${
        value ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 shadow-[0_0_10px_#06b6d4]" : "bg-white/10"
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function SettingsPanel(p: Props) {
  const t = (en: string, ar: string) => (p.lang === "ar" ? ar : en);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80">
          <Globe size={14} /> {t("Language", "اللغة")}
        </div>
        <div className="flex flex-wrap gap-1 bg-white/5 rounded-lg p-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => p.setLang(l.code)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                p.lang === l.code ? "bg-cyan-500/30 text-cyan-200" : "text-white/50 hover:text-white/80"
              }`}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>
      {p.lang !== "en" && p.lang !== "ar" && (
        <p className="text-[10px] text-amber-300/70 -mt-2">
          {t(
            "This language is new — some parts of the app may still show in English until fully translated.",
            "هذي اللغة جديدة — بعض أجزاء التطبيق ممكن تظهر بالإنجليزي لين تكتمل الترجمة.",
          )}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80">
          <Wallet size={14} /> {t("Country & Currency", "الدولة والعملة")}
        </div>
        <select
          value={p.currency}
          onChange={(e) => p.setCurrency(e.target.value as CurrencyCode)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none max-w-[160px]"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {p.lang === "ar" ? c.countryAr : c.country} ({c.code})
            </option>
          ))}
        </select>
      </div>
      <p className="text-[10px] text-white/30 -mt-2">
        {t(
          "Prices are converted to an approximate rate and charged in this currency at checkout.",
          "الأسعار تُحوّل بسعر تقريبي وتُدفع بهذي العملة عند الدفع.",
        )}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80">
          <Cpu size={14} /> {t("Graphics", "الرسومات")}
        </div>
        <select
          value={p.quality}
          onChange={(e) => p.setQuality(e.target.value as any)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80">
          <Shield size={14} /> {t("Privacy", "الخصوصية")}
        </div>
        <Toggle value={p.privacy} onChange={p.setPrivacy} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/80">
          <Sparkles size={14} /> {t("Visualizer", "المؤثرات")}
        </div>
        <Toggle value={p.visualizer} onChange={p.setVisualizer} />
      </div>

      <div>
        <div className="flex items-center gap-2 text-white/80 mb-1">
          <Volume2 size={14} /> {t("Volume", "الصوت")}
          <span className="ml-auto text-xs text-cyan-300 font-mono">{p.volume}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={p.volume}
          onChange={(e) => p.setVolume(Number(e.target.value))}
          className="w-full accent-cyan-400"
        />
      </div>
    </div>
  );
}
