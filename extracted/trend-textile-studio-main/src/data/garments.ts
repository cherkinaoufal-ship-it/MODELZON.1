export type GarmentCategory = "tee" | "hoodie" | "sweater" | "pants" | "shorts" | "skirt" | "cap";
export type Gender = "unisex" | "men" | "women";

export interface GarmentItem {
  id: string;
  ar: string;
  en: string;
  category: GarmentCategory;
  gender: Gender;
  /** Path to the .glb file in /public/models — served as a static asset */
  path: string;
  /** Base fabric color sampled from the model's own material (prints were stripped) */
  color: string;
  sizeMB: number;
}

/**
 * All prints/logos baked into the original downloaded models were stripped
 * (see public/models — each .glb's baseColorTexture was removed and replaced
 * with a flat fabric color). These are blank garments: the person draws or
 * uploads their own design on top in the Studio.
 */
export const GARMENTS: GarmentItem[] = [
  { id: "tee-oversized", ar: "تيشيرت أوفرسايز", en: "Oversized Tee", category: "tee", gender: "unisex", path: "/__l5e/assets-v1/756eccf7-bab9-4f84-9a82-23c8f2596e2b/tee-oversized-unisex.glb", color: "#848484", sizeMB: 17.3 },
  { id: "tee-women", ar: "تيشيرت نسائي", en: "Women's Tee", category: "tee", gender: "women", path: "/models/tee-women.glb", color: "#868686", sizeMB: 0.3 },
  { id: "hoodie-knitted", ar: "هودي محبوك بقبعة قصيرة", en: "Knitted Short Hoodie", category: "hoodie", gender: "unisex", path: "/models/hoodie-knitted-unisex.glb", color: "#ccc1b6", sizeMB: 6.0 },
  { id: "hoodie-pink", ar: "هودي وردي بأربطة", en: "Pink Drawstring Hoodie", category: "hoodie", gender: "women", path: "/models/hoodie-pink-women.glb", color: "#c7a9b7", sizeMB: 4.8 },
  { id: "hoodie-casual", ar: "هودي كاجوال", en: "Casual Hoodie", category: "hoodie", gender: "unisex", path: "/__l5e/assets-v1/b4b21cda-33af-4498-bcbb-db47a9b41e75/hoodie-casual-unisex-3.glb", color: "#cccdc4", sizeMB: 5.8 },
  { id: "hoodie-casual-3", ar: "هودي كاجوال (جديد)", en: "Casual Hoodie (New)", category: "hoodie", gender: "unisex", path: "/__l5e/assets-v1/b4b21cda-33af-4498-bcbb-db47a9b41e75/hoodie-casual-unisex-3.glb", color: "#cccdc4", sizeMB: 5.8 },
  { id: "hoodie-workwear-set", ar: "طقم هودي وجاكيت عمل", en: "Workwear Jacket Set", category: "hoodie", gender: "unisex", path: "/__l5e/assets-v1/21a4eb10-dae1-4891-93ad-2e8a388ec5a9/hoodie-workwear-set-unisex.glb", color: "#6c6861", sizeMB: 14.2 },
  { id: "sweater-long-girls", ar: "سويتر طويل بناتي", en: "Girls Long Sweater", category: "sweater", gender: "women", path: "/models/sweater-long-girls.glb", color: "#e3dacd", sizeMB: 1.6 },
  { id: "sweater-women", ar: "سويتر نسائي", en: "Women's Sweater", category: "sweater", gender: "women", path: "/models/sweater-women.glb", color: "#673e74", sizeMB: 4.1 },
  { id: "set-blouse-skirt", ar: "طقم بلوزة وتنورة", en: "Blouse & Skirt Set", category: "skirt", gender: "women", path: "/models/set-blouse-skirt-women.glb", color: "#4d4d4d", sizeMB: 4.1 },
  { id: "pants-classic", ar: "بنطلون كلاسيك", en: "Classic Pants", category: "pants", gender: "unisex", path: "/models/pants-classic-unisex.glb", color: "#b4b4b7", sizeMB: 3.7 },
  { id: "set-shorts-sport", ar: "طقم شورت رياضي كاكي", en: "Khaki Sport Shorts Set", category: "shorts", gender: "unisex", path: "/__l5e/assets-v1/3a7c3631-c1b3-4007-8366-607f3864b429/set-shorts-sport-unisex.glb", color: "#6e645b", sizeMB: 10.7 },
  { id: "shorts-men", ar: "شورت رجالي", en: "Men's Shorts", category: "shorts", gender: "men", path: "/models/shorts-men.glb", color: "#b0574a", sizeMB: 2.4 },
  { id: "shorts-men-community", ar: "شورت رجالي (تجريبي)", en: "Men's Shorts (Test Upload)", category: "shorts", gender: "men", path: "/models/shorts-men-1.glb", color: "#8a8a8a", sizeMB: 2.3 },
  { id: "pants-girls", ar: "بنطلون بناتي", en: "Girls Pants", category: "pants", gender: "women", path: "/models/pants-girls.glb", color: "#88636c", sizeMB: 0.4 },
  { id: "cap-newera", ar: "كاب نيو ايرا", en: "New Era Cap", category: "cap", gender: "unisex", path: "/models/cap-newera-unisex.glb", color: "#1c1b1c", sizeMB: 0.03 },
  { id: "cap-tennis", ar: "كاب تنس أبيض", en: "White Tennis Cap", category: "cap", gender: "unisex", path: "/models/cap-tennis-unisex.glb", color: "#d2d2d2", sizeMB: 2.4 },
  { id: "cap-baseball", ar: "كاب بيسبول", en: "Baseball Cap", category: "cap", gender: "unisex", path: "/models/cap-baseball-unisex.glb", color: "#d8d8d8", sizeMB: 3.0 },
];

export const CATEGORY_META: Record<GarmentCategory, { ar: string; en: string; emoji: string }> = {
  tee: { ar: "تيشيرت", en: "Tee", emoji: "👕" },
  hoodie: { ar: "هودي", en: "Hoodie", emoji: "🧥" },
  sweater: { ar: "سويتر", en: "Sweater", emoji: "🧶" },
  pants: { ar: "بنطلون", en: "Pants", emoji: "👖" },
  shorts: { ar: "شورت", en: "Shorts", emoji: "🩳" },
  skirt: { ar: "تنورة", en: "Skirt", emoji: "👗" },
  cap: { ar: "كاب", en: "Cap", emoji: "🧢" },
};

export const SIZES = ["S", "M", "L", "XL"] as const;
export type SizeId = (typeof SIZES)[number];
export const SIZE_SCALE: Record<SizeId, number> = { S: 0.93, M: 1.0, L: 1.07, XL: 1.15 };
