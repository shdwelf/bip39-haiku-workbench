import { mulberry32, hashStr } from "./rng";

// ---- Ensō settings model ----------------------------------------------------
// Each setting has a value and a maximum, allowing us to pack everything into a
// single mixed-radix "Ensō ID" number (the terrain id, like Worms Armageddon).

export interface EnsoSettings {
  inkLoad: number; // 1..8
  direction: number; // 0 = clockwise, 1 = counter-clockwise
  paperHue: number; // 0..359
  brushSize: number; // 1..12
  inkDensity: number; // 1..9
  stretch: number; // 0..4 (0 equal -> 4 very unequal)
  paperTexture: number; // 0..9
  bristleDensity: number; // 1..9
  signatureStyle: number; // 0 = dark, 1 = light
  brushstrokeSize: number; // 0 small,1 medium,2 large
  startRotation: number; // 0..359
  seed: number; // 0..65535 terrain entropy
}

// Field definitions in a fixed order: [key, min, max]
const FIELDS: [keyof EnsoSettings, number, number][] = [
  ["inkLoad", 1, 8],
  ["direction", 0, 1],
  ["paperHue", 0, 359],
  ["brushSize", 1, 12],
  ["inkDensity", 1, 9],
  ["stretch", 0, 4],
  ["paperTexture", 0, 9],
  ["bristleDensity", 1, 9],
  ["signatureStyle", 0, 1],
  ["brushstrokeSize", 0, 2],
  ["startRotation", 0, 359],
  ["seed", 0, 65535],
];

export const HUE_NAMES = [
  { name: "Crimson", hue: 348 },
  { name: "Amber", hue: 38 },
  { name: "Gold", hue: 50 },
  { name: "Jade", hue: 150 },
  { name: "Cyan", hue: 180 },
  { name: "Azure", hue: 210 },
  { name: "Indigo", hue: 245 },
  { name: "Violet", hue: 280 },
  { name: "Sumi (black)", hue: 0 },
];

export const STRETCH_NAMES = ["Equal", "Slight", "Moderate", "Unequal", "Extreme"];
export const STROKE_SIZE_NAMES = ["Small", "Medium", "Large"];

export const DEFAULT_SETTINGS: EnsoSettings = {
  inkLoad: 4,
  direction: 0, // Clockwise
  paperHue: 180, // Cyan
  brushSize: 6,
  inkDensity: 3,
  stretch: 3, // Unequal
  paperTexture: 4,
  bristleDensity: 5,
  signatureStyle: 0, // Dark
  brushstrokeSize: 1, // Medium
  startRotation: 216,
  seed: 1337,
};

// ---- Encode / decode the Ensō ID -------------------------------------------
export function encodeEnsoId(s: EnsoSettings): string {
  let acc = 0n;
  for (const [key, min, max] of FIELDS) {
    const range = BigInt(max - min + 1);
    let v = Math.max(min, Math.min(max, Math.round((s[key] as number))));
    acc = acc * range + BigInt(v - min);
  }
  // base36, uppercase, grouped for readability
  let str = acc.toString(36).toUpperCase();
  // Prefix with checksum char for nicer "ensogen" style id
  const cs = (hashStr(str) % 36).toString(36).toUpperCase();
  return "EN" + cs + str;
}

export function decodeEnsoId(id: string): EnsoSettings | null {
  try {
    const m = id.trim().toUpperCase();
    if (!m.startsWith("EN")) return null;
    const body = m.slice(3); // skip EN + checksum char
    let acc = BigInt(parseInt36(body));
    const out: Partial<EnsoSettings> = {};
    for (let i = FIELDS.length - 1; i >= 0; i--) {
      const [key, min, max] = FIELDS[i];
      const range = BigInt(max - min + 1);
      const v = Number(acc % range) + min;
      acc = acc / range;
      (out as any)[key] = v;
    }
    return out as EnsoSettings;
  } catch {
    return null;
  }
}

function parseInt36(str: string): bigint {
  let acc = 0n;
  for (const ch of str) {
    const d = parseInt(ch, 36);
    if (isNaN(d)) throw new Error("bad");
    acc = acc * 36n + BigInt(d);
  }
  return acc;
}

// Format id with grouping
export function prettyId(id: string): string {
  return id.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}

// Randomize settings (keeps a few user-locked semantics for variety)
export function randomSettings(seed?: number): EnsoSettings {
  const s = (seed ?? (Math.random() * 0xffffffff)) >>> 0;
  const r = mulberry32(s);
  const pick = (min: number, max: number) => min + Math.floor(r() * (max - min + 1));
  return {
    inkLoad: pick(1, 8),
    direction: pick(0, 1),
    paperHue: HUE_NAMES[pick(0, HUE_NAMES.length - 1)].hue,
    brushSize: pick(1, 12),
    inkDensity: pick(1, 9),
    stretch: pick(0, 4),
    paperTexture: pick(0, 9),
    bristleDensity: pick(1, 9),
    signatureStyle: pick(0, 1),
    brushstrokeSize: pick(0, 2),
    startRotation: pick(0, 359),
    seed: pick(0, 65535),
  };
}

// ---- Render the Ensō to a canvas -------------------------------------------
// Worms-Armageddon-style: deterministic terrain from seed shapes the ink ring.
export function drawEnso(canvas: HTMLCanvasElement, s: EnsoSettings) {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  const r = mulberry32((s.seed << 8) ^ hashStr(encodeEnsoId(s)));

  // Paper background based on hue + texture
  const light = s.signatureStyle === 0 ? 96 : 14;
  const paperSat = 18;
  ctx.fillStyle = `hsl(${s.paperHue}, ${paperSat}%, ${light}%)`;
  ctx.fillRect(0, 0, W, H);

  // Paper texture: speckle noise, density from paperTexture & bristleDensity
  const speckles = s.paperTexture * 1200;
  for (let i = 0; i < speckles; i++) {
    const x = r() * W;
    const y = r() * H;
    const a = r() * 0.05 * (s.paperTexture / 9 + 0.2);
    ctx.fillStyle = s.signatureStyle === 0 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.32;

  // X/Y stretch (unequal)
  const stretchAmt = s.stretch * 0.06;
  const sx = 1 + stretchAmt * (r() > 0.5 ? 1 : -1);
  const sy = 1 - stretchAmt * (r() > 0.5 ? 1 : -1);

  const inkColor = s.signatureStyle === 0 ? `hsl(${s.paperHue}, 30%, 8%)` : `hsl(${s.paperHue}, 40%, 92%)`;

  const dir = s.direction === 0 ? 1 : -1;
  const start = (s.startRotation * Math.PI) / 180;
  // Ensō has a small opening gap
  const sweep = Math.PI * (2 - 0.18 - r() * 0.12);
  const segments = 520;

  // terrain profile — radial perlin-ish from seed (worms terrain feel)
  const noiseN = 8 + s.bristleDensity;
  const amps: number[] = [];
  const phs: number[] = [];
  for (let k = 0; k < noiseN; k++) {
    amps.push((r() - 0.5) * (baseR * 0.10) * (s.stretch / 4 + 0.4));
    phs.push(r() * Math.PI * 2);
  }
  const radialNoise = (t: number) => {
    let v = 0;
    for (let k = 0; k < noiseN; k++) v += amps[k] * Math.sin((k + 1) * t + phs[k]);
    return v;
  };

  const maxWidth = s.brushSize * (s.brushstrokeSize === 0 ? 2.2 : s.brushstrokeSize === 1 ? 3.4 : 5);
  const bristleCount = Math.max(3, s.bristleDensity * 3);

  // Draw bristle strands for textured brush stroke
  for (let b = 0; b < bristleCount; b++) {
    const off = (b / bristleCount - 0.5) * maxWidth;
    const jitter = (r() - 0.5) * 2;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const tt = i / segments;
      const ang = start + dir * sweep * tt;
      const rr = baseR + radialNoise(ang) + off + jitter * Math.sin(tt * 30 + b);
      const x = cx + Math.cos(ang) * rr * sx;
      const y = cy + Math.sin(ang) * rr * sy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Ink load -> opacity falloff along stroke; density -> base opacity
    const baseAlpha = Math.min(1, 0.12 + s.inkDensity * 0.09);
    const dryout = 1 - b / bristleCount * 0.4;
    ctx.strokeStyle = withAlpha(inkColor, baseAlpha * dryout * Math.min(1, s.inkLoad / 4));
    ctx.lineWidth = Math.max(0.6, maxWidth / bristleCount * (0.8 + r() * 0.6));
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Ink splatter at the start (loaded brush)
  const splat = Math.round(s.inkLoad * 6);
  const sAng = start;
  const sR = baseR + radialNoise(sAng);
  const sxp = cx + Math.cos(sAng) * sR * sx;
  const syp = cy + Math.sin(sAng) * sR * sy;
  for (let i = 0; i < splat; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * maxWidth * 1.6;
    ctx.beginPath();
    ctx.arc(sxp + Math.cos(a) * d, syp + Math.sin(a) * d, r() * 2 + 0.4, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(inkColor, 0.5 * (s.inkLoad / 8));
    ctx.fill();
  }
}

function withAlpha(hsl: string, a: number): string {
  // hsl(...) -> hsla(...)
  return hsl.replace("hsl(", "hsla(").replace(")", `, ${a.toFixed(3)})`);
}

export function settingsSummary(s: EnsoSettings) {
  const hueName = HUE_NAMES.reduce((best, h) =>
    Math.abs(h.hue - s.paperHue) < Math.abs(best.hue - s.paperHue) ? h : best
  );
  return [
    ["Ink Load", String(s.inkLoad)],
    ["Direction", s.direction === 0 ? "Clockwise" : "Counter-Clockwise"],
    ["Paper Hue", `${hueName.name} (${s.paperHue}\u00b0)`],
    ["Brush Size", String(s.brushSize)],
    ["Ink Density", String(s.inkDensity)],
    ["X/Y Stretch", STRETCH_NAMES[s.stretch]],
    ["Paper Texture", String(s.paperTexture)],
    ["Bristle Density", String(s.bristleDensity)],
    ["Signature Style", s.signatureStyle === 0 ? "Dark" : "Light"],
    ["Brushstroke Size", STROKE_SIZE_NAMES[s.brushstrokeSize]],
    ["Brushstroke Start", `${s.startRotation}\u00b0`],
  ] as [string, string][];
}
