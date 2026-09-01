import { useRef, useState, useEffect } from "react";
import { Move, RotateCw, Maximize2, Trash2, RefreshCcw, Crosshair, Expand } from "lucide-react";

export interface DecalTransform {
  x: number;      // -0.5 .. 0.5  (horizontal offset on garment canvas)
  y: number;      // -0.5 .. 0.5
  scale: number;  // 0.2 .. 3
  rotation: number; // degrees
  /** Simple 2-axis skew (shear), each roughly -0.6..0.6. This is the
   *  "start with skew before full 4-point warp" version recommended when
   *  this feature was scoped — a true independent-corner warp needs the
   *  decal image sliced into a small mesh grid and redrawn quad-by-quad,
   *  which is a much bigger, riskier change to the shared paint canvas
   *  pipeline. Skew covers the common "make it look like it's wrapping
   *  around a sleeve/fold" use case with a single predictable transform. */
  skewX?: number;
  skewY?: number;
}

export const DEFAULT_DECAL_TRANSFORM: DecalTransform = { x: 0, y: 0, scale: 1, rotation: 0, skewX: 0, skewY: 0 };

interface Props {
  imageUrl: string;
  transform: DecalTransform;
  setTransform: (t: DecalTransform) => void;
  onRemove: () => void;
  ar?: boolean;
}

export default function DecalControls({ imageUrl, transform, setTransform, onRemove, ar = true }: Props) {
  const padRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  /** Full direct manipulation, not just the position drag pad: dragging
   *  the corner handle scales, dragging the top handle rotates — both
   *  computed live against the sticker's own center, same interaction
   *  pattern as Instagram/Canva sticker editors. */
  const [resizing, setResizing] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [warping, setWarping] = useState(false);
  const warpStartRef = useRef<{ x: number; y: number; skewX: number; skewY: number } | null>(null);
  const t = (en: string, arT: string) => (ar ? arT : en);

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  const moveFromEvent = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = clamp((clientX - r.left) / r.width - 0.5, -0.5, 0.5);
    const ny = clamp((clientY - r.top) / r.height - 0.5, -0.5, 0.5);
    setTransform({ ...transform, x: nx, y: ny });
  };

  const centerPx = () => {
    const el = padRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { cx: r.left + (transform.x + 0.5) * r.width, cy: r.top + (transform.y + 0.5) * r.height };
  };

  const resizeFromEvent = (clientX: number, clientY: number) => {
    const c = centerPx();
    if (!c) return;
    const dist = Math.hypot(clientX - c.cx, clientY - c.cy);
    // 28px ≈ half the handle's base 56px box at scale=1 — matches the
    // preview box sizing below, so dragging the corner "feels" 1:1.
    const scale = clamp(dist / 28, 0.2, 3);
    setTransform({ ...transform, scale });
  };

  const rotateFromEvent = (clientX: number, clientY: number) => {
    const c = centerPx();
    if (!c) return;
    const angle = (Math.atan2(clientX - c.cx, -(clientY - c.cy)) * 180) / Math.PI;
    setTransform({ ...transform, rotation: Math.round(angle) });
  };

  /** Simplified 2-axis skew — drag horizontally to shear left/right, drag
   *  vertically to shear top/bottom, relative to where the drag started
   *  (not the sticker center) so it feels like "pulling" a corner rather
   *  than snapping. This is the scoped-down version of a full 4-point
   *  perspective warp — see the DecalTransform.skewX/skewY comment. */
  const warpFromEvent = (clientX: number, clientY: number) => {
    const start = warpStartRef.current;
    if (!start) return;
    const dx = (clientX - start.x) / 120; // 120px drag ≈ full -1..1 range
    const dy = (clientY - start.y) / 120;
    setTransform({
      ...transform,
      skewX: clamp(start.skewX + dx, -0.7, 0.7),
      skewY: clamp(start.skewY - dy, -0.7, 0.7),
    });
  };

  useEffect(() => {
    if (!dragging && !resizing && !rotating && !warping) return;
    const move = (e: PointerEvent) => {
      if (dragging) moveFromEvent(e.clientX, e.clientY);
      else if (resizing) resizeFromEvent(e.clientX, e.clientY);
      else if (rotating) rotateFromEvent(e.clientX, e.clientY);
      else if (warping) warpFromEvent(e.clientX, e.clientY);
    };
    const up = () => { setDragging(false); setResizing(false); setRotating(false); setWarping(false); warpStartRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  const handleLeft = `${(transform.x + 0.5) * 100}%`;
  const handleTop = `${(transform.y + 0.5) * 100}%`;

  const nudge = (dx: number, dy: number) =>
    setTransform({ ...transform, x: clamp(transform.x + dx, -0.5, 0.5), y: clamp(transform.y + dy, -0.5, 0.5) });

  return (
    <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-3">
      <div className="flex items-center gap-2">
        <Move size={12} className="text-cyan-300" />
        <span className="text-[10px] uppercase tracking-widest text-white/50">
          {t("Artwork placement", "تحكم مكان الصورة")}
        </span>
        <button
          onClick={() => setTransform(DEFAULT_DECAL_TRANSFORM)}
          className="ml-auto p-1.5 rounded-lg text-white/60 hover:text-cyan-300 hover:bg-white/5"
          title={t("Reset", "إعادة ضبط")}
        >
          <RefreshCcw size={13} />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-white/60 hover:text-red-300 hover:bg-red-500/10"
          title={t("Remove", "حذف الصورة")}
        >
          <Trash2 size={13} />
        </button>
      </div>

  {/* Which side (front/back) this panel edits is decided by the caller —
          index.tsx mounts one DecalControls for the front artwork slot and
          a separate one for the back artwork slot, each bound to its own
          independent transform, so no in-panel toggle is needed here. */}

      {/* Drag pad with a clear handle */}
      <div
        ref={padRef}
        onPointerDown={(e) => { setDragging(true); moveFromEvent(e.clientX, e.clientY); }}
        className="relative h-40 rounded-xl border border-white/10 bg-black/50 overflow-hidden touch-none cursor-crosshair"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />

        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: handleLeft, top: handleTop }}
        >
          <div
            onPointerDown={(e) => { e.stopPropagation(); setDragging(true); }}
            className="rounded-lg border-2 border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.6)] overflow-hidden bg-black/60 cursor-move"
            style={{
              width: 56 * transform.scale,
              height: 56 * transform.scale,
              transform: `rotate(${transform.rotation}deg) matrix(1, ${transform.skewY ?? 0}, ${transform.skewX ?? 0}, 1, 0, 0)`,
            }}
          >
            <img src={imageUrl} alt="" className="w-full h-full object-contain pointer-events-none" />
          </div>

          {/* Rotate handle — drag around the sticker to spin it */}
          <div
            onPointerDown={(e) => { e.stopPropagation(); setRotating(true); }}
            title={t("Drag to rotate", "اسحب للتدوير")}
            className="absolute left-1/2 -top-7 -translate-x-1/2 w-4 h-4 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.9)] cursor-grab active:cursor-grabbing flex items-center justify-center"
          >
            <RotateCw size={9} className="text-black" />
          </div>
          <div className="absolute left-1/2 -top-3.5 -translate-x-1/2 w-px h-3.5 bg-fuchsia-400/60" />

          {/* Resize handle — drag away from center to scale up/down */}
          <div
            onPointerDown={(e) => { e.stopPropagation(); setResizing(true); }}
            title={t("Drag to resize", "اسحب للتحجيم")}
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)] cursor-nwse-resize flex items-center justify-center"
          >
            <Expand size={9} className="text-black" />
          </div>

          {/* Warp handle — drag to shear/skew, e.g. to fake the artwork
              wrapping around a sleeve or fold. Simplified 2-axis version,
              see the DecalTransform.skewX/skewY comment for why. */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              warpStartRef.current = { x: e.clientX, y: e.clientY, skewX: transform.skewX ?? 0, skewY: transform.skewY ?? 0 };
              setWarping(true);
            }}
            title={t("Drag to warp/skew", "اسحب لتشويه الشكل")}
            className="absolute -bottom-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] cursor-move flex items-center justify-center"
          >
            <Move size={9} className="text-black" />
          </div>
        </div>

        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[9px] font-mono text-white/40">
          <Crosshair size={9} /> {t("drag · corner resizes · top rotates · amber corner warps", "اسحب · الزاوية تحجّم · الأعلى يدوّر · الزاوية الكهرمانية تشوّه")}
        </div>
      </div>

      {/* Precise controls */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { l: "◀", a: () => nudge(-0.01, 0) },
          { l: "▲", a: () => nudge(0, -0.01) },
          { l: "▶", a: () => nudge(0.01, 0) },
          { l: "↺", a: () => setTransform({ ...transform, rotation: transform.rotation - 5 }) },
          { l: "▼", a: () => nudge(0, 0.01) },
          { l: "↻", a: () => setTransform({ ...transform, rotation: transform.rotation + 5 }) },
        ].map((b, i) => (
          <button
            key={i}
            onClick={b.a}
            className="py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            {b.l}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Maximize2 size={12} className="text-white/50" />
          <input
            type="range" min={20} max={300} value={Math.round(transform.scale * 100)}
            onChange={(e) => setTransform({ ...transform, scale: Number(e.target.value) / 100 })}
            className="flex-1 accent-cyan-400"
          />
          <span className="text-[10px] font-mono text-cyan-300 w-10 text-right">{Math.round(transform.scale * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <RotateCw size={12} className="text-white/50" />
          <input
            type="range" min={-180} max={180} value={Math.round(transform.rotation)}
            onChange={(e) => setTransform({ ...transform, rotation: Number(e.target.value) })}
            className="flex-1 accent-fuchsia-400"
          />
          <span className="text-[10px] font-mono text-fuchsia-300 w-10 text-right">{Math.round(transform.rotation)}°</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-white/40">
          <div className="px-2 py-1 rounded-lg bg-black/40 border border-white/10">X {transform.x.toFixed(2)}</div>
          <div className="px-2 py-1 rounded-lg bg-black/40 border border-white/10">Y {transform.y.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
