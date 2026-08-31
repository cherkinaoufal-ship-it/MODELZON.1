/**
 * MODELZON paint engine — Procreate-style brush stamping on a 2D canvas that is
 * used as the live texture of the 3D garment.
 *
 * Everything is stroke-based: the studio feeds pointer samples in UV space and
 * the engine interpolates between the previous and current sample so strokes
 * stay smooth no matter how fast the finger moves.
 */

export type ToolId =
  | "select"
  | "draw"
  | "eraser"
  | "bucket"
  | "gradient"
  | "text"
  | "smudge";

export type BrushId =
  // core
  | "pen"
  | "marker"
  | "pencil"
  | "airbrush"
  | "spray"
  | "glow"
  | "calligraphy"
  // stitching
  | "stitch-straight"
  | "stitch-broken"
  | "stitch-rect"
  | "stitch-blanket"
  | "stitch-feather"
  | "stitch-frayed"
  | "stitch-overlock"
  | "stitch-satin"
  // hardware & texture
  | "zipper"
  | "zipper-sketch"
  | "chain"
  | "rip"
  | "camo"
  | "denim"
  | "sequin";

export type LineStyle = "solid" | "dashed" | "dotted" | "zigzag" | "double" | "wavy";

export interface BrushSettings {
  tool: ToolId;
  brush: BrushId;
  size: number;
  color: string;
  opacity: number; // 0..1
  spacing: number; // 0.05..1 of size
  lineStyle: LineStyle;
  symmetry: boolean;
  font: string;
  text: string;
}

export const DEFAULT_BRUSH: BrushSettings = {
  tool: "draw",
  brush: "pen",
  size: 14,
  color: "#22d3ee",
  opacity: 1,
  spacing: 0.25,
  lineStyle: "solid",
  symmetry: false,
  font: "Impact",
  text: "MODELZON",
};

export interface Pt {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** angle between two points */
function ang(a: Pt, b: Pt) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/* ------------------------------------------------------------------ */
/* stamps — each draws one dab at (x, y) rotated to the stroke angle    */
/* ------------------------------------------------------------------ */

type Stamp = (
  ctx: CanvasRenderingContext2D,
  p: Pt,
  angle: number,
  s: BrushSettings,
  i: number,
) => void;

const STAMPS: Record<BrushId, Stamp> = {
  // Softened from a flat solid circle to a tight-core radial falloff — a
  // real pen/brush tip is never a perfectly hard-edged disc, and the tiny
  // per-dab opacity jitter avoids the "plastic sticker" look repeated
  // identical dabs produce on a fast stroke.
  pen: (ctx, p, _a, s) => {
    const r = s.size / 2;
    const jitter = 0.92 + Math.random() * 0.08;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, rgba(s.color, s.opacity * jitter));
    g.addColorStop(0.78, rgba(s.color, s.opacity * jitter));
    g.addColorStop(1, rgba(s.color, s.opacity * jitter * 0.55));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  },

  // Real markers build up richer color where strokes overlap and have soft
  // rounded ends rather than a hard rectangle — this layers a low-opacity
  // fill so repeated passes darken naturally, closer to actual marker ink.
  marker: (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    const w = s.size, h = s.size * 0.7;
    ctx.fillStyle = rgba(s.color, s.opacity * 0.42);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.restore();
  },

  // Graphite texture: soft overlapping smudges of varying size/opacity
  // instead of scattered 1px squares, which read as noise rather than a
  // convincing pencil shade at typical brush sizes.
  pencil: (ctx, p, _a, s) => {
    for (let k = 0; k < 5; k++) {
      const rr = s.size * (0.18 + Math.random() * 0.22);
      const ox = (Math.random() - 0.5) * s.size * 0.7;
      const oy = (Math.random() - 0.5) * s.size * 0.7;
      const g = ctx.createRadialGradient(p.x + ox, p.y + oy, 0, p.x + ox, p.y + oy, rr);
      g.addColorStop(0, rgba(s.color, s.opacity * (0.22 + Math.random() * 0.18)));
      g.addColorStop(1, rgba(s.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  airbrush: (ctx, p, _a, s) => {
    const r = s.size * 1.1;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, rgba(s.color, s.opacity * 0.35));
    g.addColorStop(0.5, rgba(s.color, s.opacity * 0.14));
    g.addColorStop(1, rgba(s.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  },

  spray: (ctx, p, _a, s) => {
    const r = s.size;
    ctx.fillStyle = rgba(s.color, s.opacity * 0.8);
    for (let k = 0; k < 22; k++) {
      const t = Math.random() * Math.PI * 2;
      const rr = Math.random() * r;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(t) * rr, p.y + Math.sin(t) * rr, Math.random() * 1.4 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  glow: (ctx, p, _a, s) => {
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.size * 1.4;
    ctx.fillStyle = rgba(s.color, s.opacity);
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.size / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  calligraphy: (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a + Math.PI / 4);
    ctx.fillStyle = rgba(s.color, s.opacity);
    ctx.fillRect(-s.size / 2, -s.size * 0.09, s.size, s.size * 0.18);
    ctx.restore();
  },

  /* ---------------- stitching ---------------- */

  "stitch-straight": (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1, s.size * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s.size * 0.4, 0);
    ctx.lineTo(s.size * 0.4, 0);
    ctx.stroke();
    ctx.restore();
  },

  "stitch-broken": (ctx, p, a, s, i) => {
    if (i % 2) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1, s.size * 0.15);
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(-s.size * 0.3, 0);
    ctx.lineTo(s.size * 0.3, 0);
    ctx.stroke();
    ctx.restore();
  },

  "stitch-rect": (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1, s.size * 0.12);
    ctx.strokeRect(-s.size * 0.3, -s.size * 0.22, s.size * 0.6, s.size * 0.44);
    ctx.restore();
  },

  "stitch-blanket": (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1, s.size * 0.13);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-s.size * 0.35, -s.size * 0.45);
    ctx.lineTo(-s.size * 0.35, 0);
    ctx.lineTo(s.size * 0.35, 0);
    ctx.stroke();
    ctx.restore();
  },

  "stitch-feather": (ctx, p, a, s, i) => {
    const side = i % 2 ? 1 : -1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1, s.size * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s.size * 0.35, 0);
    ctx.lineTo(0, side * s.size * 0.4);
    ctx.lineTo(s.size * 0.35, 0);
    ctx.stroke();
    ctx.restore();
  },

  "stitch-frayed": (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(s.color, s.opacity * 0.9);
    ctx.lineWidth = Math.max(0.8, s.size * 0.07);
    for (let k = 0; k < 4; k++) {
      const off = (Math.random() - 0.5) * s.size * 0.7;
      ctx.beginPath();
      ctx.moveTo(-s.size * 0.2, off * 0.2);
      ctx.quadraticCurveTo(0, off, s.size * 0.35, off * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  },

  "stitch-overlock": (ctx, p, a, s, i) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1, s.size * 0.12);
    ctx.beginPath();
    ctx.moveTo(-s.size * 0.35, i % 2 ? -s.size * 0.35 : s.size * 0.35);
    ctx.lineTo(s.size * 0.35, i % 2 ? s.size * 0.35 : -s.size * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s.size * 0.4, 0);
    ctx.lineTo(s.size * 0.4, 0);
    ctx.stroke();
    ctx.restore();
  },

  "stitch-satin": (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a + Math.PI / 2);
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1.2, s.size * 0.2);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -s.size * 0.45);
    ctx.lineTo(0, s.size * 0.45);
    ctx.stroke();
    ctx.restore();
  },

  /* ---------------- hardware & textures ---------------- */

  zipper: (ctx, p, a, s, i) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    // tape
    ctx.fillStyle = rgba(shade(s.color, -45), s.opacity);
    ctx.fillRect(-s.size * 0.5, -s.size * 0.5, s.size, s.size);
    // teeth
    ctx.fillStyle = rgba(shade(s.color, 55), s.opacity);
    const side = i % 2 ? -1 : 1;
    ctx.fillRect(-s.size * 0.32, side * s.size * 0.1, s.size * 0.64, s.size * 0.2);
    ctx.restore();
  },

  "zipper-sketch": (ctx, p, a, s, i) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1, s.size * 0.09);
    ctx.beginPath();
    ctx.moveTo(-s.size * 0.5, -s.size * 0.3);
    ctx.lineTo(s.size * 0.5, -s.size * 0.3);
    ctx.moveTo(-s.size * 0.5, s.size * 0.3);
    ctx.lineTo(s.size * 0.5, s.size * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i % 2 ? -s.size * 0.3 : s.size * 0.3);
    ctx.lineTo(0, i % 2 ? s.size * 0.3 : -s.size * 0.3);
    ctx.stroke();
    ctx.restore();
  },

  chain: (ctx, p, a, s, i) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a + (i % 2 ? Math.PI / 2 : 0));
    ctx.strokeStyle = rgba(s.color, s.opacity);
    ctx.lineWidth = Math.max(1.2, s.size * 0.16);
    ctx.beginPath();
    ctx.ellipse(0, 0, s.size * 0.42, s.size * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  rip: (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.fillStyle = rgba("#000000", s.opacity * 0.75);
    ctx.beginPath();
    ctx.moveTo(-s.size * 0.5, (Math.random() - 0.5) * s.size * 0.3);
    ctx.lineTo(0, (Math.random() - 0.5) * s.size * 0.6);
    ctx.lineTo(s.size * 0.5, (Math.random() - 0.5) * s.size * 0.3);
    ctx.lineTo(0, (Math.random() - 0.5) * s.size * 0.5);
    ctx.closePath();
    ctx.fill();
    // frayed threads
    ctx.strokeStyle = rgba(s.color, s.opacity * 0.6);
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-s.size * 0.3, (Math.random() - 0.5) * s.size * 0.5);
      ctx.lineTo(s.size * 0.3, (Math.random() - 0.5) * s.size * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  },

  camo: (ctx, p, _a, s) => {
    const tones = [s.color, shade(s.color, -60), shade(s.color, 40), "#2f3a24"];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = rgba(
        tones[k % tones.length]!.startsWith("#") ? tones[k % tones.length]! : s.color,
        s.opacity * 0.85,
      );
      ctx.beginPath();
      const cx = p.x + (Math.random() - 0.5) * s.size;
      const cy = p.y + (Math.random() - 0.5) * s.size;
      ctx.ellipse(cx, cy, s.size * (0.3 + Math.random() * 0.4), s.size * (0.2 + Math.random() * 0.4), Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  denim: (ctx, p, a, s) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.fillStyle = rgba(s.color, s.opacity * 0.6);
    ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
    ctx.strokeStyle = rgba(shade(s.color, 60), s.opacity * 0.5);
    ctx.lineWidth = 0.7;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-s.size / 2, (k * s.size) / 7);
      ctx.lineTo(s.size / 2, (k * s.size) / 7);
      ctx.stroke();
    }
    ctx.restore();
  },

  sequin: (ctx, p, _a, s) => {
    for (let k = 0; k < 4; k++) {
      const cx = p.x + (Math.random() - 0.5) * s.size;
      const cy = p.y + (Math.random() - 0.5) * s.size;
      ctx.fillStyle = rgba(k % 2 ? shade(s.color, 70) : s.color, s.opacity);
      ctx.beginPath();
      ctx.arc(cx, cy, s.size * 0.12 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

/* ------------------------------------------------------------------ */
/* line styles — decide which dabs along the path actually get drawn    */
/* ------------------------------------------------------------------ */

function styleAllows(style: LineStyle, i: number) {
  switch (style) {
    case "dashed":
      return i % 8 < 5;
    case "dotted":
      return i % 5 === 0;
    default:
      return true;
  }
}

function styleOffset(style: LineStyle, i: number, size: number, angle: number): Pt {
  const perp = angle + Math.PI / 2;
  if (style === "zigzag") {
    const s = i % 2 ? 1 : -1;
    return { x: Math.cos(perp) * s * size * 0.45, y: Math.sin(perp) * s * size * 0.45 };
  }
  if (style === "wavy") {
    const w = Math.sin(i * 0.6) * size * 0.5;
    return { x: Math.cos(perp) * w, y: Math.sin(perp) * w };
  }
  return { x: 0, y: 0 };
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export interface StrokeState {
  /** running dab index, keeps patterned brushes continuous across segments */
  i: number;
  last: Pt | null;
}

export function newStroke(): StrokeState {
  return { i: 0, last: null };
}

/** Draws one interpolated segment. Returns updated stroke state. */
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  state: StrokeState,
  to: Pt,
  s: BrushSettings,
  canvasWidth: number,
) {
  const from = state.last ?? to;
  const step = Math.max(1.2, s.size * s.spacing);
  const d = dist(from, to);
  const n = Math.max(1, Math.ceil(d / step));
  const angle = d < 0.001 ? 0 : ang(from, to);

  const stamp = STAMPS[s.brush] ?? STAMPS.pen;

  ctx.save();
  if (s.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
  ctx.lineJoin = "round";

  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const base: Pt = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    const idx = state.i + k;
    if (!styleAllows(s.lineStyle, idx)) continue;
    const off = styleOffset(s.lineStyle, idx, s.size, angle);
    const p: Pt = { x: base.x + off.x, y: base.y + off.y };

    if (s.tool === "eraser") {
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.tool === "smudge") {
      // cheap but convincing smudge: soft low-alpha smear of the stroke color
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s.size);
      g.addColorStop(0, rgba(s.color, 0.08 * s.opacity));
      g.addColorStop(1, rgba(s.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      stamp(ctx, p, angle, s, idx);
    }

    if (s.lineStyle === "double") {
      const perp = angle + Math.PI / 2;
      const p2: Pt = { x: p.x + Math.cos(perp) * s.size * 0.9, y: p.y + Math.sin(perp) * s.size * 0.9 };
      if (s.tool === "draw") stamp(ctx, p2, angle, s, idx);
    }

    if (s.symmetry) {
      const mp: Pt = { x: canvasWidth - p.x, y: p.y };
      if (s.tool === "eraser") {
        ctx.beginPath();
        ctx.arc(mp.x, mp.y, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.tool === "draw") {
        stamp(ctx, mp, Math.PI - angle, s, idx);
      }
    }
  }
  ctx.restore();

  state.i += n;
  state.last = to;
}

/** Flood fill from a point — used by the ColorDrop / bucket tool. */
export function floodFill(canvas: HTMLCanvasElement, p: Pt, hex: string, tolerance = 42) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const sx = Math.round(p.x);
  const sy = Math.round(p.y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
  const si = (sy * w + sx) * 4;
  const target = [data[si]!, data[si + 1]!, data[si + 2]!, data[si + 3]!];
  const [fr, fg, fb] = hexToRgb(hex);
  if (Math.abs(target[0]! - fr) < 3 && Math.abs(target[1]! - fg) < 3 && Math.abs(target[2]! - fb) < 3 && target[3] === 255) return;

  const stack = [sy * w + sx];
  const seen = new Uint8Array(w * h);
  const match = (i: number) => {
    const o = i * 4;
    return (
      Math.abs(data[o]! - target[0]!) <= tolerance &&
      Math.abs(data[o + 1]! - target[1]!) <= tolerance &&
      Math.abs(data[o + 2]! - target[2]!) <= tolerance &&
      Math.abs(data[o + 3]! - target[3]!) <= tolerance
    );
  };

  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i]) continue;
    seen[i] = 1;
    if (!match(i)) continue;
    const o = i * 4;
    data[o] = fr; data[o + 1] = fg; data[o + 2] = fb; data[o + 3] = 255;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  ctx.putImageData(img, 0, 0);
}

/** Soft linear gradient sweep across the whole texture. */
export function applyGradient(canvas: HTMLCanvasElement, from: Pt, to: Pt, hex: string, opacity: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  g.addColorStop(0, rgba(hex, opacity));
  g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/** Stamps text (typography tool) centred on the given point. */
export function stampText(
  ctx: CanvasRenderingContext2D,
  p: Pt,
  s: BrushSettings,
) {
  if (!s.text) return;
  ctx.save();
  ctx.font = `900 ${Math.max(24, s.size * 6)}px ${s.font}, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = rgba(s.color, s.opacity);
  ctx.fillText(s.text, p.x, p.y);
  ctx.restore();
}

export const BRUSH_GROUPS: { id: string; en: string; ar: string; brushes: { id: BrushId; en: string; ar: string }[] }[] = [
  {
    id: "core",
    en: "Core",
    ar: "أساسية",
    brushes: [
      { id: "pen", en: "Pen", ar: "قلم" },
      { id: "marker", en: "Marker", ar: "ماركر" },
      { id: "pencil", en: "Pencil", ar: "رصاص" },
      { id: "calligraphy", en: "Calligraphy", ar: "خط عربي" },
      { id: "airbrush", en: "Airbrush", ar: "إيربرش" },
      { id: "spray", en: "Spray", ar: "بخاخ" },
      { id: "glow", en: "Neon Glow", ar: "نيون متوهج" },
    ],
  },
  {
    id: "stitch",
    en: "Stitching",
    ar: "الخياطة",
    brushes: [
      { id: "stitch-straight", en: "Straight Stitch", ar: "خيط مستقيم" },
      { id: "stitch-broken", en: "Broken Stitch", ar: "خيط متقطع" },
      { id: "stitch-rect", en: "Rectangle Stitch", ar: "خيط مستطيل" },
      { id: "stitch-blanket", en: "Blanket Stitch", ar: "خيط البطانية" },
      { id: "stitch-feather", en: "Feather Stitch", ar: "خيط الريشة" },
      { id: "stitch-frayed", en: "Frayed Stitch", ar: "خيط منسّل" },
      { id: "stitch-overlock", en: "Overlock", ar: "أوفرلوك" },
      { id: "stitch-satin", en: "Satin Stitch", ar: "خيط ساتان" },
    ],
  },
  {
    id: "hardware",
    en: "Hardware & Texture",
    ar: "إكسسوارات وملامس",
    brushes: [
      { id: "zipper", en: "Zipper", ar: "سحّاب" },
      { id: "zipper-sketch", en: "Zipper Sketch", ar: "سحّاب مرسوم" },
      { id: "chain", en: "Chain", ar: "سلسلة" },
      { id: "rip", en: "Rips / Distress", ar: "تمزيق" },
      { id: "camo", en: "Camo", ar: "كامو" },
      { id: "denim", en: "Denim Weave", ar: "نسيج دنيم" },
      { id: "sequin", en: "Sequins", ar: "ترتر" },
    ],
  },
];

export const FONTS = [
  "Impact",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Arial Black",
  "Verdana",
  "Trebuchet MS",
  "Tahoma",
  "Palatino Linotype",
  "Brush Script MT",
];

export const LINE_STYLES: { id: LineStyle; en: string; ar: string }[] = [
  { id: "solid", en: "Solid", ar: "متصل" },
  { id: "dashed", en: "Dashed", ar: "متقطع" },
  { id: "dotted", en: "Dotted", ar: "منقّط" },
  { id: "zigzag", en: "Zigzag", ar: "زجزاج" },
  { id: "double", en: "Double", ar: "مزدوج" },
  { id: "wavy", en: "Wavy", ar: "متموج" },
];
