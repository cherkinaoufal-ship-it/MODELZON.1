import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pipette } from "lucide-react";

/** hsv -> hex */
function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full || "000000", 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

interface Props {
  color: string;
  onChange: (hex: string) => void;
  ar?: boolean;
  /** compact = smaller square, for the floating toolbar */
  compact?: boolean;
}

/** MODELZON's own neon palette — shown as one-tap swatches above the full
 *  picker, since "colors somewhere in the app" should mostly mean the
 *  app's actual brand colors, not a random rainbow. Full HSV/hex control
 *  below is untouched for anyone who wants an exact custom color. */
const BRAND_SWATCHES = [
  { hex: "#22d3ee", name: "Cyan" },
  { hex: "#d946ef", name: "Magenta" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#0ea5e9", name: "Blue" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#0b0b12", name: "Obsidian" },
  { hex: "#ffffff", name: "White" },
  { hex: "#111827", name: "Slate" },
];

export default function ColorPickerHSV({ color, onChange, ar = true, compact = false }: Props) {
  const t = (en: string, arT: string) => (ar ? arT : en);
  const initial = useMemo(() => hexToHsv(color), [color]);
  const [h, setH] = useState(initial.h);
  const [s, setS] = useState(initial.s);
  const [v, setV] = useState(initial.v);
  const squareRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);

  // keep in sync when the color is changed from the outside (presets, AI)
  useEffect(() => {
    const next = hexToHsv(color);
    if (hsvToHex(h, s, v).toLowerCase() !== color.toLowerCase()) {
      setH(next.h);
      setS(next.s);
      setV(next.v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  const emit = useCallback((hh: number, ss: number, vv: number) => {
    onChange(hsvToHex(hh, ss, vv));
  }, [onChange]);

  const pick = useCallback((clientX: number, clientY: number) => {
    const el = squareRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ns = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const nv = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    setS(ns);
    setV(nv);
    emit(h, ns, nv);
  }, [emit, h]);

  useEffect(() => {
    const move = (e: PointerEvent) => { if (dragRef.current) pick(e.clientX, e.clientY); };
    const up = () => { dragRef.current = false; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [pick]);

  const hex = hsvToHex(h, s, v);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {BRAND_SWATCHES.map((sw) => (
          <button
            key={sw.hex}
            title={sw.name}
            onClick={() => { const nh = hexToHsv(sw.hex); setH(nh.h); setS(nh.s); setV(nh.v); onChange(sw.hex); }}
            className={`w-6 h-6 rounded-full border-2 transition ${hex.toLowerCase() === sw.hex.toLowerCase() ? "border-cyan-300 scale-110 shadow-[0_0_8px_rgba(34,211,238,0.7)]" : "border-white/20"}`}
            style={{ background: sw.hex }}
          />
        ))}
      </div>

      <div
        ref={squareRef}
        onPointerDown={(e) => { dragRef.current = true; pick(e.clientX, e.clientY); }}
        className={`relative w-full rounded-xl overflow-hidden border border-white/15 touch-none cursor-crosshair ${compact ? "h-28" : "h-40"}`}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`,
        }}
      >
        <div
          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_8px_rgba(0,0,0,0.8)] pointer-events-none"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: hex }}
        />
      </div>




      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg border border-white/20 shrink-0" style={{ background: hex }} />
        <div className="flex items-center gap-1 flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5">
          <Pipette size={12} className="text-white/40" />
          <input
            value={hex.toUpperCase()}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (/^#?[0-9a-fA-F]{6}$/.test(val)) {
                const norm = val.startsWith("#") ? val : `#${val}`;
                const nh = hexToHsv(norm);
                setH(nh.h); setS(nh.s); setV(nh.v);
                onChange(norm);
              }
            }}
            className="flex-1 bg-transparent text-[11px] font-mono outline-none text-white/80 min-w-0"
          />
        </div>
      </div>
    </div>
  );
}
