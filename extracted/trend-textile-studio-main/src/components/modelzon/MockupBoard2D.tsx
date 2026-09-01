import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Brush, ChevronDown, Expand, Lock, LockOpen, Maximize2, Plus, RotateCcw,
  Trash2, Type as TypeIcon, Upload, X,
} from "lucide-react";
import ColorPickerHSV from "./ColorPickerHSV";
import { FONTS } from "@/lib/paint-engine";
import { type DesignElement, type PanelId, newTextElement } from "@/lib/designElements";

/**
 * 2D Mockup board — the four mockup squares (front / back / L / R sleeve)
 * rebuilt as a real Design-Layout-style editor:
 *
 *  • Tap a square → it expands to a near full-screen editor (§7 of the
 *    overhaul brief) where artwork/text elements get Canva-style direct
 *    manipulation: free drag, 4-corner FREE resize, top rotate handle (§1),
 *    per-element opacity + fabric-UV sliders, lock and delete.
 *  • The purple button opens the full garment-parts picker; anything picked
 *    or uploaded lands on the active panel AND syncs to the 3D garment
 *    automatically (front/back/sleeve regions — see lib/designElements.ts).
 *  • Text tool (§4): input + font (incl. Arabic fonts) + size + color
 *    (the app's own HSV picker) + alignment; text obeys the same handles
 *    and the same orientation fix, so it never prints upside down.
 *  • Draw mode: paint directly on the mockup with the current brush —
 *    strokes go to the REAL 3D texture through paintAtTexturePoint.
 */

/* ---------- small color helper for the fabric gradient ---------- */
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
  const dash = { stroke: "rgba(0,0,0,0.28)", strokeWidth: 1.6, strokeDasharray: "5 4", fill: "none" } as const;
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

  if (view === "sleeve") {
    if (isCap) {
      return (
        <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
          {grad}
          <path d="M150 196 C86 196 42 158 42 104 C42 62 78 34 122 34 C166 34 176 74 170 112 L182 196 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M56 96 C92 76 132 76 162 96" {...dash} />
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

  if (isBottom) {
    if (garment === "skirt") {
      return (
        <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden>
          {grad}
          <path d="M58 30 h84 l26 168 q-72 14 -136 0 Z" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="56" y="22" width="88" height="16" rx="6" fill={fill} stroke={stroke} strokeWidth="2.5" />
          {view === "front" ? (
            <path d="M74 48 L66 196 M100 46 V198 M126 48 L134 196" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" fill="none" />
          ) : (
            <path d="M100 46 V196" stroke="rgba(0,0,0,0.22)" strokeWidth="1.6" strokeDasharray="5 4" fill="none" />
          )}
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
        ? <path d="M62 66 C80 74 120 74 138 66" {...dash} />
        : <path d="M100 52 V96" {...dash} />}
      <path d="M50 206 C74 216 126 216 150 206" {...dash} />
      <path d="M50 54 C74 68 126 68 150 54 L150 214 C126 224 74 224 50 214 Z" fill={`url(#glo-${uid})`} />
    </svg>
  );
}

/** Transparent zone guides (allowed print area + collar/neck line) shown
 *  while editing — §1's "حدود الطباعة المسموحة". */
function PanelGuides({ view, garment }: { view: "front" | "back" | "sleeve"; garment: string }) {
  const isCap = garment === "cap";
  const isBottom = garment === "pants" || garment === "shorts" || garment === "skirt";
  return (
    <svg viewBox="0 0 200 240" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      {/* print area */}
      {view === "sleeve" ? (
        <rect x="52" y="56" width="96" height="120" rx="8" fill="rgba(34,211,238,0.04)" stroke="rgba(34,211,238,0.35)" strokeWidth="1.2" strokeDasharray="6 5" />
      ) : isCap ? (
        <rect x="44" y="58" width="112" height="62" rx="10" fill="rgba(34,211,238,0.04)" stroke="rgba(34,211,238,0.35)" strokeWidth="1.2" strokeDasharray="6 5" />
      ) : isBottom ? (
        <rect x="62" y="60" width="76" height={garment === "skirt" ? 110 : 120} rx="8" fill="rgba(34,211,238,0.04)" stroke="rgba(34,211,238,0.35)" strokeWidth="1.2" strokeDasharray="6 5" />
      ) : (
        <rect x="64" y="80" width="72" height="96" rx="8" fill="rgba(34,211,238,0.04)" stroke="rgba(34,211,238,0.35)" strokeWidth="1.2" strokeDasharray="6 5" />
      )}
      {/* collar / neck guide (tops only) */}
      {!isCap && !isBottom && view !== "sleeve" && (
        <path d="M78 42 C88 56 112 56 122 42" fill="none" stroke="rgba(232,121,249,0.5)" strokeWidth="1.4" strokeDasharray="4 4" />
      )}
      {/* center axis */}
      <line x1="100" y1={view === "sleeve" ? 30 : 40} x2="100" y2="212" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="3 6" />
    </svg>
  );
}

/* ---------- one non-interactive preview cell (the 2×2 grid) ---------- */
function ElementPreview({ el }: { el: DesignElement }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${(el.x + 0.5) * 100}%`,
    top: `${(el.y + 0.5) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
    opacity: el.opacity,
    pointerEvents: "none",
  };
  if (el.kind === "text") {
    return (
      <span
        style={{
          ...style,
          fontFamily: `${el.font}, sans-serif`,
          fontWeight: el.bold ? 900 : 400,
          fontSize: `${(el.fontScale ?? 0.18) * 100}cqw`,
          color: el.color,
          whiteSpace: "pre",
          lineHeight: 1.05,
          textAlign: el.align,
        } as React.CSSProperties}
      >
        {el.text}
      </span>
    );
  }
  return (
    <img
      src={el.src}
      alt=""
      draggable={false}
      style={{ ...style, width: `${el.w * 100}%`, height: `${el.h * 100}%`, objectFit: "contain" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* the interactive editor (used inside the expanded full-screen mode)  */
/* ------------------------------------------------------------------ */

type DragMode = "move" | "rotate" | `resize:${number}`;
interface DragState {
  mode: DragMode;
  id: string;
  startEl: DesignElement;
  cx: number; cy: number;          // element center in px
  startX: number; startY: number;  // pointer at drag start (px)
  startDist: number;
  startAngle: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function PanelEditor({
  garment, color, view, panelId, elements, selectedId, onSelect, onPatch, ar, drawMode,
  onPaint, brushColor, brushSize,
}: {
  garment: string; color: string; view: "front" | "back" | "sleeve";
  panelId: PanelId;
  elements: DesignElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: Partial<DesignElement>) => void;
  ar: boolean;
  drawMode: boolean;
  onPaint: (dx: number, dy: number, down: boolean) => void;
  brushColor: string;
  brushSize: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  // NOTE: argument order here is (arabic, english) — Arabic-first, matching
  // every call site written for the Arabic-first UI.
  const t = (arT: string, en: string) => (ar ? arT : en);
  const selected = elements.find((e) => e.id === selectedId) ?? null;

  const panelRect = () => panelRef.current?.getBoundingClientRect() ?? null;

  const toDesign = (clientX: number, clientY: number) => {
    const r = panelRect();
    if (!r) return null;
    return {
      dx: clamp((clientX - r.left) / r.width - 0.5, -0.5, 0.5),
      dy: clamp((clientY - r.top) / r.height - 0.5, -0.5, 0.5),
      px: { x: clientX, y: clientY, w: r.width, h: r.height },
    };
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const el = d.startEl;
      if (d.mode === "move") {
        const r = panelRect();
        if (!r) return;
        onPatch(d.id, {
          x: clamp(el.x + (e.clientX - d.startX) / r.width, -0.5, 0.5),
          y: clamp(el.y + (e.clientY - d.startY) / r.height, -0.5, 0.5),
        });
      } else if (d.mode === "rotate") {
        const angle = (Math.atan2(e.clientX - d.cx, -(e.clientY - d.cy)) * 180) / Math.PI;
        let delta = angle - d.startAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        onPatch(d.id, { rotation: Math.round(el.rotation + delta) });
      } else {
        // free resize from one of the 4 corners: project the pointer onto
        // the element's own (rotated) axes — width & height scale
        // independently, exactly like the reference Design Layout editor.
        const corner = Number(d.mode.split(":")[1]);
        const rad = (-el.rotation * Math.PI) / 180;
        const vx = e.clientX - d.cx;
        const vy = e.clientY - d.cy;
        const lx = vx * Math.cos(rad) - vy * Math.sin(rad);
        const ly = vx * Math.sin(rad) + vy * Math.cos(rad);
        // sign: which corner the pointer is pulling
        const sx = corner === 0 || corner === 3 ? -1 : 1; // TL/BL pull left, TR/BR pull right
        const sy = corner === 0 || corner === 1 ? -1 : 1; // top corners pull up
        if (el.kind === "text") {
          // text scales as a whole (font size), keeping its measured box
          const dist = Math.max(12, Math.hypot(lx * sx, ly * sy));
          const ratio = dist / Math.max(12, d.startDist);
          onPatch(d.id, { fontScale: clamp((el.fontScale ?? 0.18) * ratio, 0.03, 0.6) });
        } else {
          const r = panelRect();
          if (!r) return;
          const halfW = Math.max(6, (lx * sx) / 2);
          const halfH = Math.max(6, (ly * sy) / 2);
          onPatch(d.id, {
            w: clamp((halfW / r.width) * 2, 0.04, 1.6),
            h: clamp((halfH / r.height) * 2, 0.04, 1.6),
          });
        }
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
  }); // re-attached every render while dragging (same pattern as DecalControls)

  const beginDrag = (e: React.PointerEvent, mode: DragMode, el: DesignElement) => {
    if (drawMode) return;
    e.stopPropagation();
    e.preventDefault();
    const r = panelRect();
    if (!r) return;
    const cx = r.left + (el.x + 0.5) * r.width;
    const cy = r.top + (el.y + 0.5) * r.height;
    onSelect(el.id);
    if (el.locked) return; // selectable but not manipulable until unlocked
    setDrag({
      mode,
      id: el.id,
      startEl: el,
      cx, cy,
      startX: e.clientX,
      startY: e.clientY,
      startDist: Math.max(12, Math.hypot(e.clientX - cx, e.clientY - cy)),
      startAngle: (Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180) / Math.PI,
    });
  };

  const onPanelPointer = (e: React.PointerEvent, down: boolean) => {
    if (!drawMode) return;
    const p = toDesign(e.clientX, e.clientY);
    if (p) onPaint(p.dx, p.dy, down);
  };

  return (
    <div
      ref={panelRef}
      className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-cyan-400/40 bg-cyan-500/[0.04] touch-none select-none"
      style={{ boxShadow: "0 0 40px rgba(6,182,212,0.15) inset", containerType: "inline-size" } as React.CSSProperties}
      onPointerDown={(e) => { onPanelPointer(e, true); if (!drawMode) onSelect(null); }}
      onPointerMove={(e) => { if (e.buttons > 0 || e.pointerType === "touch") onPanelPointer(e, false); }}
    >
      <div className="absolute inset-0 p-2 sm:p-3">
        <PanelArt garment={garment} color={color} view={view} uid={`edit-${panelId}`} />
      </div>
      <PanelGuides view={view} garment={garment} />

      {/* elements */}
      {elements.map((el) => {
        const isSel = el.id === selectedId;
        const base: React.CSSProperties = {
          position: "absolute",
          left: `${(el.x + 0.5) * 100}%`,
          top: `${(el.y + 0.5) * 100}%`,
          transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
          opacity: el.opacity,
        };
        const body =
          el.kind === "text" ? (
            <span
              style={{
                fontFamily: `${el.font}, sans-serif`,
                fontWeight: el.bold ? 900 : 400,
                fontSize: `${(el.fontScale ?? 0.18) * 100}cqw`,
                color: el.color,
                whiteSpace: "pre",
                lineHeight: 1.05,
                display: "block",
                textAlign: el.align,
                minWidth: "1ch",
              } as React.CSSProperties}
            >
              {el.text}
            </span>
          ) : (
            <img
              src={el.src}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
            />
          );

        if (el.kind === "text") {
          return (
            <div
              key={el.id}
              onPointerDown={(e) => beginDrag(e, "move", el)}
              className={drawMode ? "pointer-events-none" : isSel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
              style={base}
            >
              {isSel && !drawMode && <ElementHandles el={el} onDrag={beginDrag} locked={!!el.locked} />}
              <span style={{ position: "relative", display: "inline-block", padding: "6px 10px" }}>{body}</span>
            </div>
          );
        }
        return (
          <div
            key={el.id}
            onPointerDown={(e) => beginDrag(e, "move", el)}
            className={drawMode ? "pointer-events-none" : isSel ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
            style={{ ...base, width: `${el.w * 100}%`, height: `${el.h * 100}%` }}
          >
            {isSel && !drawMode && <ElementHandles el={el} onDrag={beginDrag} locked={!!el.locked} />}
            {body}
          </div>
        );
      })}

      {drawMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur border border-white/15 pointer-events-none">
          <Brush size={12} style={{ color: brushColor }} />
          <span className="text-[10px] font-bold text-white/70">{t("وضع الرسم", "Draw mode")}</span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: brushColor, width: Math.min(18, brushSize / 4 + 6), height: Math.min(18, brushSize / 4 + 6) }} />
        </div>
      )}

      {elements.length === 0 && !drawMode && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-white/10 text-[10px] font-bold text-white/60">
            {t("ارفع صورة · أضف نص · أو ارسم مباشرة", "Upload · add text · or draw right here")}
          </span>
        </div>
      )}
    </div>
  );
}

/** Selection frame: 4 free-resize corner handles + top rotate handle. */
function ElementHandles({
  el, onDrag, locked,
}: {
  el: DesignElement;
  onDrag: (e: React.PointerEvent, mode: DragMode, el: DesignElement) => void;
  locked: boolean;
}) {
  const cornerCls =
    "absolute w-5 h-5 rounded-full border-2 border-black/40 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.8)] touch-none";
  return (
    <>
      <div className="absolute inset-0 rounded-md border-2 border-dashed border-cyan-300/80 pointer-events-none" />
      {!locked && (
        <>
          {/* rotate handle */}
          <div
            onPointerDown={(e) => onDrag(e, "rotate", el)}
            title="تدوير"
            className="absolute left-1/2 -top-8 -translate-x-1/2 w-6 h-6 rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(232,121,249,0.9)] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
          >
            <RotateCcw size={12} className="text-black" />
          </div>
          <div className="absolute left-1/2 -top-3 -translate-x-1/2 w-px h-3 bg-fuchsia-300/70 pointer-events-none" />
          {/* 4 free-resize corners */}
          {[
            { c: 0, cls: "-top-2 -left-2 bg-cyan-300" },
            { c: 1, cls: "-top-2 -right-2 bg-cyan-300" },
            { c: 2, cls: "-bottom-2 -right-2 bg-cyan-300" },
            { c: 3, cls: "-bottom-2 -left-2 bg-cyan-300" },
          ].map(({ c, cls }) => (
            <div
              key={c}
              onPointerDown={(e) => onDrag(e, `resize:${c}` as DragMode, el)}
              title="تحجيم حر"
              className={`${cornerCls} ${cls} cursor-nwse-resize`}
            >
              <Maximize2 size={10} className="text-black/70" />
            </div>
          ))}
        </>
      )}
      {locked && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-400 border border-black/30 flex items-center justify-center">
          <Lock size={10} className="text-black" />
        </div>
      )}
    </>
  );
}

/* ---------- text create/edit form (§4) ---------- */
function TextForm({
  ar, initial, onSubmit, onCancel,
}: {
  ar: boolean;
  initial?: DesignElement;
  onSubmit: (el: DesignElement) => void;
  onCancel: () => void;
}) {
  // NOTE: argument order here is (arabic, english) — Arabic-first, matching
  // every call site written for the Arabic-first UI.
  const t = (arT: string, en: string) => (ar ? arT : en);
  const [text, setText] = useState(initial?.text ?? "");
  const [font, setFont] = useState(initial?.font ?? "Cairo");
  const [fontScale, setFontScale] = useState(initial?.fontScale ?? 0.16);
  const [color, setColor] = useState(initial?.color ?? "#ffffff");
  const [align, setAlign] = useState<"left" | "center" | "right">(initial?.align ?? "center");
  const [bold, setBold] = useState(initial?.bold ?? true);

  return (
    <div className="rounded-2xl p-3 bg-white/[0.04] border border-cyan-400/25 space-y-2.5" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2">
        <TypeIcon size={13} className="text-cyan-300" />
        <span className="text-xs font-black">{initial ? t("تعديل النص", "Edit text") : t("أداة الكتابة", "Text tool")}</span>
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("اكتب أي جملة أو كلمة…", "Type any word or phrase…")}
        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-cyan-400/60"
        style={{ fontFamily: `${font}, sans-serif`, color }}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={font}
          onChange={(e) => setFont(e.target.value)}
          className="bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-[11px] outline-none"
          style={{ fontFamily: `${font}, sans-serif` }}
        >
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: `${f}, sans-serif` }}>{f}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(["right", "center", "left"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAlign(a)}
              className={`flex-1 rounded-lg text-[10px] font-black border transition ${
                align === a ? "bg-cyan-500/25 border-cyan-400 text-cyan-100" : "bg-black/40 border-white/10 text-white/50"
              }`}
            >
              {a === "right" ? "يمين" : a === "center" ? "وسط" : "يسار"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/50 w-10">{t("الحجم", "Size")}</span>
        <input type="range" min={4} max={45} value={Math.round(fontScale * 100)} onChange={(e) => setFontScale(Number(e.target.value) / 100)} className="flex-1 accent-cyan-400" />
        <button
          onClick={() => setBold(!bold)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${bold ? "bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-100" : "bg-black/40 border-white/10 text-white/50"}`}
        >
          B
        </button>
      </div>
      <ColorPickerHSV color={color} onChange={setColor} ar={ar} compact />
      <div className="flex gap-2">
        <button
          onClick={() => { if (!text.trim()) return; onSubmit({ ...(initial ?? newTextElement("front", { text, font, fontScale, color, align, bold })), text, font, fontScale, color, align, bold }); }}
          disabled={!text.trim()}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black text-xs font-black disabled:opacity-40"
        >
          {initial ? t("حفظ", "Save") : t("إضافة النص", "Add text")}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-bold">
          {t("إلغاء", "Cancel")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the board                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  garment: string;
  color: string;
  ar: boolean;
  elements: DesignElement[];
  onPatchElement: (id: string, patch: Partial<DesignElement>) => void;
  onRemoveElement: (id: string) => void;
  onReplaceElement: (el: DesignElement) => void;
  onAddElement: (el: DesignElement) => void;
  onAddImage: (panel: PanelId, dataUrl: string, aspect: number) => void;
  activePanel: PanelId;
  onActivePanel: (p: PanelId) => void;
  onOpenParts: () => void;
  brushColor: string;
  onBrushColor: (c: string) => void;
  brushSize: number;
  onBrushSize: (n: number) => void;
  onPaint: (panel: PanelId, dx: number, dy: number, down: boolean) => void;
  onPaintUndo: () => void;
  onPaintClear: () => void;
}

export default function MockupBoard2D({
  garment, color, ar, elements, onPatchElement, onRemoveElement, onReplaceElement, onAddElement, onAddImage,
  activePanel, onActivePanel, onOpenParts, brushColor, onBrushColor, brushSize, onBrushSize, onPaint, onPaintUndo, onPaintClear,
}: Props) {
  // NOTE: argument order here is (arabic, english) — Arabic-first, matching
  // every call site written for the Arabic-first UI.
  const t = (arT: string, en: string) => (ar ? arT : en);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<PanelId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textFormOpen, setTextFormOpen] = useState(false);
  const [editingTextEl, setEditingTextEl] = useState<DesignElement | null>(null);
  const [drawMode, setDrawMode] = useState(false);

  const isBottom = garment === "pants" || garment === "shorts" || garment === "skirt";
  const isCap = garment === "cap";
  const sleeveLabels = isBottom
    ? [t("رجل يسرى", "L Leg"), t("رجل يمنى", "R Leg")]
    : isCap
      ? [t("جانب أيسر", "L Side"), t("جانب أيمن", "R Side")]
      : [t("كم أيسر", "L Sleeve"), t("كم أيمن", "R Sleeve")];

  const panels: { key: PanelId; label: string; view: "front" | "back" | "sleeve"; badge?: string }[] = [
    { key: "front", label: t("الأمام", "Front"), view: "front" },
    { key: "back", label: t("الخلف", "Back"), view: "back" },
    { key: "sleeveL", label: sleeveLabels[0], view: "sleeve", badge: "2D" },
    { key: "sleeveR", label: sleeveLabels[1], view: "sleeve", badge: "2D" },
  ];

  const pickFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const probe = new Image();
      probe.onload = () => onAddImage(expanded ?? activePanel, url, probe.naturalWidth / Math.max(1, probe.naturalHeight));
      probe.onerror = () => onAddImage(expanded ?? activePanel, url, 1);
      probe.src = url;
    };
    reader.readAsDataURL(f);
  };

  const openExpand = (p: PanelId) => {
    onActivePanel(p);
    setExpanded(p);
    setSelectedId(null);
    setDrawMode(false);
    setTextFormOpen(false);
  };

  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const expandedPanel = panels.find((p) => p.key === expanded);
  const expandedElements = expanded ? elements.filter((e) => e.panel === expanded) : [];

  return (
    <div className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 space-y-3">
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }} />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-black">{t("الموك اب ثنائي الأبعاد", "2D Mockups")}</span>
        <span className="text-[10px] text-white/40">
          {t("اضغط أي مربع لتوسيعه والتحكم الكامل", "Tap a square to expand it for full control")}
        </span>
      </div>

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
          title={t("رفع صورة", "Upload image")}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-black text-cyan-100 bg-cyan-500/15 border border-cyan-400/40 hover:bg-cyan-500/25 active:scale-[0.98] transition"
        >
          <Upload size={14} />
          {t("رفع صورة", "Upload")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {panels.map((p) => {
          const els = elements.filter((e) => e.panel === p.key);
          const isActive = activePanel === p.key;
          return (
            <motion.button
              key={p.key}
              whileTap={{ scale: 0.98 }}
              onClick={() => openExpand(p.key)}
              style={{ containerType: "inline-size" } as React.CSSProperties}
              className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-colors duration-200 text-right ${
                isActive
                  ? "border-cyan-400/80 bg-cyan-500/[0.07] shadow-[0_0_22px_rgba(6,182,212,0.22)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <div className="absolute inset-0 p-1.5">
                <PanelArt garment={garment} color={color} view={p.view} uid={p.key} />
              </div>
              <PanelGuides view={p.view} garment={garment} />
              {els.map((el) => <ElementPreview key={el.id} el={el} />)}
              <div className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/15 text-white/70 flex items-center justify-center backdrop-blur">
                <Expand size={11} />
              </div>
              <div className="absolute bottom-1 inset-x-0 z-10 flex justify-center gap-1 pointer-events-none">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black backdrop-blur-md border ${isActive ? "bg-cyan-500/30 border-cyan-300/50 text-cyan-50" : "bg-black/60 border-white/10 text-white/60"}`}>
                  {p.label}
                </span>
                {p.badge && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-violet-500/25 border border-violet-300/40 text-violet-200 backdrop-blur-md">{p.badge}</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-[10px] text-white/35 leading-relaxed">
        {t(
          "كل تعديل على مربعي الأمام والخلف (والأكمام) ينعكس فوراً على المجسم ثلاثي الأبعاد فوق.",
          "Every edit on the panels reflects on the 3D mockup above in real time.",
        )}
      </p>

      {/* ---------------- expanded full-screen editor (§7) ---------------- */}
      {expanded && expandedPanel && (
        <div className="fixed inset-0 z-[80] bg-black/92 backdrop-blur-md flex flex-col" dir={ar ? "rtl" : "ltr"}>
          {/* header */}
          <div className="flex items-center gap-2 p-3 border-b border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            <span className="text-sm font-black">{expandedPanel.label}</span>
            <span className="text-[10px] text-white/40">{t("وضع التحرير الموسّع", "Expanded editor")}</span>
            <button
              onClick={() => { setExpanded(null); setSelectedId(null); setDrawMode(false); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-white/85 text-[11px] font-black hover:bg-white/20 transition"
            >
              <ChevronDown size={14} /> {t("تصغير", "Collapse")}
            </button>
          </div>

          {/* body: editor + tools */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 overflow-y-auto">
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <div className="h-full max-h-full aspect-[3/4] w-auto max-w-full" style={{ minHeight: "min(62vh, 560px)" }}>
                <PanelEditor
                  garment={garment}
                  color={color}
                  view={expandedPanel.view}
                  panelId={expandedPanel.key}
                  elements={expandedElements}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onPatch={onPatchElement}
                  ar={ar}
                  drawMode={drawMode}
                  brushColor={brushColor}
                  brushSize={brushSize}
                  onPaint={(dx, dy, down) => onPaint(expandedPanel.key, dx, dy, down)}
                />
              </div>
            </div>

            {/* side tools */}
            <div className="w-full lg:w-80 shrink-0 space-y-3">
              {textFormOpen ? (
                <TextForm
                  ar={ar}
                  initial={editingTextEl ?? undefined}
                  onCancel={() => { setTextFormOpen(false); setEditingTextEl(null); }}
                  onSubmit={(el) => {
                    if (editingTextEl) onReplaceElement({ ...el, panel: expandedPanel.key });
                    else onAddElement({ ...el, panel: expandedPanel.key });
                    setTextFormOpen(false);
                    setEditingTextEl(null);
                  }}
                />
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black text-cyan-100 bg-cyan-500/15 border border-cyan-400/40 hover:bg-cyan-500/25 transition">
                    <Upload size={14} /> {t("رفع صورة", "Upload image")}
                  </button>
                  <button onClick={() => { setTextFormOpen(true); setEditingTextEl(null); }}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black text-fuchsia-100 bg-fuchsia-500/15 border border-fuchsia-400/40 hover:bg-fuchsia-500/25 transition">
                    <TypeIcon size={14} /> {t("كتابة نص", "Add text")}
                  </button>
                  <button onClick={() => { setDrawMode((d) => !d); if (!drawMode) setSelectedId(null); }}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black border transition ${
                      drawMode ? "bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black border-transparent" : "text-white/80 bg-white/5 border-white/15 hover:bg-white/10"
                    }`}>
                    <Brush size={14} /> {drawMode ? t("إيقاف الرسم", "Stop drawing") : t("رسم على القطعة", "Draw on piece")}
                  </button>
                  <button onClick={onOpenParts}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 border border-violet-300/50 hover:brightness-110 transition">
                    <Plus size={14} strokeWidth={3} /> {t("أجزاء الملابس", "Parts")}
                  </button>
                </div>
              )}

              {drawMode && (
                <div className="rounded-2xl p-3 bg-white/[0.04] border border-white/10 space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-white/50">{t("فرشاة الرسم", "Paint brush")}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50 w-10">{t("الحجم", "Size")}</span>
                    <input type="range" min={4} max={90} value={brushSize} onChange={(e) => onBrushSize(Number(e.target.value))} className="flex-1 accent-cyan-400" />
                    <span className="text-[10px] font-mono text-cyan-300 w-8">{brushSize}px</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["#ffffff", "#22d3ee", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#f43f5e", "#0f172a"].map((c) => (
                      <button key={c} onClick={() => onBrushColor(c)} title={c}
                        className="w-6 h-6 rounded-md border-2 border-white/25 hover:border-white" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={onPaintUndo} className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[10px] font-bold">
                      {t("تراجع", "Undo")}
                    </button>
                    <button onClick={onPaintClear} className="flex-1 py-2 rounded-lg bg-red-500/15 border border-red-400/40 text-red-200 text-[10px] font-bold">
                      {t("مسح الرسم", "Clear")}
                    </button>
                  </div>
                </div>
              )}

              {/* selected-element control bar (§1) */}
              {selected && !drawMode && (
                <div className="rounded-2xl p-3 bg-white/[0.04] border border-cyan-400/30 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-cyan-200 truncate">
                      {selected.kind === "text" ? t("عنصر نص", "Text element") : t("عنصر صورة", "Image element")}
                    </span>
                    <div className="ml-auto flex gap-1">
                      {selected.kind === "text" && (
                        <button
                          onClick={() => { setEditingTextEl(selected); setTextFormOpen(true); }}
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[10px] font-bold hover:text-white"
                        >
                          {t("تعديل النص", "Edit")}
                        </button>
                      )}
                      <button
                        onClick={() => onPatchElement(selected.id, { locked: !selected.locked })}
                        title={selected.locked ? t("تحرير", "Unlock") : t("تثبيت", "Lock")}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center border transition ${
                          selected.locked ? "bg-amber-500/25 border-amber-400/50 text-amber-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        {selected.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                      </button>
                      <button
                        onClick={() => { onRemoveElement(selected.id); setSelectedId(null); }}
                        disabled={selected.locked}
                        title={t("حذف", "Delete")}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-red-400/40 bg-red-500/15 text-red-300 disabled:opacity-30 hover:bg-red-500/25 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        onClick={() => setSelectedId(null)}
                        title={t("إغلاق", "Close")}
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 text-white/60 hover:text-white transition"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50 w-14">{t("الشفافية", "Opacity")}</span>
                    <input type="range" min={5} max={100} value={Math.round(selected.opacity * 100)}
                      onChange={(e) => onPatchElement(selected.id, { opacity: Number(e.target.value) / 100 })}
                      className="flex-1 accent-cyan-400" disabled={selected.locked} />
                    <span className="text-[10px] font-mono text-cyan-300 w-9">{Math.round(selected.opacity * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50 w-14">{t("تأثير القماش", "Fabric UV")}</span>
                    <input type="range" min={0} max={100} value={Math.round(selected.uv * 100)}
                      onChange={(e) => onPatchElement(selected.id, { uv: Number(e.target.value) / 100 })}
                      className="flex-1 accent-fuchsia-400" disabled={selected.locked} />
                    <span className="text-[10px] font-mono text-fuchsia-300 w-9">{Math.round(selected.uv * 100)}%</span>
                  </div>
                  <p className="text-[9px] text-white/35 leading-relaxed">
                    {t(
                      "المقابض: الزوايا الأربع تحجّم بحرية · المقبض العلوي يدوّر · اسحب العنصر لتحريكه · الحدود المنقّطة = مساحة الطباعة المسموحة.",
                      "Handles: 4 corners resize freely · top handle rotates · drag to move · dashed lines = allowed print area.",
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
