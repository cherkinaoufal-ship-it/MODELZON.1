/**
 * Full garment-parts library (M1M4-style picker): hoods, collars, pockets,
 * sleeves/cuffs and closures. Every part is an inline SVG data URL so it can
 * be dropped onto the design through the exact same decal system as uploaded
 * artwork (drag / resize / rotate).
 */

export type GarmentPartCategory = "hood" | "collar" | "pocket" | "sleeve" | "closure";

export interface GarmentPart {
  id: string;
  en: string;
  ar: string;
  category: GarmentPartCategory;
  dataUrl: string;
}

export const PART_CATEGORIES: { id: GarmentPartCategory; en: string; ar: string }[] = [
  { id: "hood", en: "Hood", ar: "هود" },
  { id: "collar", en: "Collar", ar: "ياقة" },
  { id: "pocket", en: "Pocket", ar: "جيب" },
  { id: "sleeve", en: "Sleeve / cuff", ar: "كم / أسورة" },
  { id: "closure", en: "Closure", ar: "إغلاق" },
];

const S = (body: string, w = 220, h = 200) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><g fill="#ecedf1" stroke="#101014" stroke-width="4" stroke-linejoin="round">${body}</g></svg>`,
  )}`;

const dash = 'fill="none" stroke="#101014" stroke-width="2" stroke-dasharray="6 5" opacity="0.5"';

export const GARMENT_PARTS: GarmentPart[] = [
  // ---- Hoods
  {
    id: "hood-classic", en: "Classic hood", ar: "هود كلاسيكي", category: "hood",
    dataUrl: S(`<path d="M40 190 C10 140 15 60 60 30 C85 12 135 12 160 30 C205 60 210 140 180 190 C160 150 150 120 110 120 C70 120 60 150 40 190 Z"/>
      <path d="M110 22 V116" ${dash}/><circle cx="84" cy="118" r="5" fill="none"/><circle cx="136" cy="118" r="5" fill="none"/>`),
  },
  {
    id: "hood-double", en: "Double-layer hood", ar: "هود بطبقتين", category: "hood",
    dataUrl: S(`<path d="M38 190 C8 138 16 58 60 28 C88 10 132 10 160 28 C204 58 212 138 182 190 C160 148 148 118 110 118 C72 118 60 148 38 190 Z"/>
      <path d="M56 174 C34 132 40 70 74 46 C94 32 126 32 146 46 C180 70 186 132 164 174" ${dash}/>`),
  },
  {
    id: "hood-oversized", en: "Oversized hood", ar: "هود واسع", category: "hood",
    dataUrl: S(`<path d="M26 194 C-2 130 12 46 66 20 C92 6 128 6 154 20 C208 46 222 130 194 194 C168 146 152 112 110 112 C68 112 52 146 26 194 Z"/>
      <path d="M110 14 V110" ${dash}/>`),
  },
  {
    id: "hood-drawstring", en: "Drawstring hood", ar: "هود بحبل", category: "hood",
    dataUrl: S(`<path d="M40 188 C12 138 18 60 62 30 C88 12 132 12 158 30 C202 60 208 138 180 188 C158 148 148 118 110 118 C72 118 62 148 40 188 Z"/>
      <circle cx="82" cy="120" r="6" fill="none"/><circle cx="138" cy="120" r="6" fill="none"/>
      <path d="M82 126 C92 168 100 176 96 194" fill="none"/><path d="M138 126 C128 168 120 176 124 194" fill="none"/>`),
  },

  // ---- Collars
  {
    id: "collar-crew", en: "Crew neck", ar: "ياقة دائرية", category: "collar",
    dataUrl: S(`<path d="M20 60 C60 8 160 8 200 60 C160 106 60 106 20 60 Z"/><path d="M36 60 C70 24 150 24 184 60" ${dash}/>`, 220, 120),
  },
  {
    id: "collar-vneck", en: "V neck", ar: "ياقة V", category: "collar",
    dataUrl: S(`<path d="M20 30 L110 112 L200 30 L176 18 L110 78 L44 18 Z"/>`, 220, 130),
  },
  {
    id: "collar-polo", en: "Polo collar", ar: "ياقة بولو", category: "collar",
    dataUrl: S(`<path d="M24 26 L110 92 L196 26 L172 8 L110 58 L48 8 Z"/><path d="M96 92 h28 v56 h-28 z"/>
      <path d="M110 92 V148" ${dash}/>`, 220, 160),
  },
  {
    id: "collar-mock", en: "Mock / turtle neck", ar: "ياقة عالية", category: "collar",
    dataUrl: S(`<path d="M24 100 C24 40 196 40 196 100 C196 130 24 130 24 100 Z"/>
      <path d="M24 74 C60 96 160 96 196 74" ${dash}/>`, 220, 150),
  },

  // ---- Pockets
  {
    id: "pocket-patch", en: "Patch pocket", ar: "جيب مربع", category: "pocket",
    dataUrl: S(`<path d="M18 18 h164 v104 q0 38 -38 44 h-88 q-38 -6 -38 -44 Z"/><path d="M24 26 h152 v98 q0 30 -32 36 h-88 q-32 -6 -32 -36 Z" ${dash}/>`, 200, 180),
  },
  {
    id: "pocket-kangaroo", en: "Kangaroo pocket", ar: "جيب كنغر", category: "pocket",
    dataUrl: S(`<path d="M10 40 C70 20 150 20 210 40 L196 150 C140 168 80 168 24 150 Z"/>
      <path d="M10 40 C70 20 150 20 210 40" ${dash}/><path d="M60 44 V150" ${dash}/><path d="M160 44 V150" ${dash}/>`, 220, 180),
  },
  {
    id: "pocket-cargo", en: "Cargo pocket", ar: "جيب كارجو", category: "pocket",
    dataUrl: S(`<path d="M20 40 h160 v120 h-160 z"/><path d="M14 20 h172 v28 h-172 z"/>
      <path d="M28 56 h144 v96 h-144 z" ${dash}/><circle cx="100" cy="34" r="6" fill="none"/>`, 200, 180),
  },
  {
    id: "pocket-zip", en: "Zip pocket", ar: "جيب سحّاب", category: "pocket",
    dataUrl: S(`<path d="M18 60 h164 v22 h-164 z"/>
      <g stroke-width="3">${Array.from({ length: 20 }).map((_, i) => `<line x1="${24 + i * 8}" y1="${i % 2 ? 82 : 60}" x2="${24 + i * 8}" y2="${i % 2 ? 72 : 70}"/>`).join("")}</g>
      <path d="M18 92 h164 v66 q0 12 -12 12 h-140 q-12 0 -12 -12 z" ${dash}/>`, 200, 180),
  },

  // ---- Sleeves / cuffs
  {
    id: "sleeve-long", en: "Long sleeve", ar: "كم طويل", category: "sleeve",
    dataUrl: S(`<path d="M40 10 C90 0 130 0 180 10 L196 170 C160 186 110 186 60 170 Z"/>
      <path d="M56 150 C104 166 140 166 182 150" ${dash}/>`, 220, 200),
  },
  {
    id: "cuff-ribbed", en: "Ribbed cuff", ar: "أسورة ريب", category: "sleeve",
    dataUrl: S(`<path d="M20 30 h180 v90 q-90 26 -180 0 z"/>
      <g stroke-width="2" opacity="0.55">${Array.from({ length: 17 }).map((_, i) => `<line x1="${28 + i * 10}" y1="32" x2="${28 + i * 10}" y2="${118 - Math.abs(8 - i) * 0.6}"/>`).join("")}</g>`, 220, 150),
  },

  // ---- Closures
  {
    id: "closure-zipper", en: "Full zipper", ar: "سحّاب كامل", category: "closure",
    dataUrl: S(`<line x1="100" y1="10" x2="100" y2="190" stroke-width="5"/>
      <g stroke-width="3">${Array.from({ length: 22 }).map((_, i) => `<rect x="${i % 2 ? 102 : 86}" y="${12 + i * 8}" width="12" height="5"/>`).join("")}</g>
      <path d="M88 174 h24 v18 h-24 z"/>`, 200, 200),
  },
  {
    id: "closure-buttons", en: "Button placket", ar: "أزرار", category: "closure",
    dataUrl: S(`<path d="M70 10 h60 v180 h-60 z"/><path d="M78 10 V190" ${dash}/><path d="M122 10 V190" ${dash}/>
      ${[30, 76, 122, 168].map((y) => `<circle cx="100" cy="${y}" r="9" fill="none"/>`).join("")}`, 200, 200),
  },
];
