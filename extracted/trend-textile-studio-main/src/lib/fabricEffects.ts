/**
 * Garment "parts & fabric effects" library — real inline SVG assets (no
 * external files, so nothing can 404). Rebuilt after feedback that the
 * first pass ("خرابيش" — scribbles) didn't look like real garment parts:
 * these now draw actual recognizable shapes (a proper patch pocket with
 * stitching, a hoodie hood, a long-sleeve cuff), and the animal-shaped
 * mesh effects are real silhouettes (cat, butterfly) built from a grid of
 * tiny holes clipped to the animal's outline — not a generic checkerboard.
 *
 * Placement: each of these goes through the EXACT SAME front/back decal
 * system as uploaded artwork (see DecalControls in Studio3D) — pick one,
 * then drag/resize/rotate it exactly like any other artwork. That's what
 * "full control over where you place it" means in practice.
 *
 * Honesty note on "mesh reveals what's underneath": there's no body/skin
 * mesh under the garment in this project — just the garment itself. So
 * these mesh effects have real transparent cutouts in the animal's
 * silhouette, and whatever is on the garment layer underneath (base
 * fabric color, paint, other artwork) shows through those cutouts — a
 * genuine see-through effect, just not "see-through to a body," since
 * there isn't one here to see.
 */

export type FabricEffectId = "pocket" | "hood" | "cuff" | "ripped" | "cat-mesh" | "butterfly-mesh" | "chain";

export interface FabricEffect {
  id: FabricEffectId;
  en: string;
  ar: string;
  dataUrl: string;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// A real patch pocket: rounded rectangle, a top-stitch line, and a
// diagonal corner reinforcement stitch — the way an actual sewn-on pocket
// is drawn in a flat-sketch / tech-pack.
const POCKET = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180">
  <path d="M14 16 h172 v100 q0 40 -40 46 h-92 q-40 -6 -40 -46 Z" fill="#e8e8ec" stroke="#111" stroke-width="4"/>
  <line x1="14" y1="16" x2="186" y2="16" stroke="#111" stroke-width="4"/>
  <path d="M20 24 h160 v92 q0 32 -34 38 h-92 q-34 -6 -34 -38 Z" fill="none" stroke="#111" stroke-width="2" stroke-dasharray="5 4" opacity="0.55"/>
  <line x1="14" y1="16" x2="34" y2="36" stroke="#111" stroke-width="2.5" opacity="0.6"/>
  <line x1="186" y1="16" x2="166" y2="36" stroke="#111" stroke-width="2.5" opacity="0.6"/>
</svg>`.trim());

// Hoodie hood, flat-sketch style: outer hood shape, drawstring loop holes,
// and the seam line down the back — recognizable at a glance.
const HOOD = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200">
  <path d="M40 190 C10 140 15 60 60 30 C85 12 135 12 160 30 C205 60 210 140 180 190 C160 150 150 120 110 120 C70 120 60 150 40 190 Z"
    fill="#e8e8ec" stroke="#111" stroke-width="4" stroke-linejoin="round"/>
  <path d="M110 20 V115" stroke="#111" stroke-width="2" stroke-dasharray="5 4" opacity="0.5"/>
  <circle cx="82" cy="118" r="5" fill="none" stroke="#111" stroke-width="3"/>
  <circle cx="138" cy="118" r="5" fill="none" stroke="#111" stroke-width="3"/>
  <path d="M82 123 q28 22 56 0" fill="none" stroke="#111" stroke-width="3"/>
</svg>`.trim());

// Long-sleeve cuff band with rib-knit texture lines.
const CUFF = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 100">
  <rect x="10" y="15" width="200" height="70" rx="12" fill="#e8e8ec" stroke="#111" stroke-width="4"/>
  ${Array.from({ length: 12 }).map((_, i) => `<line x1="${24 + i * 16}" y1="22" x2="${24 + i * 16}" y2="78" stroke="#111" stroke-width="1.5" opacity="0.4"/>`).join("")}
  <line x1="10" y1="15" x2="210" y2="15" stroke="#111" stroke-width="4"/>
  <line x1="10" y1="85" x2="210" y2="85" stroke="#111" stroke-width="4"/>
</svg>`.trim());

// Professional ripped/torn patch: layered jagged edges with frayed thread
// lines, reads as an actual distressed-denim tear, not a scratch scribble.
const RIPPED = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160">
  <path d="M10 40 L55 55 L40 90 L85 78 L75 130 L130 110 L120 150 L200 120"
    fill="none" stroke="#111" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M20 46 L52 58 L42 86 L80 76 L72 122 L124 105 L116 140"
    fill="#0a0a0a" opacity="0.88"/>
  ${Array.from({ length: 6 }).map((_, i) =>
    `<line x1="${30 + i * 28}" y1="${50 + (i % 2) * 30}" x2="${22 + i * 28}" y2="${70 + (i % 2) * 30}" stroke="#111" stroke-width="1.5" opacity="0.5"/>`
  ).join("")}
</svg>`.trim());

// Real silhouette-clipped mesh — the fill pattern of small holes is
// clipped to an actual animal outline via <clipPath>, not just tiled
// across a box, so it genuinely reads as "a cat/butterfly made of net."
function animalMesh(clipPath: string, viewBox: string): string {
  const holes = Array.from({ length: 500 }).map(() => {
    const x = Math.random() * 200, y = Math.random() * 220, r = 2.2 + Math.random() * 1.6;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="black"/>`;
  }).join("");
  return svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <defs>
    <clipPath id="shape"><path d="${clipPath}"/></clipPath>
    <mask id="punched">
      <rect width="100%" height="100%" fill="white"/>
      ${holes}
    </mask>
  </defs>
  <g clip-path="url(#shape)">
    <rect width="100%" height="100%" fill="#111" mask="url(#punched)"/>
  </g>
  <path d="${clipPath}" fill="none" stroke="#111" stroke-width="3"/>
</svg>`.trim());
}

const CAT_PATH = "M100 30 L70 5 L75 40 Q40 45 30 90 Q25 150 60 185 Q100 210 140 185 Q175 150 170 90 Q160 45 125 40 L125 5 Z";
const CAT_MESH = animalMesh(CAT_PATH, "0 0 200 220");

const BUTTERFLY_PATH =
  "M100 100 C60 20 10 20 10 70 C10 110 60 110 100 100 C140 110 190 110 190 70 C190 20 140 20 100 100 " +
  "C60 180 10 180 10 130 C10 90 60 90 100 100 C140 90 190 90 190 130 C190 180 140 180 100 100 Z";
const BUTTERFLY_MESH = animalMesh(BUTTERFLY_PATH, "0 0 200 200");

const CHAIN = svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70">
  ${Array.from({ length: 8 }).map((_, i) =>
    `<ellipse cx="${20 + i * 30}" cy="35" rx="13" ry="9" fill="none" stroke="#c8c8c8" stroke-width="5" transform="rotate(${i % 2 ? 90 : 0} ${20 + i * 30} 35)"/>`
  ).join("")}
</svg>`.trim());

export const FABRIC_EFFECTS: FabricEffect[] = [
  { id: "pocket", en: "Patch pocket", ar: "جيب", dataUrl: POCKET },
  { id: "hood", en: "Hoodie hood", ar: "قبعة هودي", dataUrl: HOOD },
  { id: "cuff", en: "Long-sleeve cuff", ar: "كم طويل", dataUrl: CUFF },
  { id: "ripped", en: "Ripped / torn patch", ar: "تمزيق احترافي", dataUrl: RIPPED },
  { id: "cat-mesh", en: "Cat-shaped mesh (see-through)", ar: "شبكة شكل قطة (شفافة)", dataUrl: CAT_MESH },
  { id: "butterfly-mesh", en: "Butterfly-shaped mesh (see-through)", ar: "شبكة شكل فراشة (شفافة)", dataUrl: BUTTERFLY_MESH },
  { id: "chain", en: "Chain accessory", ar: "سلسلة", dataUrl: CHAIN },
];
