import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef, Component, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";
import {
  drawSegment, newStroke, floodFill, applyGradient, stampText,
  type BrushSettings, type Pt,
} from "@/lib/paint-engine";
import { FABRIC_TYPES, DECORATION_TYPES, type FabricTypeId, type DecorationTypeId } from "@/lib/materialPresets";

export type GarmentType = "tee" | "hoodie" | "sweater" | "pants" | "shorts" | "skirt" | "cap";
export type SizeId = "S" | "M" | "L" | "XL";
const SIZE_SCALE: Record<SizeId, number> = { S: 0.93, M: 1.0, L: 1.07, XL: 1.15 };

const TEX = 1024;

/** Real (PBR) base-fabric material presets — see materialPresets.ts. A
 *  Context instead of threading a new prop through every garment
 *  component (Tee/Hoodie/Cap/Pants) and their 13 separate <ClothMaterial>
 *  call sites — lower risk, and ClothMaterial is the only thing that
 *  actually needs to read it. */
const FabricTypeContext = createContext<FabricTypeId>("cotton");

export interface Studio3DHandle {
  /** Snapshot of just the hand-painted layer (transparent elsewhere), used
   *  to fold free-hand artwork into the duplicate-design fingerprint —
   *  previously only the decal image/transform was hashed, so two designs
   *  with identical decals but completely different hand-painted strokes
   *  were wrongly treated as duplicates. Returns null if nothing painted. */
  getPaintDataUrl: () => string | null;
  /** A real screenshot of the current 3D render — the actual rendered
   *  garment (shape + color + lighting + BOTH decals + freehand paint),
   *  not just the flat decal image. Used so the AI judge in the Arena
   *  evaluates what the garment really looks like instead of only the
   *  printed artwork. Returns null if the canvas hasn't mounted yet. */
  getSnapshotDataUrl: () => string | null;
  /** Paint at a RAW texture coordinate (0..1, v measured from the canvas
   *  top row — i.e. direct canvas space). Used by the 2D mockup board's
   *  draw mode: drawing on a mockup panel paints the real 3D garment
   *  texture in the matching region, live. */
  paintAtTexturePoint: (u: number, v: number, down: boolean) => void;
}

interface Studio3DProps {
  garment: GarmentType;
  color: string;
  quality: "low" | "medium" | "high";
  brush: BrushSettings;
  /** Front-of-garment printed artwork. */
  decalUrl?: string | null;
  decalTransform?: { x: number; y: number; scale: number; rotation: number; skewX?: number; skewY?: number };
  /** Independent back-of-garment printed artwork — a real second slot, not
   *  just the front artwork moved to the other side. Both can be set at
   *  the same time, together with hand-painted strokes; all three are
   *  composited onto the same texture (see `compose()` below). */
  decalUrlBack?: string | null;
  decalTransformBack?: { x: number; y: number; scale: number; rotation: number; skewX?: number; skewY?: number };
  /** Full-canvas (1024×1024) element overlays in RAW texture orientation
   *  (see lib/designElements.ts). When set they are drawn 1:1 onto the
   *  garment texture — the modern multi-element editor (images + text with
   *  opacity/UV/lock etc.) renders into these, while decalUrl/decalUrlBack
   *  stay as the pretty per-side previews used for saving/thumbnails. */
  overlayFrontUrl?: string | null;
  overlayBackUrl?: string | null;
  modelPath?: string | null;
  size?: SizeId;
  /** Base fabric of the garment — drives real PBR roughness/metalness/bump. */
  fabricType?: FabricTypeId;
  /** Print / embroidery treatment applied to the front and back artwork layers. */
  decorationType?: DecorationTypeId;
  decorationTypeBack?: DecorationTypeId;
  /** Stops the idle turntable so the garment holds still while editing */
  frozen?: boolean;
  /** Viewer backdrop color (studio background picker). */
  background?: string;
  /** Motion register of the mannequin: still, walking bob, or wind sway. */
  pose?: GarmentPose;
  /** counters — bump to trigger the action */
  undoSignal?: number;
  clearSignal?: number;
}

export type GarmentPose = "stand" | "walk" | "wind";


/* -------- Realistic garment silhouettes (lathe torso + sleeves) -------- */

function buildTorsoProfile(shoulder: number, chest: number, waist: number, hem: number, height: number) {
  const pts: THREE.Vector2[] = [];
  const rows = [
    [0.0, 0.01],
    [0.03, hem],
    [0.08, hem * 1.01],
    [0.28, waist * 0.99],
    [0.52, chest],
    [0.72, chest * 0.99],
    [0.88, shoulder],
    [0.95, shoulder * 0.72],
    [1.0, 0.02],
  ];
  for (const [t, r] of rows) pts.push(new THREE.Vector2(r!, (t! - 0.5) * height));
  const curve = new THREE.SplineCurve(pts);
  return curve.getPoints(48);
}

const CLOTH_DEPTH = 0.56;

/**
 * Real bug fix: sleeves (and pants legs) reused the SAME geometry object
 * and the SAME shared canvas texture as the torso, with the default 0-1
 * UV wrap every Cylinder/Lathe geometry gets. That meant a paint stroke
 * anywhere near canvas-center showed up identically on BOTH sleeves (and
 * both pant legs) purely because all three surfaces independently sampled
 * the exact same region of the same texture — reported directly from
 * testing ("رسمت بالنص، طلعت نفسها باليدين").
 *
 * Fix: give each limb its own tiny, dedicated corner of the shared canvas
 * (compressing its UV into an 12%×12% square that ordinary torso painting
 * never reaches) instead of letting it read the whole canvas. Base color
 * and the fabric bump map are unaffected (those aren't UV-dependent here);
 * only which small patch of PAINTED/decal content a limb can show changes.
 * Left/right each get a different corner too, so they're no longer
 * mechanically identical the way they were before.
 */
function remapUvToCorner(geometry: THREE.BufferGeometry, corner: 0 | 1 | 2 | 3) {
  const uv = geometry.getAttribute("uv");
  if (!uv) return geometry;
  const pad = 0.12;
  const originX = corner % 2 === 0 ? 0 : 1 - pad;
  const originY = corner < 2 ? 0 : 1 - pad;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, originX + u * pad, originY + v * pad);
  }
  uv.needsUpdate = true;
  return geometry;
}

function useFabricBump() {
  return useMemo(() => {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const n = 128 + (Math.random() - 0.5) * 55;
      data[i * 4] = n; data[i * 4 + 1] = n; data[i * 4 + 2] = n; data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

/**
 * Loads an <img> for a decal URL and keeps it up to date as the URL
 * changes. Returns null until loaded (or if url is null/undefined).
 */
function useDecalImage(url?: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) { setImg(null); return; }
    let cancelled = false;
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => { if (!cancelled) setImg(el); };
    el.src = url;
    return () => { cancelled = true; };
  }, [url]);
  return img;
}

/**
 * Draws one decal onto the shared 1024×1024 garment texture canvas.
 *
 * Placement model: x/y are the same -0.5..0.5 offsets DecalControls'
 * drag pad already produces, applied relative to the canvas center — the
 * exact center a freshly-uploaded decal (x=0, y=0) lands on is the same
 * "front, roughly torso-height" spot the studio has always defaulted new
 * artwork to. `sideShiftPx` moves the WHOLE canvas-space anchor half a
 * turn around (texWidth / 2) for back-of-garment artwork — since every
 * garment mesh here is a lathe revolved 360° around Y, shifting by exactly
 * half the texture width is guaranteed to land on the geometrically
 * opposite side of the garment, regardless of exactly where the UV seam
 * sits (the same guarantee the previous GPU-offset approach relied on,
 * just applied as pixels instead of a texture-sampler offset).
 */
function drawDecal(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  transform: { x: number; y: number; scale: number; rotation: number; skewX?: number; skewY?: number } | undefined,
  texSize: number,
  sideShiftPx: number,
  decoration?: DecorationTypeId,
) {
  const preset = DECORATION_TYPES.find((d) => d.id === decoration);
  const { x = 0, y = 0, scale = 1, rotation = 0, skewX = 0, skewY = 0 } = transform ?? {};
  const baseSize = texSize * 0.42; // a scale=1 decal covers ~42% of the canvas — reads as a real print, not a full wrap
  const w = baseSize * Math.max(0.05, scale);
  const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
  const h = w / aspect;

  let cx = texSize / 2 + x * texSize + sideShiftPx;
  // Orientation fix (the reported "upside-down image" bug): the garment
  // texture is sampled with v pointing UP (tex.flipY = false below), while
  // design-space y points DOWN. So BOTH the decal's vertical position and
  // its internal orientation must be flipped when stamping it onto the
  // paint canvas — translate to the mirrored y, then scale(1,-1) before
  // rotating, so artwork appears on the 3D garment exactly as the person
  // sees it in the 2D mockups (same math as composeElementsOverlay in
  // lib/designElements.ts).
  const cy = texSize / 2 - y * texSize;
  // wrap horizontally so back-shifted artwork re-enters from the other edge
  cx = ((cx % texSize) + texSize) % texSize;

  ctx.save();
  if (preset && preset.filter !== "none") ctx.filter = preset.filter;
  ctx.translate(cx, cy);
  ctx.scale(1, -1);
  ctx.rotate((rotation * Math.PI) / 180);
  // Simplified 2-axis warp (skew/shear) — see DecalTransform.skewX/skewY
  // for why this is the scoped-down version instead of a full per-corner
  // perspective mesh warp.
  if (skewX || skewY) ctx.transform(1, skewY, skewX, 1, 0, 0);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  if (preset?.stitchedBorder) {
    ctx.filter = "none";
    ctx.setLineDash([texSize * 0.008, texSize * 0.008]);
    ctx.lineWidth = Math.max(2, texSize * 0.004);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1, texSize * 0.002);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeRect(-w / 2 - 7, -h / 2 - 7, w + 14, h + 14);
  }
  ctx.restore();

  // Redraw once more shifted a full texture-width to the side so artwork
  // dragged near the horizontal canvas edge doesn't get visually clipped
  // (the garment surface wraps, the canvas doesn't, unless we do this).
  if (cx - w / 2 < 0 || cx + w / 2 > texSize) {
    ctx.save();
    ctx.translate(cx - texSize, cy);
    ctx.scale(1, -1);
    ctx.rotate((rotation * Math.PI) / 180);
    if (skewX || skewY) ctx.transform(1, skewY, skewX, 1, 0, 0);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.save();
    ctx.translate(cx + texSize, cy);
    ctx.scale(1, -1);
    ctx.rotate((rotation * Math.PI) / 180);
    if (skewX || skewY) ctx.transform(1, skewY, skewX, 1, 0, 0);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

/** Shared cloth material tuning — kills the shading/mesh artifacts (z-fighting
 *  and back-face bleed) that made the garments look broken. */
function tuneCloth(mat: THREE.MeshStandardMaterial) {
  mat.side = THREE.FrontSide;
  mat.shadowSide = THREE.FrontSide;
  mat.flatShading = false;
  mat.dithering = true;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  mat.depthWrite = true;
  mat.transparent = false;
  mat.alphaTest = 0;
  mat.needsUpdate = true;
}

function ClothMaterial({
  color, bump, map,
}: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const fabricType = useContext(FabricTypeContext);
  const preset = FABRIC_TYPES.find((f) => f.id === fabricType);
  useEffect(() => { if (ref.current) tuneCloth(ref.current); });
  return (
    <meshStandardMaterial
      ref={ref}
      key={map ? `map-${map.uuid}` : "plain"}
      color={map ? "#ffffff" : color}
      roughness={preset?.roughness ?? 0.88}
      metalness={preset?.metalness ?? 0}
      bumpMap={bump}
      bumpScale={preset?.bumpScale ?? 0.012}
      envMapIntensity={0.35}
      map={map ?? undefined}
    />
  );
}

/* Tee = torso + short sleeves + neckband */
function Tee({ color, bump, map }: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const torso = useMemo(() => {
    const g = new THREE.LatheGeometry(buildTorsoProfile(0.55, 1.1, 0.95, 1.05, 3.2), 48);
    g.computeVertexNormals();
    return g;
  }, []);
  const sleeveGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.35, 0.42, 0.9, 24, 1, true);
    g.computeVertexNormals();
    return g;
  }, []);
  const sleeveGeoL = useMemo(() => remapUvToCorner(sleeveGeo.clone(), 0), [sleeveGeo]);
  const sleeveGeoR = useMemo(() => remapUvToCorner(sleeveGeo.clone(), 1), [sleeveGeo]);
  const collarGeo = useMemo(() => new THREE.TorusGeometry(0.32, 0.06, 12, 32), []);

  return (
    <group>
      <mesh geometry={torso} scale={[1, 1, CLOTH_DEPTH]} castShadow receiveShadow>
        <ClothMaterial color={color} bump={bump} map={map} />
      </mesh>
      {([[-1, sleeveGeoL], [1, sleeveGeoR]] as const).map(([s, geo]) => (
        <mesh key={s} geometry={geo} position={[s * 0.98, 1.12, 0]}
          rotation={[0, 0, (s * Math.PI) / 2.6]} scale={[1, 1, 0.8]} castShadow>
          <ClothMaterial color={color} bump={bump} map={map} />
        </mesh>
      ))}
      <mesh geometry={collarGeo} position={[0, 1.53, 0.02]} scale={[1, 0.82, CLOTH_DEPTH]} rotation={[Math.PI / 2, 0, 0]}>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
    </group>
  );
}

/* Hoodie = tee + hood + kangaroo pocket + strings */
function Hoodie({ color, bump, map }: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const torso = useMemo(() => {
    const g = new THREE.LatheGeometry(buildTorsoProfile(0.62, 1.2, 1.1, 1.2, 3.6), 48);
    g.computeVertexNormals();
    return g;
  }, []);
  const sleeveGeo = useMemo(() => new THREE.CylinderGeometry(0.4, 0.5, 1.7, 24, 1, true), []);
  const sleeveGeoL = useMemo(() => remapUvToCorner(sleeveGeo.clone(), 0), [sleeveGeo]);
  const sleeveGeoR = useMemo(() => remapUvToCorner(sleeveGeo.clone(), 1), [sleeveGeo]);
  const hoodGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.65, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.65);
    g.computeVertexNormals();
    return g;
  }, []);
  const pocketGeo = useMemo(() => new THREE.TorusGeometry(0.55, 0.11, 10, 32, Math.PI), []);
  const stringGeo = useMemo(() => new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), []);

  return (
    <group>
      <mesh geometry={torso} scale={[1, 1, CLOTH_DEPTH + 0.08]} castShadow receiveShadow>
        <ClothMaterial color={color} bump={bump} map={map} />
      </mesh>
      {([[-1, sleeveGeoL], [1, sleeveGeoR]] as const).map(([s, geo]) => (
        <mesh key={s} geometry={geo} position={[s * 1.1, 0.58, 0]}
          rotation={[0, 0, (s * Math.PI) / 2.9]} scale={[1, 1, 0.82]} castShadow>
          <ClothMaterial color={color} bump={bump} map={map} />
        </mesh>
      ))}
      <mesh geometry={hoodGeo} position={[0, 1.62, -0.1]} rotation={[-0.25, 0, 0]} scale={[1, 1.05, 0.85]} castShadow>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
      <mesh geometry={pocketGeo} position={[0, -0.3, 0.7]} scale={[1, 1, 0.6]} rotation={[0, 0, Math.PI]}>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} geometry={stringGeo} position={[x, 1.15, 0.52]}>
          <meshStandardMaterial color="#f8fafc" roughness={0.65} />
        </mesh>
      ))}
    </group>
  );
}

/* Cap = crown lathe + curved brim */
function Cap({ color, bump, map }: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const crown = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push(new THREE.Vector2(1.05 * Math.cos(t * Math.PI * 0.42) + 0.02, t * 0.95));
    }
    const g = new THREE.LatheGeometry(pts, 48);
    g.computeVertexNormals();
    return g;
  }, []);

  const brim = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1.15, Math.PI * 1.15, Math.PI * 1.85, false);
    shape.lineTo(0.9, 0.05);
    shape.absarc(0, 0, 0.9, Math.PI * 1.85, Math.PI * 1.15, true);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, curveSegments: 32 });
    g.computeVertexNormals();
    return g;
  }, []);

  const button = useMemo(() => new THREE.SphereGeometry(0.06, 16, 16), []);

  return (
    <group>
      <mesh geometry={crown} scale={[1, 1, 0.94]} castShadow receiveShadow>
        <ClothMaterial color={color} bump={bump} map={map} />
      </mesh>
      <mesh geometry={brim} position={[0, -0.07, 0]} rotation={[-0.1, 0, 0]} castShadow>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
      <mesh geometry={button} position={[0, 0.99, 0]}>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
    </group>
  );
}

/* Pants = two tapered legs + waistband */
function Pants({ color, bump, map }: { color: string; bump: THREE.Texture; map: THREE.Texture | null }) {
  const legGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.55, 0),
      new THREE.Vector2(0.5, 0.4),
      new THREE.Vector2(0.42, 1.6),
      new THREE.Vector2(0.38, 2.8),
    ];
    const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x, -p.y)), 32);
    g.computeVertexNormals();
    return g;
  }, []);
  const legGeoL = useMemo(() => remapUvToCorner(legGeo.clone(), 0), [legGeo]);
  const legGeoR = useMemo(() => remapUvToCorner(legGeo.clone(), 1), [legGeo]);

  const waistband = useMemo(() => new THREE.TorusGeometry(0.85, 0.12, 16, 40), []);

  return (
    <group position={[0, 0.6, 0]}>
      <mesh geometry={waistband} rotation={[Math.PI / 2, 0, 0]}>
        <ClothMaterial color={color} bump={bump} map={null} />
      </mesh>
      {([[-0.45, legGeoL], [0.45, legGeoR]] as const).map(([x, geo]) => (
        <mesh key={x} geometry={geo} position={[x, -0.1, 0]} scale={[0.82, 1, 0.82]} castShadow receiveShadow>
          <ClothMaterial color={color} bump={bump} map={map} />
        </mesh>
      ))}
    </group>
  );
}

/** Loads a real catalog .glb. The garment's own baked fabric texture is handed
 *  back to the studio so painting happens ON TOP of real fabric detail instead
 *  of flattening it into one solid color. */
function CustomGarment({
  path, color, texture, onBaked, onPointerPaint,
}: {
  path: string;
  color: string;
  texture: THREE.Texture;
  onBaked: (image: HTMLImageElement | ImageBitmap | HTMLCanvasElement | null) => void;
  onPointerPaint?: (uv: THREE.Vector2, down: boolean) => void;
}) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useMemo(() => {
    let baked: any = null;
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (!src || !("color" in src)) return;
      const mat = src.clone();
      if (!baked && mat.map?.image) baked = mat.map.image;
      mat.map = texture;
      mat.color.set("#ffffff");
      mat.roughness = Math.max(mat.roughness ?? 0.8, 0.72);
      mat.envMapIntensity = 0.5;
      tuneCloth(mat);
      mesh.material = mat;
    });
    onBaked(baked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, texture]);

  // re-tint whenever the base color changes (composited into the texture)
  useEffect(() => { void color; }, [color]);

  const { normalizedScale, offsetY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 2.6 / (size.y || 1);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return { normalizedScale: scale, offsetY: -center.y * scale };
  }, [cloned]);

  return (
    <group scale={normalizedScale} position={[0, offsetY, 0]}>
      <primitive
        object={cloned}
        onPointerDown={(e: any) => { if (onPointerPaint && e.uv) { e.stopPropagation(); onPointerPaint(e.uv, true); } }}
        onPointerMove={(e: any) => { if (onPointerPaint && e.uv && (e.buttons > 0 || e.pointerType === "touch")) { e.stopPropagation(); onPointerPaint(e.uv, false); } }}
      />
    </group>
  );
}

function Garment(props: {
  garment: GarmentType;
  color: string;
  modelPath?: string | null;
  size?: SizeId;
  /** Base fabric of the garment — drives real PBR roughness/metalness/bump. */
  fabricType?: FabricTypeId;
  /** Print / embroidery treatment applied to the front and back artwork layers. */
  decorationType?: DecorationTypeId;
  decorationTypeBack?: DecorationTypeId;
  texture: THREE.Texture;
  spin: boolean;
  pose?: GarmentPose;
  onBaked: (image: any) => void;
  onPointerPaint?: (uv: THREE.Vector2, down: boolean) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bump = useFabricBump();
  const sizeScale = SIZE_SCALE[props.size ?? "M"];

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (props.spin) g.rotation.y += delta * 0.22;
    const time = state.clock.elapsedTime;
    if (props.pose === "walk") {
      g.position.y = Math.abs(Math.sin(time * 3.6)) * 0.14;
      g.rotation.z = Math.sin(time * 3.6) * 0.045;
      g.position.x = Math.sin(time * 1.8) * 0.05;
    } else if (props.pose === "wind") {
      g.position.y = Math.sin(time * 1.4) * 0.04;
      g.rotation.z = Math.sin(time * 1.6) * 0.08;
      g.position.x = Math.sin(time * 1.1) * 0.07;
    } else {
      g.position.set(0, 0, 0);
      g.rotation.z = 0;
    }
  });

  const proceduralMap = props.texture;

  return (
    <group ref={groupRef} scale={sizeScale}>
      {props.modelPath ? (
        <CustomGarment
          path={props.modelPath}
          color={props.color}
          texture={props.texture}
          onBaked={props.onBaked}
          onPointerPaint={props.onPointerPaint}
        />
      ) : (
        <group
          onPointerDown={(e: any) => { if (props.onPointerPaint && e.uv) { e.stopPropagation(); props.onPointerPaint(e.uv, true); } }}
          onPointerMove={(e: any) => { if (props.onPointerPaint && e.uv && (e.buttons > 0 || e.pointerType === "touch")) { e.stopPropagation(); props.onPointerPaint(e.uv, false); } }}
        >
          {props.garment === "tee" && <Tee color={props.color} bump={bump} map={proceduralMap} />}
          {(props.garment === "hoodie" || props.garment === "sweater") && (
            <Hoodie color={props.color} bump={bump} map={proceduralMap} />
          )}
          {props.garment === "cap" && <Cap color={props.color} bump={bump} map={proceduralMap} />}
          {(props.garment === "pants" || props.garment === "shorts" || props.garment === "skirt") && (
            <Pants color={props.color} bump={bump} map={proceduralMap} />
          )}
        </group>
      )}
    </group>
  );
}

class ModelErrorBoundary extends Component<
  { path?: string | null; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[Studio3D] model failed:", this.props.path, error);
  }

  retry = () => {
    // drei caches failed loads — clear it so the retry actually refetches.
    try { if (this.props.path) useGLTF.clear(this.props.path); } catch { /* ignore */ }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-xs">
            <div className="text-3xl mb-2">⚠️</div>
            <div className="text-white/80 text-sm font-bold mb-1">تعذّر تحميل ملف القطعة 3D</div>
            <div className="text-white/40 text-xs font-mono break-all mb-3">{this.props.path}</div>
            <button
              onClick={this.retry}
              className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary text-sm font-bold"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default forwardRef<Studio3DHandle, Studio3DProps>(function Studio3D(props, ref) {
  const dpr: [number, number] =
    props.quality === "high" ? [1, 2] : props.quality === "medium" ? [1, 1.5] : [0.75, 1];

  const paintKey = props.modelPath ?? props.garment;

  /** three stacked layers:
   *   base  = the garment's own baked fabric texture, multiplied by the picked color
   *   paint = the person's hand-drawn strokes (transparent elsewhere)
   *   out   = base + paint, used as the live map on the 3D garment
   */
  const layers = useMemo(() => {
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = TEX; c.height = TEX;
      return c;
    };
    const base = mk();
    const paint = mk();
    const out = mk();
    const tex = new THREE.CanvasTexture(out);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return { base, paint, out, tex };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintKey]);

  const bakedRef = useRef<any>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const strokeRef = useRef(newStroke());
  const gradStartRef = useRef<Pt | null>(null);
  const [hasArtwork, setHasArtwork] = useState(false);

  /**
   * Non-destructive paint layers (per feedback that freehand drawing was
   * flattened straight into one canvas with no way to hide/delete a
   * single stroke group afterward). Low-risk approach on purpose: nothing
   * about compose(), getPaintDataUrl(), or the fingerprint changes —
   * `layers.paint` still exists exactly as before and is still what
   * everything downstream reads. It just becomes an auto-recomputed
   * COMPOSITE of these layers instead of being drawn into directly.
   * Capped at 8 layers (each is its own full-size offscreen canvas —
   * more than that gets memory-heavy on weaker Android devices).
   */
  const MAX_PAINT_LAYERS = 8;
  const makeLayerCanvas = () => {
    const c = document.createElement("canvas");
    c.width = TEX; c.height = TEX;
    return c;
  };
  const [paintLayers, setPaintLayers] = useState<{ id: string; canvas: HTMLCanvasElement; visible: boolean; label: string }[]>(
    () => [{ id: "layer-1", canvas: makeLayerCanvas(), visible: true, label: "Layer 1" }],
  );
  const [activeLayerId, setActiveLayerId] = useState("layer-1");
  const layerCounter = useRef(1);

  const activeLayerCanvas = () => paintLayers.find((l) => l.id === activeLayerId)?.canvas ?? paintLayers[0]?.canvas;

  /** Recomputes layers.paint (the flat composite everything else reads)
   *  from the current stack of layer canvases, then re-runs compose() so
   *  the 3D garment reflects it immediately. */
  const recompositeLayers = () => {
    const ctx = layers.paint.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, TEX, TEX);
    for (const l of paintLayers) {
      if (l.visible) ctx.drawImage(l.canvas, 0, 0);
    }
    compose();
  };

  const addPaintLayer = () => {
    if (paintLayers.length >= MAX_PAINT_LAYERS) return;
    layerCounter.current += 1;
    const id = `layer-${layerCounter.current}`;
    const canvas = makeLayerCanvas();
    setPaintLayers((ls) => [...ls, { id, canvas, visible: true, label: `Layer ${layerCounter.current}` }]);
    setActiveLayerId(id);
  };

  const toggleLayerVisible = (id: string) => {
    setPaintLayers((ls) => ls.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };

  const deleteLayer = (id: string) => {
    setPaintLayers((ls) => {
      const next = ls.filter((l) => l.id !== id);
      return next.length > 0 ? next : [{ id: "layer-1", canvas: makeLayerCanvas(), visible: true, label: "Layer 1" }];
    });
    setActiveLayerId((cur) => (cur === id ? (paintLayers.find((l) => l.id !== id)?.id ?? "layer-1") : cur));
  };

  // Any time the layer stack (order/visibility/count) changes, refresh the composite.
  useEffect(() => { recompositeLayers(); }, [paintLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to a single fresh layer when switching garment/model — otherwise
  // stale layer canvases from a different piece would linger.
  useEffect(() => {
    layerCounter.current = 1;
    setPaintLayers([{ id: "layer-1", canvas: makeLayerCanvas(), visible: true, label: "Layer 1" }]);
    setActiveLayerId("layer-1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintKey]);

  const decalFrontImg = useDecalImage(props.decalUrl);
  const decalBackImg = useDecalImage(props.decalUrlBack);
  const overlayFrontImg = useDecalImage(props.overlayFrontUrl);
  const overlayBackImg = useDecalImage(props.overlayBackUrl);
  // Always-fresh reference to the current paintAt (it closes over the
  // current brush/layer each render) so the imperative handle never calls
  // a stale one.
  const paintAtRef = useRef<(uv: THREE.Vector2, down: boolean) => void>(() => {});

  useImperativeHandle(ref, () => ({
    getPaintDataUrl: () => {
      if (!hasArtwork) return null;
      try {
        return layers.paint.toDataURL("image/png");
      } catch {
        return null;
      }
    },
    getSnapshotDataUrl: () => {
      try {
        return glCanvasRef.current?.toDataURL("image/jpeg", 0.85) ?? null;
      } catch {
        // Most likely a WebGL "tainted canvas" security error, which
        // shouldn't happen here since everything drawn onto the garment
        // (uploads, AI-generated art) is same-origin/data-URL — but fail
        // soft rather than crash the judge flow either way.
        return null;
      }
    },
    paintAtTexturePoint: (u: number, v: number, down: boolean) => {
      paintAtRef.current(new THREE.Vector2(u, v), down);
    },
  }), [hasArtwork, layers.paint]);

  /** rebuilds base (fabric × color) → stamps front/back decals → composites
   *  hand-painted strokes on top. All three coexist now — previously a
   *  decal only showed up when nothing had been hand-painted yet. */
  const compose = () => {
    const b = layers.base.getContext("2d");
    const o = layers.out.getContext("2d");
    if (!b || !o) return;

    b.clearRect(0, 0, TEX, TEX);
    if (bakedRef.current) {
      try { b.drawImage(bakedRef.current, 0, 0, TEX, TEX); } catch { /* ignore */ }
    } else {
      b.fillStyle = "#ffffff";
      b.fillRect(0, 0, TEX, TEX);
    }
    b.save();
    b.globalCompositeOperation = "multiply";
    b.fillStyle = props.color;
    b.fillRect(0, 0, TEX, TEX);
    b.restore();

    o.clearRect(0, 0, TEX, TEX);
    o.drawImage(layers.base, 0, 0);
    // Multi-element overlays (2D mockup board editor) — full-canvas images
    // in raw texture orientation, drawn 1:1 with no placement math here.
    if (overlayFrontImg) o.drawImage(overlayFrontImg, 0, 0, TEX, TEX);
    if (overlayBackImg) o.drawImage(overlayBackImg, 0, 0, TEX, TEX);
    if (decalFrontImg) drawDecal(o, decalFrontImg, props.decalTransform, TEX, 0, props.decorationType);
    if (decalBackImg) drawDecal(o, decalBackImg, props.decalTransformBack, TEX, TEX / 2, props.decorationTypeBack);
    o.drawImage(layers.paint, 0, 0);
    layers.tex.needsUpdate = true;
  };

  // Redraw whenever either decal (image or its placement) changes — not
  // just on color/paint changes like before, since decals are now baked
  // pixels instead of a live GPU texture offset.
  useEffect(() => { compose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [
    decalFrontImg, decalBackImg, overlayFrontImg, overlayBackImg,
    props.decalTransform?.x, props.decalTransform?.y, props.decalTransform?.scale, props.decalTransform?.rotation,
    props.decalTransformBack?.x, props.decalTransformBack?.y, props.decalTransformBack?.scale, props.decalTransformBack?.rotation,
    props.decorationType, props.decorationTypeBack,
  ]);

  useEffect(() => { compose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [props.color, layers]);

  // clear — clears the ACTIVE layer only (consistent with per-layer editing)
  useEffect(() => {
    if (props.clearSignal === undefined) return;
    activeLayerCanvas()?.getContext("2d")?.clearRect(0, 0, TEX, TEX);
    historyRef.current = [];
    setHasArtwork(false);
    recompositeLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.clearSignal]);

  // undo — operates on the ACTIVE layer only now (undoing a stroke on
  // Layer 2 shouldn't touch Layer 1's content).
  useEffect(() => {
    if (props.undoSignal === undefined) return;
    const snap = historyRef.current.pop();
    const canvas = activeLayerCanvas();
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    if (snap) ctx.putImageData(snap, 0, 0);
    else ctx.clearRect(0, 0, TEX, TEX);
    setHasArtwork(historyRef.current.length > 0);
    recompositeLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.undoSignal]);

  const pushHistory = () => {
    const canvas = activeLayerCanvas();
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, TEX, TEX));
    if (historyRef.current.length > 12) historyRef.current.shift();
  };

  const brush = props.brush;
  const paintingActive = brush.tool !== "select";

  const paintAt = (uv: THREE.Vector2, down: boolean) => {
    const canvas = activeLayerCanvas();
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas) return;
    // Bug fix: strokes near the bottom of the garment were landing near the
    // top instead (reported directly from testing on the live app). The
    // paint canvas texture is uploaded with flipY=false (see `tex.flipY =
    // false` above), so mesh UV.y should map to canvas Y directly — the
    // previous `(1 - uv.y)` inversion here was fighting that and flipping
    // painted strokes vertically. If a future model swap ever reintroduces
    // the same symptom, toggle PAINT_V_FLIP below rather than hunting for
    // this line again.
    const PAINT_V_FLIP = false;
    const p: Pt = { x: uv.x * TEX, y: (PAINT_V_FLIP ? 1 - uv.y : uv.y) * TEX };

    if (down) {
      pushHistory();
      strokeRef.current = newStroke();
      strokeRef.current.last = p;
    }

    if (brush.tool === "bucket") {
      if (!down) return;
      floodFill(canvas, p, brush.color);
    } else if (brush.tool === "text") {
      if (!down) return;
      stampText(ctx, p, brush);
    } else if (brush.tool === "gradient") {
      if (down) { gradStartRef.current = p; return; }
      const from = gradStartRef.current;
      if (!from) return;
      applyGradient(canvas, from, p, brush.color, brush.opacity);
    } else {
      drawSegment(ctx, strokeRef.current, p, brush, TEX);
    }

    setHasArtwork(true);
    recompositeLayers();
  };

    paintAtRef.current = paintAt;

  useEffect(() => {
    const up = () => { gradStartRef.current = null; strokeRef.current = newStroke(); };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // --- Cosmetic paint-splatter overlay (screen-space, see the JSX below) ---
  const [splatters, setSplatters] = useState<{ id: number; x: number; y: number; dx: number; dy: number; size: number; color: string }[]>([]);
  const splatterId = useRef(0);
  const lastSplatterAt = useRef(0);

  const spawnSplatters = (clientX: number, clientY: number, target: EventTarget | null) => {
    if (!paintingActive) return;
    if (brush.tool !== "draw") return; // only the actual drawing action, not eraser/bucket/text/etc.
    if (brush.brush !== "pen" && brush.brush !== "marker" && brush.brush !== "spray") return;
    const now = performance.now();
    if (now - lastSplatterAt.current < 45) return; // throttle so it stays a light flourish, not a blizzard
    lastSplatterAt.current = now;
    const el = (target as HTMLElement)?.closest?.(".relative.w-full.h-full") as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    const x = rect ? clientX - rect.left : clientX;
    const y = rect ? clientY - rect.top : clientY;
    const count = 2 + Math.floor(Math.random() * 3);
    const next = Array.from({ length: count }).map(() => ({
      id: splatterId.current++,
      x, y,
      dx: (Math.random() - 0.5) * 46,
      dy: (Math.random() - 0.5) * 46 + 10, // slight downward drift, like real flicked paint
      size: 3 + Math.random() * 6,
      color: brush.color,
    }));
    setSplatters((cur) => [...cur, ...next].slice(-40)); // cap total for perf
  };

  const onSplatterPointer = (e: React.PointerEvent) => spawnSplatters(e.clientX, e.clientY, e.target);
  const onSplatterPointerMove = (e: React.PointerEvent) => { if (e.buttons === 1) spawnSplatters(e.clientX, e.clientY, e.target); };

  return (
    <div className="relative w-full h-full" onPointerDown={onSplatterPointer} onPointerMove={onSplatterPointerMove}>
      <ModelErrorBoundary key={props.modelPath ?? props.garment} path={props.modelPath}>
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: [0, 0.5, 6], fov: 40 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          preserveDrawingBuffer: true, // required so .toDataURL() on the WebGL canvas actually returns pixels (see getSnapshotDataUrl)
        }}
        onCreated={(state) => { glCanvasRef.current = state.gl.domElement; }}
      >
        <color attach="background" args={[props.background ?? "#000000"]} />
        <fog attach="fog" args={[props.background ?? "#000000", 10, 24]} />

        <ambientLight intensity={0.38} />
        <directionalLight
          position={[3.5, 6, 4]}
          intensity={2.2}
          color="#fff7ec"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[-4, 2.5, 3]} intensity={0.55} color="#eef3fb" />
        <directionalLight position={[0, 3.5, -5]} intensity={0.7} color="#ffffff" />

        <Suspense fallback={null}>
          <FabricTypeContext.Provider value={props.fabricType ?? "cotton"}>
          <Garment
            garment={props.garment}
            color={props.color}
            modelPath={props.modelPath}
            size={props.size}
            texture={layers.tex}
            spin={!props.frozen && !paintingActive}
            pose={props.pose}
            onBaked={(image) => { bakedRef.current = image; compose(); }}
            onPointerPaint={paintingActive ? paintAt : undefined}
          />
          </FabricTypeContext.Provider>
        </Suspense>

        <ContactShadows position={[0, -2.4, 0]} opacity={0.65} scale={14} blur={2.4} far={5} />

        {/* Studio-style HDRI environment lighting — adds realistic
            reflections/ambient fill on top of the existing three
            directional lights (kept as-is; Environment complements them,
            doesn't replace them). Uses drei's built-in preset, so no new
            package install is needed — safe, additive change. */}
        <Environment preset="studio" />

        <OrbitControls
          enablePan={false}
          enableRotate={!paintingActive}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.75}
          zoomSpeed={0.7}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.9}
          minDistance={3.5}
          maxDistance={10}
        />
      </Canvas>
      </ModelErrorBoundary>

      {/* Layers panel — small floating overlay in the corner of the 3D
          viewport (kept inside Studio3D rather than lifted to the parent,
          so the layer canvases and their React state stay in one place;
          lowest-risk way to add this without threading new props/handle
          methods through index.tsx). Only shown while an actual paint
          tool is active — no point cluttering the viewport otherwise. */}
      {paintingActive && (
        <div className="absolute top-3 left-3 z-20 w-40 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 overflow-hidden pointer-events-auto">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Layers</span>
            <button
              onClick={addPaintLayer}
              disabled={paintLayers.length >= MAX_PAINT_LAYERS}
              className="text-cyan-300 disabled:opacity-30 text-sm leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
              title="New layer"
            >
              +
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {[...paintLayers].reverse().map((l) => (
              <div
                key={l.id}
                onClick={() => setActiveLayerId(l.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] cursor-pointer ${
                  l.id === activeLayerId ? "bg-cyan-500/20 text-cyan-100" : "text-white/50 hover:bg-white/5"
                }`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLayerVisible(l.id); }}
                  className="w-4 shrink-0 text-center"
                  title={l.visible ? "Hide" : "Show"}
                >
                  {l.visible ? "◉" : "○"}
                </button>
                <span className="flex-1 truncate">{l.label}</span>
                {paintLayers.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }}
                    className="w-4 shrink-0 text-center text-red-300/70 hover:text-red-300"
                    title="Delete layer"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purely cosmetic paint-splatter flourish (screen-space overlay,
          NOT drawn onto the actual garment texture) — a few little dots of
          the current brush color pop and fade near the brush tip while
          painting, like a real paint pen. Adds nothing to compose(), so
          it can never affect the saved design or the fingerprint. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {splatters.map((s) => (
            <motion.span
              key={s.id}
              initial={{ opacity: 0.9, scale: 0, x: s.x, y: s.y }}
              animate={{ opacity: 0, scale: 1, x: s.x + s.dx, y: s.y + s.dy }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              onAnimationComplete={() => setSplatters((cur) => cur.filter((c) => c.id !== s.id))}
              style={{ position: "absolute", width: s.size, height: s.size, borderRadius: "50%", background: s.color, left: 0, top: 0 }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});
