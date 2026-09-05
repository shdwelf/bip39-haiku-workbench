// Offline MonKey generation.
//
// The official monkey.banano.cc service derives a monKey deterministically from
// a Banano address. This module reproduces that idea locally so the miner works
// with no network: the address is hashed into a PRNG stream, and each accessory
// category is sampled from that stream using the real appditto weights.
//
// Because sampling uses `weight / CATEGORY_TOTAL * CATEGORY_ODDS`, the observed
// frequency of any accessory matches `probability()` in ./accessories — so
// "mine for a Flamethrower" is as hard here as it is on the real service.
//
// The artwork is drawn locally and is NOT the official MonKey art (those SVG
// assets are not bundled). It is a deterministic stand-in that renders the
// accessories the address actually rolled.

import {
  ACCESSORIES,
  CATEGORY_ODDS,
  CATEGORY_TOTAL,
  type AccessoryDef,
  type Category,
} from "./accessories";

const CATEGORIES = Object.keys(CATEGORY_ODDS) as Category[];

/** 32-bit string hash (xmur3) — one call seeds the PRNG. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic PRNG for an address, domain-separated by `salt`. */
export function rngFor(address: string, salt = ""): () => number {
  return mulberry32(xmur3(address + "|" + salt)());
}

const BY_CATEGORY = new Map<Category, AccessoryDef[]>();
for (const c of CATEGORIES) {
  BY_CATEGORY.set(
    c,
    ACCESSORIES.filter((a) => a.category === c)
  );
}

/**
 * Roll the accessories an address carries.
 *
 * For each category: the category is present with probability CATEGORY_ODDS.
 * If present, one item is drawn with probability weight / CATEGORY_TOTAL.
 * The catalog only lists notable accessories, so the leftover weight forms a
 * "plain" bucket representing the unlisted common items — keeping each listed
 * accessory at its true rate instead of inflating it.
 */
export function accessoriesFor(address: string): AccessoryDef[] {
  const rand = rngFor(address, "acc");
  const out: AccessoryDef[] = [];

  for (const category of CATEGORIES) {
    if (rand() >= CATEGORY_ODDS[category]) continue; // category absent

    const pool = BY_CATEGORY.get(category) ?? [];
    const total = CATEGORY_TOTAL[category];
    let roll = rand() * total;

    let picked: AccessoryDef | null = null;
    for (const a of pool) {
      roll -= a.weight;
      if (roll < 0) {
        picked = a;
        break;
      }
    }
    // roll landed in the unlisted "plain" remainder -> nothing notable
    if (picked) out.push(picked);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Procedural artwork
// ---------------------------------------------------------------------------

const FURS = ["#c9a227", "#e0b93d", "#b8860b", "#d9a441", "#a67c1a", "#eac253"];
const SHIRTS = ["#3b82f6", "#ef4444", "#10b981", "#a855f7", "#f59e0b", "#ec4899"];

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render a deterministic monKey as an inline SVG string.
 * Same address always yields the same drawing, including its accessories.
 */
export function monkeySvg(address: string, size = 160): string {
  const rand = rngFor(address, "art");
  const acc = accessoriesFor(address);
  const has = (id: string) => acc.some((a) => a.id === id);
  const inCat = (c: Category) => acc.find((a) => a.category === c);

  const fur = FURS[Math.floor(rand() * FURS.length)];
  const shirt = SHIRTS[Math.floor(rand() * SHIRTS.length)];
  const bg = `hsl(${Math.floor(rand() * 360)} 45% 18%)`;
  const earY = 68 + rand() * 6;

  const hat = inCat("hat");
  const glasses = inCat("glasses");
  const mouth = inCat("mouth");
  const misc = inCat("misc");
  const shoes = inCat("shoes");
  const pants = inCat("shirt_and_pants");
  const tail = inCat("tail");

  const p: string[] = [];
  p.push(`<rect width="200" height="200" rx="14" fill="${bg}"/>`);

  // tail
  p.push(
    `<path d="M150 150 q28 -6 22 -36" stroke="${fur}" stroke-width="7" fill="none" stroke-linecap="round"/>`
  );
  if (tail) p.push(`<circle cx="171" cy="116" r="6" fill="#e5e7eb"/>`);

  // legs + shoes
  p.push(`<rect x="78" y="150" width="14" height="26" rx="7" fill="${fur}"/>`);
  p.push(`<rect x="108" y="150" width="14" height="26" rx="7" fill="${fur}"/>`);
  if (shoes) {
    p.push(`<ellipse cx="85" cy="178" rx="13" ry="7" fill="#f3f4f6"/>`);
    p.push(`<ellipse cx="115" cy="178" rx="13" ry="7" fill="#f3f4f6"/>`);
  }

  // body / shirt
  if (pants) {
    p.push(`<rect x="66" y="112" width="68" height="46" rx="18" fill="${shirt}"/>`);
  } else {
    p.push(`<rect x="66" y="112" width="68" height="46" rx="18" fill="${fur}"/>`);
  }

  // arms
  p.push(`<rect x="52" y="118" width="13" height="34" rx="6.5" fill="${fur}"/>`);
  p.push(`<rect x="135" y="118" width="13" height="34" rx="6.5" fill="${fur}"/>`);

  // ears + head
  p.push(`<circle cx="62" cy="${earY}" r="15" fill="${fur}"/>`);
  p.push(`<circle cx="138" cy="${earY}" r="15" fill="${fur}"/>`);
  p.push(`<circle cx="62" cy="${earY}" r="8" fill="rgba(0,0,0,.18)"/>`);
  p.push(`<circle cx="138" cy="${earY}" r="8" fill="rgba(0,0,0,.18)"/>`);
  p.push(`<circle cx="100" cy="72" r="40" fill="${fur}"/>`);
  p.push(`<ellipse cx="100" cy="86" rx="27" ry="21" fill="rgba(255,255,255,.22)"/>`);

  // eyes
  if (has("eye-patch")) {
    p.push(`<circle cx="114" cy="66" r="5.5" fill="#111"/>`);
    p.push(`<path d="M74 58 L100 63" stroke="#111" stroke-width="3"/>`);
    p.push(`<circle cx="86" cy="66" r="9" fill="#111"/>`);
  } else {
    p.push(`<circle cx="86" cy="66" r="6" fill="#fff"/>`);
    p.push(`<circle cx="114" cy="66" r="6" fill="#fff"/>`);
    p.push(`<circle cx="86" cy="66" r="3" fill="#111"/>`);
    p.push(`<circle cx="114" cy="66" r="3" fill="#111"/>`);
  }

  // glasses
  if (glasses) {
    if (glasses.id === "monocle") {
      p.push(
        `<circle cx="114" cy="66" r="12" fill="rgba(255,255,255,.25)" stroke="#e5e7eb" stroke-width="2"/>`,
        `<path d="M114 78 v14" stroke="#e5e7eb" stroke-width="1.5"/>`
      );
    } else if (glasses.id !== "eye-patch") {
      const dark = glasses.id.includes("sunglasses") || glasses.id.includes("aviator");
      const lens = dark ? "#111827" : "rgba(255,255,255,.3)";
      const rim = glasses.id.includes("cyan")
        ? "#22d3ee"
        : glasses.id.includes("green")
          ? "#34d399"
          : glasses.id.includes("pink")
            ? "#f472b6"
            : glasses.id.includes("yellow")
              ? "#fbbf24"
              : "#111827";
      p.push(
        `<rect x="74" y="58" width="24" height="16" rx="7" fill="${lens}" stroke="${rim}" stroke-width="2.5"/>`,
        `<rect x="102" y="58" width="24" height="16" rx="7" fill="${lens}" stroke="${rim}" stroke-width="2.5"/>`,
        `<path d="M98 66 h4" stroke="${rim}" stroke-width="2.5"/>`
      );
    }
  }

  // mouth
  if (mouth?.id === "toothy") {
    p.push(`<rect x="88" y="88" width="24" height="12" rx="4" fill="#fff"/>`);
    p.push(`<path d="M88 94 h24" stroke="#111" stroke-width="1.5"/>`);
  } else if (mouth?.id === "meh") {
    p.push(`<path d="M88 94 h24" stroke="#111" stroke-width="3" stroke-linecap="round"/>`);
  } else if (mouth?.id === "confused") {
    p.push(
      `<path d="M88 96 q8 -8 12 0 q4 8 12 0" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>`
    );
  } else if (mouth?.id === "tongue") {
    p.push(`<path d="M88 90 q12 12 24 0" stroke="#111" stroke-width="3" fill="none"/>`);
    p.push(`<ellipse cx="100" cy="99" rx="7" ry="5" fill="#f472b6"/>`);
  } else {
    p.push(
      `<path d="M88 90 q12 11 24 0" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>`
    );
  }
  if (mouth && ["cigar", "joint", "pipe"].includes(mouth.id)) {
    p.push(`<rect x="110" y="92" width="22" height="5" rx="2.5" fill="#7c3f1d"/>`);
    p.push(`<circle cx="134" cy="94" r="3" fill="#f97316"/>`);
  }

  // hats
  if (hat) {
    if (hat.id === "crown" || hat.id === "very-hng-cap") {
      p.push(
        `<path d="M70 40 l8 -22 10 14 12 -20 12 20 10 -14 8 22 z" fill="#fbbf24" stroke="#b45309" stroke-width="2"/>`
      );
    } else if (hat.id === "jester") {
      p.push(
        `<path d="M66 40 q34 -30 68 0 z" fill="#ef4444"/>`,
        `<path d="M66 40 q10 -26 -8 -30" stroke="#ef4444" stroke-width="7" fill="none"/>`,
        `<path d="M134 40 q-10 -26 8 -30" stroke="#22c55e" stroke-width="7" fill="none"/>`,
        `<circle cx="56" cy="8" r="5" fill="#fbbf24"/>`,
        `<circle cx="144" cy="8" r="5" fill="#fbbf24"/>`
      );
    } else if (hat.id === "cowboy") {
      p.push(
        `<ellipse cx="100" cy="42" rx="48" ry="9" fill="#8b5a2b"/>`,
        `<path d="M78 42 q22 -32 44 0 z" fill="#a0522d"/>`
      );
    } else if (hat.id.startsWith("fedora")) {
      p.push(
        `<ellipse cx="100" cy="42" rx="42" ry="8" fill="#1f2937"/>`,
        `<path d="M80 42 q20 -28 40 0 z" fill="#111827"/>`,
        `<rect x="80" y="34" width="40" height="6" fill="#4b5563"/>`
      );
    } else if (hat.id === "viking") {
      p.push(
        `<path d="M70 44 q30 -30 60 0 z" fill="#9ca3af"/>`,
        `<path d="M70 40 q-20 -12 -8 -26 q14 6 14 22 z" fill="#f3f4f6"/>`,
        `<path d="M130 40 q20 -12 8 -26 q-14 6 -14 22 z" fill="#f3f4f6"/>`
      );
    } else if (hat.id.includes("beanie")) {
      p.push(
        `<path d="M68 44 q32 -34 64 0 z" fill="#22c55e"/>`,
        `<rect x="66" y="40" width="68" height="9" rx="4" fill="#16a34a"/>`
      );
    } else if (hat.id === "bandana") {
      p.push(`<path d="M64 46 q36 -22 72 0 q-36 10 -72 0 z" fill="#dc2626"/>`);
    } else {
      // generic cap
      p.push(
        `<path d="M68 46 q32 -32 64 0 z" fill="#2563eb"/>`,
        `<ellipse cx="140" cy="46" rx="20" ry="6" fill="#1d4ed8"/>`
      );
    }
  }

  // handheld misc item — emoji keeps 60+ items readable without 60 drawings
  if (misc) {
    p.push(
      `<text x="46" y="150" font-size="26" text-anchor="middle">${esc(misc.emoji)}</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="MonKey for ${esc(
    address
  )}">${p.join("")}</svg>`;
}

/** Data-URI form, handy for <img src> and for piping out of the tool. */
export function monkeyDataUri(address: string, size = 160): string {
  return (
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(monkeySvg(address, size))
  );
}
