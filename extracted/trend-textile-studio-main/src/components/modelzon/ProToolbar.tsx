import type { Lang } from "@/lib/i18n";
import { useRef, useState } from "react";
import {
  Brush, Eraser, Droplet, Type as TypeIcon, Waves, Blend,
  Undo2, FlipHorizontal2, Snowflake, Sun, ChevronDown,
} from "lucide-react";
import ColorPickerHSV from "@/components/modelzon/ColorPickerHSV";
import BrushPreview from "@/components/modelzon/BrushPreview";

import {
  BRUSH_GROUPS, LINE_STYLES, FONTS,
  type BrushSettings, type ToolId,
} from "@/lib/paint-engine";

interface Props {
  brush: BrushSettings;
  setBrush: (patch: Partial<BrushSettings>) => void;
  palette: string[];
  frozen: boolean;
  setFrozen: (v: boolean) => void;
  /** Quick stroke-undo stays one tap away while painting. Upload & clear
   *  moved to the dedicated Print tab (§8). */
  onUndo: () => void;
  lang: Lang;
}

// NOTE: the old "Move" (mouse-pointer) tool is gone by request — navigation
// vs painting is now decided by context instead of a tool button: painting is
// active only while the Paint panel is open; everywhere else dragging on the
// garment rotates/orbits it. Artwork placement itself is direct manipulation
// on the 2D mockup board (see MockupBoard2D).
const TOOLS: { id: ToolId; icon: any; en: string; ar: string }[] = [
  { id: "draw", icon: Brush, en: "Draw", ar: "رسم" },
  { id: "eraser", icon: Eraser, en: "Eraser", ar: "ممحاة" },
  { id: "bucket", icon: Droplet, en: "ColorDrop", ar: "قطرة لون" },
  { id: "gradient", icon: Blend, en: "Gradient", ar: "تدرّج" },
  { id: "text", icon: TypeIcon, en: "Text", ar: "كتابة" },
  { id: "smudge", icon: Waves, en: "Smudge", ar: "تنعيم" },
];

export default function ProToolbar({
  brush, setBrush, palette, frozen, setFrozen, onUndo, lang,
}: Props) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [openGroup, setOpenGroup] = useState<string>("core");

  const activeBrushLabel = (() => {
    for (const g of BRUSH_GROUPS) {
      const b = g.brushes.find((x) => x.id === brush.brush);
      if (b) return t(b.en, b.ar);
    }
    return brush.brush;
  })();

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
      {/* Tools */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-white/50">{t("Tools", "الأدوات")}</span>
          <button
            onClick={onUndo}
            title={t("Undo stroke", "تراجع عن ضربة")}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-white/5 border border-white/10 text-white/60 hover:border-cyan-400/40 transition"
          >
            <Undo2 size={12} /> {t("Undo", "تراجع")}
          </button>
          <button
            onClick={() => setFrozen(!frozen)}
            className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border transition ${
              frozen ? "bg-cyan-500/25 border-cyan-400 text-cyan-100" : "bg-white/5 border-white/10 text-white/60"
            }`}
          >
            {frozen ? <Snowflake size={12} /> : <Sun size={12} />}
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {TOOLS.map((tool, i) => {
            const Icon = tool.icon;
            const active = brush.tool === tool.id;
            const grad = [
              "from-fuchsia-400 to-purple-500",
              "from-rose-400 to-red-500",
              "from-amber-400 to-orange-500",
              "from-emerald-400 to-teal-500",
              "from-indigo-400 to-blue-500",
              "from-lime-400 to-green-500",
            ][i % 6]!;
            return (
              <button
                key={tool.id}
                onClick={() => setBrush({ tool: tool.id })}
                className={`py-2 rounded-xl border text-[9px] font-bold flex flex-col items-center gap-1 transition ${
                  active
                    ? "border-white/40 bg-white/[0.08] shadow-[0_0_14px_rgba(255,255,255,0.15)] text-white"
                    : "bg-black/40 border-white/10 text-white/60 hover:border-white/25"
                }`}
              >
                <span className={`grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br ${grad} ${active ? "" : "opacity-60"} text-black/80`}>
                  <Icon size={15} />
                </span>
                <span className="leading-none">{t(tool.en, tool.ar)}</span>
              </button>
            );
          })}
        </div>
      </div>


      {/* Brush library */}
      <div className="p-3 border-b border-white/10 space-y-2 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(120%_100%_at_100%_100%,rgba(217,70,239,0.14),transparent_55%)]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-white/50">{t("Brush", "الفرشاة")}</span>
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-cyan-400/25 to-fuchsia-400/25 border border-white/15 text-cyan-100">
            {activeBrushLabel}
          </span>
        </div>
        {BRUSH_GROUPS.map((g, gi) => {
          const open = openGroup === g.id;
          const accents = [
            { chip: "from-cyan-400 to-sky-500", ring: "border-cyan-400", glow: "shadow-[0_0_14px_rgba(34,211,238,0.45)]", tint: "bg-cyan-400/20 text-cyan-100" },
            { chip: "from-fuchsia-400 to-purple-500", ring: "border-fuchsia-400", glow: "shadow-[0_0_14px_rgba(217,70,239,0.45)]", tint: "bg-fuchsia-400/20 text-fuchsia-100" },
            { chip: "from-amber-400 to-orange-500", ring: "border-amber-400", glow: "shadow-[0_0_14px_rgba(245,158,11,0.45)]", tint: "bg-amber-400/20 text-amber-100" },
          ][gi % 3]!;
          return (
            <div key={g.id} className="rounded-2xl border border-white/12 bg-black/40 overflow-hidden backdrop-blur-sm">
              <button
                onClick={() => setOpenGroup(open ? "" : g.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-black text-white/85"
              >
                <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${accents.chip} ${accents.glow}`} />
                {t(g.en, g.ar)}
                <span className="text-[9px] font-bold text-white/35">{g.brushes.length}</span>
                <ChevronDown size={13} className={`ml-auto transition ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 pt-0">
                  {g.brushes.map((b) => {
                    const active = brush.brush === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setBrush({ brush: b.id, tool: "draw" })}
                        className={`group relative rounded-xl border p-2 flex flex-col items-center gap-1.5 transition ${
                          active
                            ? `${accents.ring} ${accents.glow} bg-white/[0.08]`
                            : "border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent hover:border-white/30"
                        }`}
                      >
                        <span className={`w-full rounded-lg px-1 py-1 ${active ? accents.tint : "bg-black/50 text-white/70"}`}>
                          <BrushPreview id={b.id} />
                        </span>
                        <span className={`text-[10px] font-bold leading-tight text-center ${active ? "text-white" : "text-white/65"}`}>
                          {t(b.en, b.ar)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>


      {/* Line style + symmetry */}
      <div className="p-3 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">{t("Line style", "شكل الخط")}</div>
        <div className="flex flex-wrap gap-1.5">
          {LINE_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setBrush({ lineStyle: s.id })}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
                brush.lineStyle === s.id
                  ? "bg-cyan-500/25 border-cyan-400 text-cyan-100"
                  : "bg-black/40 border-white/10 text-white/60"
              }`}
            >
              {t(s.en, s.ar)}
            </button>
          ))}
          <button
            onClick={() => setBrush({ symmetry: !brush.symmetry })}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${
              brush.symmetry
                ? "bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100"
                : "bg-black/40 border-white/10 text-white/60"
            }`}
          >
            <FlipHorizontal2 size={12} /> {t("Symmetry", "تماثل")}
          </button>
        </div>
      </div>

      {/* Sliders */}
      <div className="p-3 border-b border-white/10 grid sm:grid-cols-3 gap-3">
        {[
          { label: t("Size", "الحجم"), value: brush.size, min: 2, max: 90, step: 1, key: "size" as const, display: `${brush.size}px` },
          { label: t("Opacity", "الشفافية"), value: brush.opacity, min: 0.05, max: 1, step: 0.05, key: "opacity" as const, display: `${Math.round(brush.opacity * 100)}%` },
          { label: t("Spacing", "التباعد"), value: brush.spacing, min: 0.05, max: 1, step: 0.05, key: "spacing" as const, display: `${Math.round(brush.spacing * 100)}%` },
        ].map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
              <span className="uppercase tracking-widest">{s.label}</span>
              <span className="font-mono text-cyan-200">{s.display}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.value}
              onChange={(e) => setBrush({ [s.key]: Number(e.target.value) } as Partial<BrushSettings>)}
              className="w-full accent-cyan-400"
            />
          </div>
        ))}
      </div>

      {/* Smudge controls (§6) — the reservoir smudge has its own strength
          (how much pigment the sponge picks up & deposits) and size. */}
      {brush.tool === "smudge" && (
        <div className="p-3 border-b border-white/10 grid sm:grid-cols-2 gap-3 bg-fuchsia-500/[0.05]">
          {[
            { label: t("Smudge strength", "قوة التنعيم"), value: brush.smudgeStrength, min: 0.05, max: 1, step: 0.05, key: "smudgeStrength" as const, display: `${Math.round(brush.smudgeStrength * 100)}%` },
            { label: t("Smudge size", "حجم التنعيم"), value: brush.smudgeSize, min: 10, max: 120, step: 1, key: "smudgeSize" as const, display: `${brush.smudgeSize}px` },
          ].map((sl) => (
            <div key={sl.key}>
              <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
                <span className="uppercase tracking-widest">{sl.label}</span>
                <span className="font-mono text-fuchsia-200">{sl.display}</span>
              </div>
              <input
                type="range"
                min={sl.min} max={sl.max} step={sl.step} value={sl.value}
                onChange={(e) => setBrush({ [sl.key]: Number(e.target.value) } as Partial<BrushSettings>)}
                className="w-full accent-fuchsia-400"
              />
            </div>
          ))}
        </div>
      )}

      {/* Typography */}
      {brush.tool === "text" && (
        <div className="p-3 border-b border-white/10 flex flex-col sm:flex-row gap-2">
          <input
            value={brush.text}
            onChange={(e) => setBrush({ text: e.target.value })}
            placeholder={t("Your text", "نصك")}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
          />
          <select
            value={brush.font}
            onChange={(e) => setBrush({ font: e.target.value })}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none"
          >
            {FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
            ))}
          </select>
        </div>
      )}

      {/* Color */}
      <div className="p-3 border-b border-white/10 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-white/50">{t("Paint color", "لون الطلاء")}</div>
        <ColorPickerHSV color={brush.color} onChange={(hex) => setBrush({ color: hex })} ar={lang === "ar"} compact />
        <div className="flex flex-wrap gap-1.5">
          {palette.map((c) => (
            <button
              key={c}
              onClick={() => setBrush({ color: c })}
              className={`w-6 h-6 rounded-md border-2 ${brush.color.toLowerCase() === c.toLowerCase() ? "border-white" : "border-white/20"}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
