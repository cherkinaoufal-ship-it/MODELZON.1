/**
 * Decoration presets (per paint layer) + fabric presets (per garment) —
 * exact spec requested: 12 print/ink types + 6 embroidery/applied types,
 * and 10 base fabric types.
 *
 * Honest scope note: these are real, visually distinguishable treatments
 * (canvas 2D `filter` composition for decoration types; actual Three.js
 * PBR material parameters — roughness/metalness/bump — for fabric types),
 * not full physically-based rendering with authored normal-map textures
 * per material (that would need real scanned/authored texture assets this
 * sandbox doesn't have). "Glow in the dark" doesn't literally glow without
 * a room light source to react to — it gets a bright saturated look plus
 * a soft outer glow instead, which reads as the intent without faking a
 * lighting simulation that isn't really there.
 */

export type DecorationTypeId =
  | "screen" | "rubber" | "embossed" | "silicon" | "high-density" | "puff"
  | "stamp" | "bleach" | "foil" | "glow" | "sun" | "laser"
  | "tonal-embroidery" | "chenille" | "flat-embroidery" | "puff-embroidery" | "applique" | "patch";

export interface DecorationPreset {
  id: DecorationTypeId;
  en: string;
  ar: string;
  category: "print" | "embroidery";
  /** Canvas 2D `ctx.filter` string applied when this layer is composited. */
  filter: string;
  /** Stitched/bordered outline drawn around the layer's opaque content —
   *  what makes patch/applique/embroidery read as "attached", not printed. */
  stitchedBorder?: boolean;
  description: string;
  descriptionAr: string;
}

export const DECORATION_TYPES: DecorationPreset[] = [
  { id: "screen", en: "Screen print", ar: "طباعة سلك (شاشة)", category: "print", filter: "none",
    description: "Flat, matte, the default — no extra treatment.", descriptionAr: "طباعة مسطحة عادية، بدون أي تأثير إضافي." },
  { id: "rubber", en: "Rubber", ar: "مطاطي", category: "print", filter: "contrast(1.08) saturate(1.05) drop-shadow(0 1px 0 rgba(0,0,0,0.35))",
    description: "Slightly raised, glossy rubber-like finish.", descriptionAr: "لمسة مطاطية لمّاعة بارتفاع بسيط." },
  { id: "embossed", en: "Embossed", ar: "بارز (نقش)", category: "print", filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.5)) drop-shadow(0 -1px 0 rgba(255,255,255,0.25))",
    description: "Pressed-in relief, light/shadow on opposite edges.", descriptionAr: "نقش غاطس بظل وضوء على الحواف المتقابلة." },
  { id: "silicon", en: "Silicon", ar: "سيليكون", category: "print", filter: "saturate(1.15) drop-shadow(0 2px 2px rgba(0,0,0,0.45))",
    description: "Soft, thick, glossy 3D silicone patch look.", descriptionAr: "قطعة سيليكون سميكة ولامعة وبارزة." },
  { id: "high-density", en: "High Density", ar: "كثافة عالية", category: "print", filter: "contrast(1.15) drop-shadow(0 2px 1.5px rgba(0,0,0,0.5))",
    description: "Sharp, tall, crisp-edged raised ink.", descriptionAr: "حبر بارز بحواف حادة وواضحة." },
  { id: "puff", en: "Puff", ar: "منفوخ (Puff)", category: "print", filter: "blur(0.4px) contrast(1.05) drop-shadow(0 3px 2px rgba(0,0,0,0.5))",
    description: "Foamy, rounded, expanded-ink look.", descriptionAr: "حبر منفوخ ناعم الحواف." },
  { id: "stamp", en: "Stamp", ar: "ختم", category: "print", filter: "contrast(1.2) saturate(0.85) opacity(0.9)",
    description: "Slightly worn/uneven, ink-stamp texture.", descriptionAr: "أثر ختم بحبر غير منتظم قليلاً." },
  { id: "bleach", en: "Bleach", ar: "تبييض (بليتش)", category: "print", filter: "saturate(0.35) brightness(1.25) contrast(0.9)",
    description: "Faded-out, discolored-fabric effect.", descriptionAr: "تأثير تفتيح لون القماش تحت الرسمة." },
  { id: "foil", en: "Foil", ar: "فويل معدني", category: "print", filter: "saturate(1.6) brightness(1.25) contrast(1.1) hue-rotate(-4deg)",
    description: "Reflective metallic foil sheen.", descriptionAr: "لمعان معدني عاكس." },
  { id: "glow", en: "Glow In Dark", ar: "متوهج بالظلام", category: "print", filter: "saturate(1.5) brightness(1.3) drop-shadow(0 0 6px currentColor)",
    description: "Bright + soft outer glow.", descriptionAr: "لون مشبع مع توهج خفيف حول الحواف." },
  { id: "sun", en: "Sun-reactive", ar: "متفاعل مع الشمس", category: "print", filter: "saturate(1.4) contrast(1.1) hue-rotate(6deg)",
    description: "Vivid color-shifting UV-reactive ink look.", descriptionAr: "لون زاهي يوحي بتفاعل مع الأشعة." },
  { id: "laser", en: "Laser etch", ar: "حفر ليزر", category: "print", filter: "grayscale(0.4) contrast(1.3) brightness(0.9)",
    description: "Burned/etched, slightly desaturated edge.", descriptionAr: "أثر حرق/حفر خفيف بتشبع أقل." },

  { id: "tonal-embroidery", en: "Tonal Embroidery", ar: "تطريز أحادي التدرج", category: "embroidery", filter: "saturate(0.9) contrast(1.05) drop-shadow(0 1px 1px rgba(0,0,0,0.4))", stitchedBorder: true,
    description: "Same-tone thread, subtle raised texture.", descriptionAr: "خيوط بنفس درجة اللون مع ملمس بارز خفيف." },
  { id: "chenille", en: "Chenille", ar: "شينيل", category: "embroidery", filter: "saturate(1.1) blur(0.6px) drop-shadow(0 3px 2px rgba(0,0,0,0.5))", stitchedBorder: true,
    description: "Thick, fuzzy, plush chenille thread.", descriptionAr: "خيوط سميكة وناعمة الملمس بارزة." },
  { id: "flat-embroidery", en: "Flat Embroidery", ar: "تطريز مسطح", category: "embroidery", filter: "contrast(1.08) drop-shadow(0 1px 0.5px rgba(0,0,0,0.4))", stitchedBorder: true,
    description: "Classic stitched thread, low profile.", descriptionAr: "تطريز خيوط كلاسيكي منخفض الارتفاع." },
  { id: "puff-embroidery", en: "3D Puff Embroidery", ar: "تطريز منفوخ ثلاثي الأبعاد", category: "embroidery", filter: "contrast(1.1) drop-shadow(0 4px 3px rgba(0,0,0,0.55))", stitchedBorder: true,
    description: "Foam-backed, tall, rounded embroidery.", descriptionAr: "تطريز بارز جداً بحشوة إسفنجية تحته." },
  { id: "applique", en: "Appliqué", ar: "تطعيم قماش (أبليكيه)", category: "embroidery", filter: "saturate(1.05) drop-shadow(0 2px 2px rgba(0,0,0,0.5))", stitchedBorder: true,
    description: "A separate fabric piece stitched on top.", descriptionAr: "قطعة قماش منفصلة مخيّطة فوق الملابس." },
  { id: "patch", en: "Patch", ar: "باتش", category: "embroidery", filter: "contrast(1.1) saturate(1.05) drop-shadow(0 3px 3px rgba(0,0,0,0.55))", stitchedBorder: true,
    description: "A bordered, pre-made patch with visible edge stitching.", descriptionAr: "باتش جاهز بحدود وخياطة ظاهرة حول الإطار." },
];

export type FabricTypeId = "cotton" | "fleece" | "denim" | "french-terry" | "ribbed" | "leather" | "corduroy" | "mesh" | "wool" | "satin";

export interface FabricPreset {
  id: FabricTypeId;
  en: string;
  ar: string;
  roughness: number;   // 0 = mirror-smooth, 1 = fully matte
  metalness: number;   // real PBR metalness — kept low/zero for fabrics except subtle satin sheen
  bumpScale: number;   // surface texture depth
}

export const FABRIC_TYPES: FabricPreset[] = [
  { id: "cotton", en: "Cotton", ar: "قطن", roughness: 0.88, metalness: 0, bumpScale: 0.012 },
  { id: "fleece", en: "Fleece", ar: "فليس", roughness: 0.95, metalness: 0, bumpScale: 0.028 },
  { id: "denim", en: "Denim", ar: "جينز", roughness: 0.82, metalness: 0, bumpScale: 0.032 },
  { id: "french-terry", en: "French Terry", ar: "فرنش تيري", roughness: 0.9, metalness: 0, bumpScale: 0.022 },
  { id: "ribbed", en: "Ribbed", ar: "ريب (مضلّع)", roughness: 0.85, metalness: 0, bumpScale: 0.036 },
  { id: "leather", en: "Leather", ar: "جلد", roughness: 0.35, metalness: 0.08, bumpScale: 0.01 },
  { id: "corduroy", en: "Corduroy", ar: "قطيفة مخططة", roughness: 0.8, metalness: 0, bumpScale: 0.04 },
  { id: "mesh", en: "Mesh (fabric weave)", ar: "شبك (نسيج)", roughness: 0.75, metalness: 0, bumpScale: 0.03 },
  { id: "wool", en: "Wool", ar: "صوف", roughness: 0.97, metalness: 0, bumpScale: 0.02 },
  { id: "satin", en: "Satin / Silk", ar: "ساتان / حرير", roughness: 0.18, metalness: 0.05, bumpScale: 0.004 },
];
