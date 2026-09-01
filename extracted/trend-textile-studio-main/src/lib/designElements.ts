import { DECORATION_TYPES, type DecorationTypeId } from "@/lib/materialPresets";

/**
 * Design elements — the unified placement system behind the 2D mockup
 * board editor (images AND text), replacing the old single-decal-per-side
 * slots. Everything the person places on a mockup panel becomes an element
 * with full transform (drag / 4-corner free resize / rotate), opacity,
 * fabric-UV intensity and lock state.
 *
 * Front & back elements are composited into full-canvas overlays in RAW
 * texture orientation and handed to Studio3D (overlayFrontUrl /
 * overlayBackUrl), which draws them 1:1 onto the garment texture — so every
 * change reflects on the 3D mockup automatically. Sleeve/leg elements land
 * in the sleeve UV corners (see remapUvToCorner in Studio3D.tsx) which the
 * procedural garments sample for their sleeves; on catalog .glb models
 * they behave like any other texture content.
 *
 * Orientation math (the upside-down-image fix): the garment texture is
 * sampled with v pointing UP (CanvasTexture.flipY = false) while design
 * space is y-down. So a design point (dx, dy) maps to raw canvas
 * ((uOff + (0.5+dx)*uScale)*TEX, (vOff + (0.5-dy)*vScale)*TEX) and each
 * element is blitted through scale(1,-1) AFTER its content was rendered
 * upright in a scratch canvas — the composition S·R(θ) is exactly the
 * canvas linear map that appears as a plain upright rotation θ on the
 * garment. Same math as the fixed drawDecal() in Studio3D.tsx.
 */

export const TEX = 1024;

export type PanelId = "front" | "back" | "sleeveL" | "sleeveR";

export interface TextElementStyle {
  text: string;
  font: string;
  /** Font size as a fraction of the panel width (0.02..0.9). */
  fontScale: number;
  color: string;
  align: "left" | "center" | "right";
  bold?: boolean;
}

export interface DesignElement {
  id: string;
  kind: "image" | "text";
  panel: PanelId;
  /** Center position, fractions of the panel (-0.5..0.5, y down). */
  x: number;
  y: number;
  /** Size as fractions of the panel (w of panel width, h of panel height). */
  w: number;
  h: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** 0..1 */
  opacity: number;
  /** How strongly the fabric's weave/lighting shows through the print
   *  (0% = flat sticker-like print, 100% = deeply fused into the cloth). */
  uv: number;
  locked?: boolean;
  /* ---- image ---- */
  src?: string;
  /* ---- text ---- */
  text?: string;
  font?: string;
  fontScale?: number;
  color?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
}

let idCounter = 0;
export function nextElementId(): string {
  idCounter += 1;
  return `el-${Date.now().toString(36)}-${idCounter}`;
}

export function newImageElement(panel: PanelId, src: string, aspect = 1): DesignElement {
  const w = 0.42;
  return {
    id: nextElementId(),
    kind: "image",
    panel,
    src,
    x: 0,
    y: 0,
    w,
    h: w / (aspect || 1) / (3 / 4), // panels are 3:4 → h as fraction of panel HEIGHT
    rotation: 0,
    opacity: 1,
    uv: 0.25,
  };
}

export function newTextElement(panel: PanelId, style: TextElementStyle): DesignElement {
  return {
    id: nextElementId(),
    kind: "text",
    panel,
    x: 0,
    y: 0,
    w: 0.6,
    h: 0.18,
    rotation: 0,
    opacity: 1,
    uv: 0.15,
    text: style.text,
    font: style.font,
    fontScale: style.fontScale,
    color: style.color,
    align: style.align,
    bold: style.bold ?? true,
  };
}

/* ------------------------------------------------------------------ */
/* panel regions — design space (y down) → raw texture space (v up)    */
/* ------------------------------------------------------------------ */

interface Region {
  /** design (dx,dy) → raw u,v (both 0..1 in texture space) */
  u: (dx: number) => number;
  v: (dy: number) => number;
  /** element px size scale relative to the full texture */
  wScale: number;
  hScale: number;
  /** draw wrapped copies at ±TEX (needed around the u=0/1 seam) */
  wrapX: boolean;
}

const SLEEVE_PAD = 0.12; // must match remapUvToCorner's pad in Studio3D.tsx
const SLEEVE_IN = 0.015;
const SLEEVE_OUT = 0.105;

export const PANEL_REGIONS: Record<PanelId, Region> = {
  front: { u: (dx) => 0.5 + dx, v: (dy) => 0.5 - dy, wScale: 1, hScale: 1, wrapX: false },
  back: {
    // back of the garment lives around the u=0/1 seam (see drawDecal's
    // TEX/2 shift) — an element at design dx=0 straddles the seam, so the
    // compositor also stamps wrapped copies at ±TEX.
    u: (dx) => ((dx % 1) + 1) % 1,
    v: (dy) => 0.5 - dy,
    wScale: 1,
    hScale: 1,
    wrapX: true,
  },
  sleeveL: {
    u: (dx) => SLEEVE_IN + (dx + 0.5) * (SLEEVE_OUT - SLEEVE_IN),
    v: (dy) => SLEEVE_IN + (0.5 - dy) * (SLEEVE_OUT - SLEEVE_IN),
    wScale: SLEEVE_OUT - SLEEVE_IN,
    hScale: SLEEVE_OUT - SLEEVE_IN,
    wrapX: false,
  },
  sleeveR: {
    u: (dx) => 1 - SLEEVE_OUT + (dx + 0.5) * (SLEEVE_OUT - SLEEVE_IN),
    v: (dy) => SLEEVE_IN + (0.5 - dy) * (SLEEVE_OUT - SLEEVE_IN),
    wScale: SLEEVE_OUT - SLEEVE_IN,
    hScale: SLEEVE_OUT - SLEEVE_IN,
    wrapX: false,
  },
};

/* ------------------------------------------------------------------ */
/* element rendering                                                  */
/* ------------------------------------------------------------------ */

/** Renders one element UPRIGHT (design space, y-down) into its own
 *  transparent scratch canvas — image elements draw their bitmap, text
 *  elements rasterize with the chosen font/weight/align, and the fabric
 *  "UV intensity" weave is fused in with source-atop so it never leaks
 *  outside the artwork itself. Returns null for nothing to draw. */
function renderScratch(
  el: DesignElement,
  img: HTMLImageElement | undefined,
  W: number,
  H: number,
): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  const pad = 8;
  c.width = Math.max(2, Math.ceil(W + pad * 2));
  c.height = Math.max(2, Math.ceil(H + pad * 2));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.translate(c.width / 2, c.height / 2);

  if (el.kind === "image") {
    if (!img || !img.naturalWidth) return null;
    ctx.drawImage(img, -W / 2, -H / 2, W, H);
  } else {
    const fontSize = Math.max(6, (el.fontScale ?? 0.18) * TEX * (el.panel === "front" || el.panel === "back" ? 1 : SLEEVE_OUT - SLEEVE_IN));
    ctx.font = `${el.bold ? 900 : 400} ${fontSize}px ${el.font ?? "Cairo"}, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = el.color ?? "#ffffff";
    const line = el.text ?? "";
    if (!line.trim()) return null;
    // alignment shifts within the element's own box
    const metrics = ctx.measureText(line);
    const shift = el.align === "left" ? -Math.max(0, W - metrics.width) / 2 : el.align === "right" ? Math.max(0, W - metrics.width) / 2 : 0;
    ctx.fillText(line, shift, 0);
  }

  // Fabric weave / UV fusion — clipped to the artwork via source-atop so
  // the slider reads as "how much the cloth's weave & light live inside
  // the print" instead of a flat overlay.
  if (el.uv > 0.02) {
    ctx.globalCompositeOperation = "source-atop";
    const a = Math.min(0.85, el.uv);
    ctx.lineWidth = 1;
    const step = 5;
    for (let i = -c.height; i < c.width + c.height; i += step) {
      ctx.strokeStyle = `rgba(0,0,0,${0.16 * a})`;
      ctx.beginPath();
      ctx.moveTo(-c.width / 2 + i, -c.height / 2);
      ctx.lineTo(-c.width / 2 + i + c.height, c.height / 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.12 * a})`;
      ctx.beginPath();
      ctx.moveTo(-c.width / 2 + i + step / 2, -c.height / 2);
      ctx.lineTo(-c.width / 2 + i + c.height + step / 2, c.height / 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  return c;
}

function elementPxSize(el: DesignElement): { W: number; H: number } {
  const region = PANEL_REGIONS[el.panel];
  return { W: Math.max(4, el.w * TEX * region.wScale), H: Math.max(4, el.h * TEX * region.hScale) };
}

function decorationFilter(id: DecorationTypeId | undefined): { filter?: string; stitched?: boolean } {
  const preset = DECORATION_TYPES.find((d) => d.id === id);
  if (!preset) return {};
  return { filter: preset.filter === "none" ? undefined : preset.filter, stitched: preset.stitchedBorder };
}

/** Stamps one element onto a RAW-orientation canvas at its region position. */
function drawElementRaw(
  ctx: CanvasRenderingContext2D,
  el: DesignElement,
  img: HTMLImageElement | undefined,
  deco: { filter?: string; stitched?: boolean },
) {
  const region = PANEL_REGIONS[el.panel];
  const { W, H } = elementPxSize(el);
  const scratch = renderScratch(el, img, W, H);
  if (!scratch) return;
  const cx = region.u(el.x) * TEX;
  const cy = region.v(el.y) * TEX;
  const offsets = region.wrapX ? [-TEX, 0, TEX] : [0];
  for (const off of offsets) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.03, Math.min(1, el.opacity));
    if (deco.filter) ctx.filter = deco.filter;
    ctx.translate(cx + off, cy);
    ctx.scale(1, -1); // v-up texture ↔ y-down design space (the flip fix)
    ctx.rotate((el.rotation * Math.PI) / 180); // linear part = S·R(θ) → appears as a plain CW rotation on the garment
    ctx.drawImage(scratch, -scratch.width / 2, -scratch.height / 2);
    if (deco.stitched) {
      ctx.filter = "none";
      ctx.setLineDash([TEX * 0.008, TEX * 0.008]);
      ctx.lineWidth = Math.max(2, TEX * 0.004);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.strokeRect(-W / 2 - 4, -H / 2 - 4, W + 8, H + 8);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

/** Stamps one element onto a PRETTY (design-space, y-down, upright) canvas —
 *  used for the saved-design thumbnails (decal_url / decal_url_back) so
 *  previews look exactly like the mockups, not the raw mirrored texture. */
function drawElementPretty(
  ctx: CanvasRenderingContext2D,
  el: DesignElement,
  img: HTMLImageElement | undefined,
) {
  const { W, H } = elementPxSize(el);
  const scratch = renderScratch(el, img, W, H);
  if (!scratch) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.03, Math.min(1, el.opacity));
  ctx.translate((0.5 + el.x) * TEX, (0.5 + el.y) * TEX);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.drawImage(scratch, -scratch.width / 2, -scratch.height / 2);
  ctx.restore();
}

export interface ElementImages {
  get: (src: string) => HTMLImageElement | undefined;
}

export interface ComposeResult {
  /** Raw full-canvas overlays for Studio3D (null when the side is empty). */
  frontOverlayUrl: string | null;
  backOverlayUrl: string | null;
  /** Pretty upright per-side previews for saving/thumbnails. */
  frontPrettyUrl: string | null;
  backPrettyUrl: string | null;
  hasFront: boolean;
  hasBack: boolean;
}

export function composeElements(
  elements: DesignElement[],
  images: ElementImages,
  decoFront?: DecorationTypeId,
  decoBack?: DecorationTypeId,
): ComposeResult {
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = TEX;
    c.height = TEX;
    return c;
  };
  const frontEls = elements.filter((e) => e.panel === "front" || e.panel === "sleeveL" || e.panel === "sleeveR");
  const backEls = elements.filter((e) => e.panel === "back");

  const draw = (els: DesignElement[], deco: { filter?: string; stitched?: boolean }, raw: boolean) => {
    if (els.length === 0) return null;
    const c = mk();
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    for (const el of els) {
      const img = el.kind === "image" && el.src ? images.get(el.src) : undefined;
      if (raw) drawElementRaw(ctx, el, img, el.panel === "back" ? deco : el.panel === "front" ? deco : {});
      else drawElementPretty(ctx, el, img);
    }
    try {
      return c.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  const frontDeco = decorationFilter(decoFront);
  const backDeco = decorationFilter(decoBack);

  return {
    frontOverlayUrl: draw(frontEls, frontDeco, true),
    backOverlayUrl: draw(backEls, backDeco, true),
    frontPrettyUrl: draw(frontEls.filter((e) => e.panel === "front"), frontDeco, false),
    backPrettyUrl: draw(backEls, backDeco, false),
    hasFront: frontEls.some((e) => (e.kind === "image" ? e.src : (e.text ?? "").trim())),
    hasBack: backEls.some((e) => (e.kind === "image" ? e.src : (e.text ?? "").trim())),
  };
}

/** Loads any element images that aren't in the cache yet. Returns the
 *  (mutated) cache; callers recompose once the promise resolves. */
export function ensureImagesLoaded(
  elements: DesignElement[],
  cache: Map<string, HTMLImageElement>,
): Promise<void> {
  const missing = Array.from(
    new Set(
      elements
        .filter((e) => e.kind === "image" && e.src && !cache.has(e.src!))
        .map((e) => e.src!),
    ),
  );
  if (missing.length === 0) return Promise.resolve();
  return Promise.all(
    missing.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            cache.set(src, img);
            resolve();
          };
          img.onerror = () => resolve(); // skip broken images, never block
          img.src = src;
        }),
    ),
  ).then(() => undefined);
}

/** Design coords (dx,dy on a mockup panel) → raw texture point (0..1),
 *  exactly where paint strokes for that panel region live. Used by the
 *  mockup board's draw mode via Studio3DHandle.paintAtTexturePoint. */
export function panelDesignToTexture(panel: PanelId, dx: number, dy: number): { u: number; v: number } {
  const r = PANEL_REGIONS[panel];
  return { u: r.u(dx), v: r.v(dy) };
}
