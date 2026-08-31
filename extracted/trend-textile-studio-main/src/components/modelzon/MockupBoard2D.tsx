import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Expand, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { DEFAULT_DECAL_TRANSFORM, type DecalTransform } from "./DecalControls";

/**
 * Interactive 2D mockup board — the four mockup squares (front / back /
 * left sleeve / right sleeve) are now real, smooth, direct-manipulation
 * controls: artwork placed on a panel can be DRAGGED, RESIZED and ROTATED
 * right on the mockup itself (Canva / IG-sticker style), instead of the
 * old separate drag-pad.
 *
 * Front & back slots are the SAME decal slots the 3D garment reads (see
 * compose() in Studio3D.tsx), so anything added or moved here updates the
 * 3D mockup automatically and live. The two sleeve panels are layout-only
 * for now (the catalog .glb models carry their own UVs, so there is no
 * reliable sleeve print area on the 3D mesh) — they are marked "2D".
 */

export type MockupSide = "front" | "back" | "sleeveL" | "sleeveR";

export interface MockupSlot {
  url: string | null;
  transform: DecalTransform;
}

interface Props {
  garment: string;
  color: string;
  ar: boolean;
  side: MockupSide;
  onSide: (s: MockupSide) => void;
  slots: Record<MockupSide, MockupSlot>;
  onTransform: (s: MockupSide, t: DecalTransform) => void;
  onRemove: (s: MockupSide) => void;
  /** Uploads an image onto the ACTIVE mockup panel. */
  onUpload: (dataUrl: string) => void;
  /** Opens the purple garment-parts picker sheet. */
  onOpenParts: () => void;
}

/* ---------- small color helpers for the fabric gradient ---------- */
function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full || "888888", 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/* ---------- flat-sketch silhouettes per garment + view ---------- */
function PanelArt({ garment, color, view, uid }: { garment: string; color: string; view: "front" | "back" | "sleeve"; uid: string }) {
  const light = shade(color, 0.22);
  const dark = shade(color, -0.3);
  const stroke = "rgba(255,255,255,0.45)";
  const dash = 'fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="1.6" stroke-dasharray="5 4"';
  const grad = (
    <defs>
      <linearGradient id={`fab-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={light} />
        <stop offset="45%" stopColor={color} />
        <stop offset="100%" stopColor={dark} />
      </linearGradient>
      <radialGradient id={`glo-${uid}`} cx="0.5" cy="0.32" r="0.75">
        <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
      </radialGradient>
    </defs>
  );
  const fill = `url(#fab-${uid})`;
  const isCap = garment === "cap";
  const isBottom = garment === "pants" || garment === "shorts" || garment === "skirt";
  const longSleeve = garment === "hoodie" || garment === "sweater";

  /* ---- sleeve / leg / side panels ---- */
  if (view === "sleeve") {
    if (isCap) {
      return (
        <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
          {grad}
          <path d="M150 196 C86 196 42 158 42 104 C42 62 78 34 122 34 C166 34 176 74 170 112 L182 196 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M56 96 C92 76 132 76 162 96" {...{ stroke: "rgba(0,0,0,0.28)", "stroke-width": "1.6", "stroke-dasharray": "5 4", fill: "none" }} />
          <ellipse cx="150" cy="196" rx="34" ry="10" fill={fill} stroke={stroke} strokeWidth="2.5" />
        </svg>
      );
    }
    if (isBottom) {
      const len = garment === "shorts" ? 150 : 226;
      return (
        <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
          {grad}
          <path d={`M58 26 h84 l10 ${len - 56} q0 12 -12 12 h-80 q-12 0 -12 -12 Z`} fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          <path d={`M100 26 V${len}`} stroke="rgba(0,0,0,0.22)" strokeWidth="1.6" strokeDasharray="5 4" fill="none" />
          <rect x="56" y="18" width="88" height="14" rx="5" fill={fill} stroke={stroke} strokeWidth="2.5" />
        </svg>
      );
    }
    // sleeve: shoulder at top, cuff at bottom (long for hoodie/sweater, short for tee)
    const cuffY = longSleeve ? 208 : 148;
    return (
      <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
        {grad}
        <path d={`M64 26 C44 34 34 44 30 60 L44 ${cuffY - 18} q2 10 12 12 l88 0 q10 -2 12 -12 L170 60 C166 44 156 34 136 26 C124 40 76 40 64 26 Z`}
          fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="42" y={cuffY - 16} width="116" height="20" rx="8" fill={fill} stroke={stroke} strokeWidth="2.5" />
        {longSleeve && <path d="M100 44 V190" stroke="rgba(0,0,0,0.2)" strokeWidth="1.6" strokeDasharray="5 4" fill="none" />}
      </svg>
    );
  }

  /* ---- cap front/back ---- */
  if (isCap) {
    return (
      <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
        {grad}
        {view === "front" ? (
          <>
            <path d="M100 40 C148 40 172 76 172 118 L172 138 C148 148 52 148 28 138 L28 118 C28 76 52 40 100 40 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M100 40 V138" stroke="rgba(0,0,0,0.25)" strokeWidth="1.6" strokeDasharray="5 4" fill="none" />
            <path d="M28 118 Q100 100 172 118" stroke="rgba(0,0,0,0.25)" strokeWidth="1.6" strokeDasharray="5 4" fill="none" />
            <path d="M30 138 C58 156 142 156 170 138 C168 128 148 122 100 122 C52 122 32 128 30 138 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path d="M100 42 C150 42 174 78 174 120 L174 136 C150 148 50 148 26 136 L26 120 C26 78 50 42 100 42 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="76" y="136" width="48" height="12" rx="4" fill={fill} stroke={stroke} strokeWidth="2.5" />
            <path d="M84 140 l8 8 M100 140 l8 8 M92 148 l8 8" stroke={stroke} strokeWidth="2" />
          </>
        )}
      </svg>
    );
  }

  /* ---- bottoms front/back ---- */
  if (isBottom) {
    if (garment === "skirt") {
      return (
        <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
          {grad}
          <path d="M58 30 h84 l26 168 q-72 14 -136 0 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="56" y="22" width="88" height="16" rx="6" fill={fill} stroke={stroke} strokeWidth="2.5" />
          {view === "front" ? (
            <>
              <path d="M74 48 L66 196 M100 46 V198 M126 48 L134 196" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" fill="none" />
            </>
          ) : (
            <path d="M100 46 V196" stroke="rgba(0,0,0,0.22)" strokeWidth="1.6" strokeDasharray="5 4" fill="none" />
          )}
          <path d="M58 30 h84" stroke="rgba(0,0,0,0.25)" strokeWidth="1.6" strokeDasharray="5 4" />
        </svg>
      );
    }
    const len = garment === "shorts" ? 128 : 214;
    return (
      <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
        {grad}
        <rect x="50" y="24" width="100" height="18" rx="7" fill={fill} stroke={stroke} strokeWidth="2.5" />
        <path d={`M52 42 h96 l6 ${len} h-44 l-10 ${garment === "shorts" ? 26 : 44} h-14 L80 ${len} h-44 Z`} fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M100 42 V164" stroke="rgba(0,0,0,0.22)" strokeWidth="1.6" strokeDasharray="5 4" fill="none" />
        {view === "back" && <circle cx="100" cy="54" r="5" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />}
      </svg>
    );
  }

  /* ---- tops (tee / hoodie / sweater) front/back ---- */
  const sleeve = longSleeve
    ? { l: "M56 54 L12 92 L16 186 L46 180 L52 96 Z", r: "M144 54 L188 92 L184 186 L154 180 L148 96 Z" }
    : { l: "M56 54 L14 92 L20 134 L48 141 L52 96 Z", r: "M144 54 L186 92 L180 134 L152 141 L148 96 Z" };
  return (
    <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
      {grad}
      <path d={sleeve.l} fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" opacity="0.92" />
      <path d={sleeve.r} fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" opacity="0.92" />
      <path d="M56 54 C74 42 82 38 100 38 C118 38 126 42 144 54 L150 214 C126 224 74 224 50 214 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M56 54 C74 42 82 38 100 38 C118 38 126 42 144 54 L141 70 C120 60 80 60 59 70 Z" fill="rgba(0,0,0,0.14)" />
      {garment === "hoodie" ? (
        <path d="M74 46 C82 12 118 12 126 46 C116 58 84 58 74 46 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      ) : (
        <path d="M80 40 C88 54 112 54 120 40" fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      )}
      {view === "back"
        ? <path d="M62 66 C80 74 120 74 138 66" {...{ stroke: "rgba(0,0,0,0.3)", "stroke-width": "1.6", "stroke-dasharray": "5 4", fill: "none" }} />
        : <path d="M100 52 V96" {...{ stroke: "rgba(0,0,0,0.25)", "stroke-width": "1.6", "stroke-dasharray": "5 4", fill: "none" }} />}
      <path d="M50 206 C74 216 126 216 150 206" {...{ stroke: "rgba(0,0,0,0.25)", "stroke-width": "1.6", "stroke-dasharray": "5 4", fill: "none" }} />
      <path d="M50 54 C74 68 126 68 150 54 L150 214 C126 224 74 224 50 214 Z" fill={`url(#glo-${uid})`} />
    </svg>
  );
}

/* ---------- one interactive mockup panel ---------- */
type DragMode = "move" | "resize" | "rotate";
interface DragState {
  mode: DragMode;
  startT: DecalTransform;
  cx: number; cy: number;
  startDist: number; startAngle: number;
}

function MockupPanel({
  sideKey, label, badge, garment, color, view, active, ar,
  slot, onSide, onTransform, onRemove,
}: {
  sideKey: MockupSide;
  label: string;
  badge?: string;
  garment: string; color: string;
  view: "front" | "back" | "sleeve";
  active: boolean;
  ar: boolean;
  slot: MockupSlot;
  onSide: (s: MockupSide) => void;
  onTransform: (s: MockupSide, t: DecalTransform) => void;
  onRemove: (s: MockupSide) => void;
}) {
  const t = (en: string, arT: string) => (ar ? arT : en);
  const panelRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const panelCenter = () => {
    const r = panelRef.current?.getBoundingClientRect();
    return r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width } : null;
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      const c = panelCenter();
      if (!d || !c) return;
      if (d.mode === "move") {
        const r = panelRef.current!.getBoundingClientRect();
        const nx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
        const ny = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
        onTransform(sideKey, { ...d.startT, x: nx, y: ny });
      } else if (d.mode === "resize") {
        const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
        // 21% of panel ≈ half the decal's on-panel width at scale 1 → 1:1 feel
        const scale = clamp(d.startT.scale * (dist / Math.max(d.startDist, 8)), 0.2, 3);
        onTransform(sideKey, { ...d.startT, scale });
      } else {
        const angle = (Math.atan2(e.clientX - d.cx, -(e.clientY - d.cy)) * 180) / Math.PI;
        let delta = angle - d.startAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        onTransform(sideKey, { ...d.startT, rotation: Math.round(d.startT.rotation + delta) });
      }
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }); // re-attach on every render while dragging (same pattern as DecalControls)

  const beginDrag = (e: React.PointerEvent, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    const c = panelCenter();
    if (!c) return;
    setDrag({
      mode,
      startT: slot.transform,
      cx: c.cx, cy: c.cy,
      startDist: Math.hypot(e.clientX - c.cx, e.clientY - c.cy),
      startAngle: (Math.atan2(e.clientX - c.cx, -(e.clientY - c.cy)) * 180) / Math.PI,
    });
  };

  const tr = slot.transform;
  const decalW = 42 * tr.scale; // % of panel width — matches the 3D texture ratio

  return (
    <motion.div
      ref={panelRef}
      onTap={() => onSide(sideKey)}
      whileTap={{ scale: active ? 0.985 : 1 }}
      className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-colors duration-200 touch-none select-none ${
        active
          ? "border-cyan-400/80 bg-cyan-500/[0.07] shadow-[0_0_22px_rgba(6,182,212,0.22)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25"
      }`}
    >
      {/* sliding glow ring that follows the active panel */}
      {active && (
        <motion.div
          layoutId="mockup-active-glow"
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-cyan-300/50"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}

      <div className="absolute inset-0 p-1.5">
        <PanelArt garment={garment} color={color} view={view} uid={sideKey} />
      </div>

      {/* print-area guide when empty (front/back only) */}
      {!slot.url && view !== "sleeve" && (
        <div className="absolute pointer-events-none rounded-lg border border-dashed border-white/20"
          style={{ left: "33%", right: "33%", top: "35%", bottom: "32%" }} />
      )}

      {/* the artwork sticker — direct manipulation ON the mockup */}
      {slot.url && (
        <motion.div
          key={slot.url}
          initial={{ scale: 0.55, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          className="absolute z-10"
          style={{
            left: `${(tr.x + 0.5) * 100}%`,
            top: `${(tr.y + 0.5) * 100}%`,
            width: `${decalW}%`,
            transform: `translate(-50%, -50%) rotate(${tr.rotation}deg) matrix(1, ${tr.skewY ?? 0}, ${tr.skewX ?? 0}, 1, 0, 0)`,
          }}
        >
          <div
            onPointerDown={active ? (e) => beginDrag(e, "move") : undefined}
            className={`relative ${active ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
          >
            <img
              src={slot.url}
              alt=""
              draggable={false}
              className="w-full h-auto object-contain pointer-events-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
            />
            {active && (
              <>
                {/* rotate handle */}
                <div
                  onPointerDown={(e) => beginDrag(e, "rotate")}
                  title={t("اسحب للتدوير", "Drag to rotate")}
                  className="absolute left-1/2 -top-7 -translate-x-1/2 w-4 h-4 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.9)] flex items-center justify-center cursor-grab active:cursor-grabbing"
                >
                  <RotateCcw size={9} className="text-black" />
                </div>
                <div className="absolute left-1/2 -top-3.5 -translate-x-1/2 w-px h-3.5 bg-fuchsia-400/60" />
                {/* resize handle */}
                <div
                  onPointerDown={(e) => beginDrag(e, "resize")}
                  title={t("اسحب للتحجيم", "Drag to resize")}
                  className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)] flex items-center justify-center cursor-nwse-resize"
                >
                  <Expand size={9} className="text-black" />
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* remove sticker (active panel only) */}
      {slot.url && active && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(sideKey); }}
          title={t("حذف الرسمة", "Remove artwork")}
          className="absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-full bg-black/70 border border-red-400/50 text-red-300 flex items-center justify-center hover:bg-red-500/25 transition"
        >
          <Trash2 size={11} />
        </button>
      )}

      {/* label */}
      <div className="absolute bottom-1 inset-x-0 z-20 flex justify-center gap-1 pointer-events-none">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black backdrop-blur-md border ${active ? "bg-cyan-500/30 border-cyan-300/50 text-cyan-50" : "bg-black/60 border-white/10 text-white/60"}`}>
          {label}
        </span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-violet-500/25 border border-violet-300/40 text-violet-200 backdrop-blur-md">
            {badge}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ---------- the board: header actions + 2×2 mockup grid ---------- */
export default function MockupBoard2D({
  garment, color, ar, side, onSide, slots, onTransform, onRemove, onUpload, onOpenParts,
}: Props) {
  const t = (en: string, arT: string) => (ar ? arT : en);
  const fileRef = useRef<HTMLInputElement>(null);
  const isBottom = garment === "pants" || garment === "shorts" || garment === "skirt";
  const isCap = garment === "cap";

  const sleeveLabels = isBottom
    ? [t("رجل يسرى", "L Leg"), t("رجل يمنى", "R Leg")]
    : isCap
      ? [t("جانب أيسر", "L Side"), t("جانب أيمن", "R Side")]
      : [t("كم أيسر", "L Sleeve"), t("كم أيمن", "R Sleeve")];

  const pickFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onUpload(String(reader.result));
    reader.readAsDataURL(f);
  };

  const panels: { key: MockupSide; label: string; view: "front" | "back" | "sleeve"; badge?: string }[] = [
    { key: "front", label: t("الأمام", "Front"), view: "front" },
    { key: "back", label: t("الخلف", "Back"), view: "back" },
    { key: "sleeveL", label: sleeveLabels[0], view: "sleeve", badge: "2D" },
    { key: "sleeveR", label: sleeveLabels[1], view: "sleeve", badge: "2D" },
  ];

  return (
    <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-black">{t("الموك اب ثنائي الأبعاد", "2D Mockups")}</span>
        <span className="text-[10px] text-white/40">
          {t("اسحب الرسمة مباشرة على القطعة · المقبض العلوي يدوّر · السفلي يحجّم", "Drag artwork right on the mockup · top handle rotates · bottom resizes")}
        </span>
      </div>

      {/* actions: purple parts button + upload, both land on the ACTIVE panel */}
      <div className="flex gap-2">
        <button
          onClick={onOpenParts}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-black text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 border border-violet-300/50 shadow-[0_0_18px_rgba(139,92,246,0.45)] hover:brightness-110 active:scale-[0.98] transition"
        >
          <Plus size={15} strokeWidth={3} />
          {t("أجزاء الملابس (هود · ياقة · جيب…)", "Garment parts (hood · collar · pocket…)")}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          title={t("رفع صورة على القطعة المحددة", "Upload artwork onto the selected panel")}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-black text-cyan-100 bg-cyan-500/15 border border-cyan-400/40 hover:bg-cyan-500/25 active:scale-[0.98] transition"
        >
          <Upload size={14} />
          {t("رفع صورة", "Upload")}
        </button>
        <input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {panels.map((p) => (
          <MockupPanel
            key={p.key}
            sideKey={p.key}
            label={p.label}
            badge={p.badge}
            garment={garment} color={color}
            view={p.view}
            active={side === p.key}
            ar={ar}
            slot={slots[p.key]}
            onSide={onSide}
            onTransform={onTransform}
            onRemove={onRemove}
          />
        ))}
      </div>

      <p className="text-[10px] text-white/35 leading-relaxed">
        {t(
          "كل شي تضيفه على مربعي الأمام والخلف يظهر تلقائياً على المجسم ثلاثي الأبعاد فوق. مربعا الأكمام/الأرجل للمخطط ثنائي الأبعاد حالياً.",
          "Anything you add to the Front/Back squares appears automatically on the 3D mockup above. The sleeve squares are 2D-layout only for now.",
        )}
      </p>
    </div>
  );
}
