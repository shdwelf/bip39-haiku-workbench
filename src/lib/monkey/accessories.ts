// Catalog of MonKey accessories with rarity data
// Source: https://github.com/appditto/MonKey weights and
// https://gist.github.com/Vyryn/0e1f7003773faf015308f9b4aeb7d11d
//
// Each entry's `match` is a substring used to detect this accessory inside
// an accessory svg filename returned by the MonKey API (dtl endpoint).
//
// `weight` is the per-category sampling weight from the appditto repo.
// `categoryOdds` is the chance that the category itself is present on a monkey.
// `categoryTotal` is the sum of weights across all items in that category.
// True overall probability = (weight / categoryTotal) * categoryOdds

export type Category =
  | "glasses"
  | "hat"
  | "misc"
  | "mouth"
  | "shirt_and_pants"
  | "shoes"
  | "tail";

export interface AccessoryDef {
  id: string; // slug — used for filter set
  name: string; // pretty display name
  category: Category;
  match: string; // substring used to identify in filename
  weight: number;
  emoji: string;
}

export const CATEGORY_ODDS: Record<Category, number> = {
  glasses: 0.25,
  hat: 0.35,
  misc: 0.3,
  mouth: 1,
  shirt_and_pants: 0.25,
  shoes: 0.22,
  tail: 0.2,
};

export const CATEGORY_TOTAL: Record<Category, number> = {
  glasses: 8,
  hat: 19.4,
  misc: 11.29,
  mouth: 5.56,
  shirt_and_pants: 6,
  shoes: 6,
  tail: 1,
};

export function probability(a: AccessoryDef): number {
  return (a.weight / CATEGORY_TOTAL[a.category]) * CATEGORY_ODDS[a.category];
}

export function oneInN(a: AccessoryDef): number {
  const p = probability(a);
  return p > 0 ? Math.round(1 / p) : Infinity;
}

// Complete catalog: all 68 accessories, cross-checked against the filenames and
// [w-N] weights in appditto/MonKey's server/assets/illustrations/accessories.
// Per-category weights therefore sum exactly to CATEGORY_TOTAL.
export const ACCESSORIES: AccessoryDef[] = [
  // 🔥 MISC — the legendary flamethrower lives here
  { id: "flamethrower", name: "Flamethrower", category: "misc", match: "flamethrower", weight: 0.04, emoji: "🔥" },
  { id: "whisky", name: "Whiskey Bottle", category: "misc", match: "whisky", weight: 0.5, emoji: "🥃" },
  { id: "boss-necklace", name: "Boss Necklace", category: "misc", match: "necklace-boss", weight: 0.75, emoji: "💎" },
  { id: "camera", name: "Camera", category: "misc", match: "camera", weight: 1, emoji: "📷" },
  { id: "club", name: "Club", category: "misc", match: "club", weight: 1, emoji: "🏏" },
  { id: "guitar", name: "Guitar", category: "misc", match: "guitar", weight: 1, emoji: "🎸" },
  { id: "microphone", name: "Microphone", category: "misc", match: "microphone", weight: 1, emoji: "🎤" },
  { id: "banana-hands", name: "Two Bananas", category: "misc", match: "banana-hands", weight: 1, emoji: "🍌" },
  { id: "banana-right", name: "One Banana", category: "misc", match: "banana-right-hand", weight: 1, emoji: "🍌" },
  { id: "bowtie", name: "Bowtie", category: "misc", match: "bowtie", weight: 1, emoji: "🎀" },
  { id: "gloves-white", name: "White Gloves", category: "misc", match: "gloves-white", weight: 1, emoji: "🧤" },
  { id: "tie-cyan", name: "Cyan Tie", category: "misc", match: "tie-cyan", weight: 1, emoji: "👔" },
  { id: "tie-pink", name: "Pink Tie", category: "misc", match: "tie-pink", weight: 1, emoji: "👔" },

  // 🎩 HATS — jester is the rarest
  { id: "jester", name: "Jester Hat", category: "hat", match: "hat-jester", weight: 0.125, emoji: "🤡" },
  { id: "hippie-beanie", name: "Hippie Beanie", category: "hat", match: "beanie-hippie", weight: 0.125, emoji: "✌️" },
  { id: "very-hng-cap", name: "Very Hng Cap", category: "hat", match: "cap-hng-plus", weight: 0.125, emoji: "👑" },
  { id: "crown", name: "Crown", category: "hat", match: "crown", weight: 0.225, emoji: "👑" },
  { id: "cap-pepe", name: "Pepe Cap", category: "hat", match: "cap-pepe", weight: 0.8, emoji: "🐸" },
  { id: "cap-rick", name: "Rick Cap", category: "hat", match: "cap-rick", weight: 0.8, emoji: "🥒" },
  { id: "cap-thonk", name: "Thonk Cap", category: "hat", match: "cap-thonk", weight: 0.8, emoji: "🤔" },
  { id: "cap-smug", name: "Smug Cap", category: "hat", match: "cap-smug-[", weight: 0.8, emoji: "😏" },
  { id: "cap-smug-green", name: "Green Smug Cap", category: "hat", match: "cap-smug-green", weight: 0.8, emoji: "😏" },
  { id: "cap-bebe", name: "Bebe Cap", category: "hat", match: "cap-bebe", weight: 0.8, emoji: "🧢" },
  { id: "cap-carlos", name: "Carlos Cap", category: "hat", match: "cap-carlos", weight: 0.8, emoji: "🧢" },
  { id: "cap-kappa", name: "Kappa Cap", category: "hat", match: "cap-kappa", weight: 0.8, emoji: "🧢" },
  { id: "cap-hng", name: "Hng Cap", category: "hat", match: "cap-hng-[", weight: 0.8, emoji: "🧢" },
  { id: "cap-banano", name: "Banano Cap", category: "hat", match: "cap-banano", weight: 0.8, emoji: "🧢" },
  { id: "cap", name: "Cap", category: "hat", match: "cap-[", weight: 0.8, emoji: "🧢" },
  { id: "viking", name: "Viking Helmet", category: "hat", match: "helmet-viking", weight: 1, emoji: "⚔️" },
  { id: "cowboy", name: "Cowboy Hat", category: "hat", match: "hat-cowboy", weight: 1, emoji: "🤠" },
  { id: "fedora", name: "Fedora", category: "hat", match: "fedora-[", weight: 1, emoji: "🎩" },
  { id: "fedora-long", name: "Long Fedora", category: "hat", match: "fedora-long", weight: 1, emoji: "🎩" },
  { id: "bandana", name: "Bandana", category: "hat", match: "bandana", weight: 1, emoji: "🏴" },
  { id: "beanie-banano", name: "Banano Beanie", category: "hat", match: "beanie-banano", weight: 1, emoji: "🍌" },
  { id: "beanie-long-banano", name: "Long Banano Beanie", category: "hat", match: "beanie-long-banano", weight: 1, emoji: "🍌" },
  { id: "beanie", name: "Beanie", category: "hat", match: "beanie-[", weight: 1, emoji: "🧢" },
  { id: "beanie-long", name: "Long Beanie", category: "hat", match: "beanie-long-[", weight: 1, emoji: "🧢" },
  { id: "cap-backwards", name: "Backwards Cap", category: "hat", match: "cap-backwards", weight: 1, emoji: "🧢" },

  // 👓 GLASSES
  { id: "monocle", name: "Monocle", category: "glasses", match: "monocle", weight: 0.5, emoji: "🧐" },
  { id: "eye-patch", name: "Eye Patch", category: "glasses", match: "eye-patch", weight: 0.5, emoji: "🏴‍☠️" },
  { id: "sunglasses-thug", name: "Thug Sunglasses", category: "glasses", match: "sunglasses-thug", weight: 1, emoji: "😎" },
  { id: "aviator-cyan", name: "Cyan Aviators", category: "glasses", match: "sunglasses-aviator-cyan", weight: 1, emoji: "🕶️" },
  { id: "aviator-green", name: "Green Aviators", category: "glasses", match: "sunglasses-aviator-green", weight: 1, emoji: "🕶️" },
  { id: "aviator-yellow", name: "Yellow Aviators", category: "glasses", match: "sunglasses-aviator-yellow", weight: 1, emoji: "🕶️" },
  { id: "nerd-cyan", name: "Cyan Nerd Glasses", category: "glasses", match: "glasses-nerd-cyan", weight: 1, emoji: "🤓" },
  { id: "nerd-green", name: "Green Nerd Glasses", category: "glasses", match: "glasses-nerd-green", weight: 1, emoji: "🤓" },
  { id: "nerd-pink", name: "Pink Nerd Glasses", category: "glasses", match: "glasses-nerd-pink", weight: 1, emoji: "🤓" },

  // 👄 MOUTH
  { id: "joint", name: "Joint", category: "mouth", match: "joint", weight: 0.06, emoji: "🚬" },
  { id: "cigar", name: "Cigar", category: "mouth", match: "cigar", weight: 0.5, emoji: "🚬" },
  { id: "pipe", name: "Pipe", category: "mouth", match: "pipe", weight: 0.5, emoji: "🪈" },
  { id: "tongue", name: "Teasing Face", category: "mouth", match: "smile-tongue", weight: 0.5, emoji: "😛" },
  { id: "confused", name: "Confused Face", category: "mouth", match: "confused", weight: 1, emoji: "😕" },
  { id: "meh", name: "Meh Face", category: "mouth", match: "meh", weight: 1, emoji: "😐" },
  { id: "toothy", name: "Toothy Grin", category: "mouth", match: "smile-big-teeth", weight: 1, emoji: "😁" },
  { id: "smile", name: "Normal Smile", category: "mouth", match: "smile-normal", weight: 1, emoji: "🙂" },

  // 👕 SHIRT & PANTS
  { id: "overalls-blue", name: "Blue Overalls", category: "shirt_and_pants", match: "overalls-blue", weight: 1, emoji: "👖" },
  { id: "overalls-red", name: "Red Overalls", category: "shirt_and_pants", match: "overalls-red", weight: 1, emoji: "👖" },
  { id: "business-pants", name: "Business Pants", category: "shirt_and_pants", match: "pants-business", weight: 1, emoji: "👔" },
  { id: "flower-pants", name: "Flowery Pants", category: "shirt_and_pants", match: "pants-flower", weight: 1, emoji: "🌸" },
  { id: "striped-shirt", name: "Striped Shirt", category: "shirt_and_pants", match: "tshirt-long-stripes", weight: 1, emoji: "👕" },
  { id: "white-shirt", name: "White Shirt", category: "shirt_and_pants", match: "tshirt-short-white", weight: 1, emoji: "👕" },

  // 👟 SHOES
  { id: "swagger", name: "Swaggy Sneakers", category: "shoes", match: "sneakers-swagger", weight: 1, emoji: "👟" },
  { id: "sneakers-blue", name: "Blue Sneakers", category: "shoes", match: "sneakers-blue", weight: 1, emoji: "👟" },
  { id: "sneakers-green", name: "Green Sneakers", category: "shoes", match: "sneakers-green", weight: 1, emoji: "👟" },
  { id: "sneakers-red", name: "Red Sneakers", category: "shoes", match: "sneakers-red", weight: 1, emoji: "👟" },
  { id: "zebra-socks", name: "Zebra Socks", category: "shoes", match: "socks-h-stripe", weight: 1, emoji: "🧦" },
  { id: "crazy-socks", name: "Crazy Socks", category: "shoes", match: "socks-v-stripe", weight: 1, emoji: "🧦" },

  // 🐒 TAIL
  { id: "tail-sock", name: "Tail Warmer", category: "tail", match: "tail-sock", weight: 1, emoji: "🧦" },
];

// Identify which accessories from our catalog are present in an svg filename list.
export function identifyAccessories(filenames: string[]): AccessoryDef[] {
  const found: AccessoryDef[] = [];
  for (const a of ACCESSORIES) {
    for (const f of filenames) {
      if (f.toLowerCase().includes(a.match.toLowerCase())) {
        found.push(a);
        break;
      }
    }
  }
  return found;
}

export const RARITY_TIERS: { label: string; min: number; color: string }[] = [
  { label: "Mythic", min: 50000, color: "#ff3b8a" },
  { label: "Legendary", min: 5000, color: "#f59e0b" },
  { label: "Epic", min: 500, color: "#a855f7" },
  { label: "Rare", min: 50, color: "#3b82f6" },
  { label: "Uncommon", min: 10, color: "#10b981" },
  { label: "Common", min: 0, color: "#9ca3af" },
];

export function rarityTier(p: number) {
  const oneIn = p > 0 ? 1 / p : Infinity;
  for (const t of RARITY_TIERS) if (oneIn >= t.min) return t;
  return RARITY_TIERS[RARITY_TIERS.length - 1];
}
