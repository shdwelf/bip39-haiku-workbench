import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import CryptoJS from "crypto-js";
import { countSyllables, countLineSyllables } from "./syllables";

export const WORDLIST = wordlist; // permanent local record of the 2048 BIP-39 words

// ---- BIP-39 -----------------------------------------------------------------
export function newMnemonic(strength: 128 | 160 | 192 | 224 | 256 = 128): string {
  return bip39.generateMnemonic(wordlist, strength);
}

export function validateMnemonic(m: string): boolean {
  return bip39.validateMnemonic(m, wordlist);
}

// ---- Base58Check + Bitcoin address (BIP-44 m/44'/0'/0'/0/0) -----------------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(buf: Uint8Array): string {
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  let num = 0n;
  for (const b of buf) num = num * 256n + BigInt(b);
  let out = "";
  while (num > 0n) {
    const r = Number(num % 58n);
    num = num / 58n;
    out = B58[r] + out;
  }
  return "1".repeat(zeros) + out;
}
function base58check(payload: Uint8Array): string {
  const checksum = sha256(sha256(payload)).slice(0, 4);
  const full = new Uint8Array(payload.length + 4);
  full.set(payload);
  full.set(checksum, payload.length);
  return base58(full);
}

export interface DerivedAddresses {
  btcLegacy: string; // P2PKH 1...
  path: string;
  xpub: string;
}

export function deriveAddresses(mnemonic: string): DerivedAddresses {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const path = "m/44'/0'/0'/0/0";
  const child = root.derive(path);
  const pub = child.publicKey!; // 33-byte compressed
  const h160 = ripemd160(sha256(pub));
  const payload = new Uint8Array(21);
  payload[0] = 0x00; // mainnet P2PKH version
  payload.set(h160, 1);
  const account = root.derive("m/44'/0'/0'");
  return {
    btcLegacy: base58check(payload),
    path,
    xpub: account.publicExtendedKey,
  };
}

// ---- Haiku assembly ---------------------------------------------------------
export interface HaikuWalletItem {
  id: string; // collectible id
  mnemonic: string;
  lines: string[];
  counts: number[];
  address: string;
  path: string;
  ensoId: string;
  grammarScore: number;
  createdAt: number;
}

// Find a contiguous 3-way partition of the word list whose syllable sums are 5/7/5
function partition575(words: string[]): { lines: string[]; counts: number[] } | null {
  const syl = words.map(countSyllables);
  const n = words.length;
  for (let i = 1; i < n - 1; i++) {
    let a = 0;
    for (let k = 0; k < i; k++) a += syl[k];
    if (a !== 5) continue;
    for (let j = i + 1; j < n; j++) {
      let b = 0;
      for (let k = i; k < j; k++) b += syl[k];
      if (b !== 7) continue;
      let c = 0;
      for (let k = j; k < n; k++) c += syl[k];
      if (c !== 5) continue;
      return {
        lines: [
          words.slice(0, i).join(" "),
          words.slice(i, j).join(" "),
          words.slice(j).join(" "),
        ],
        counts: [a, b, c],
      };
    }
  }
  return null;
}

// Heuristic "grammar / readability" score 0..100 — higher is more haiku-like.
function grammarScore(words: string[]): number {
  let score = 60;
  // penalize immediate duplicates
  for (let i = 1; i < words.length; i++) if (words[i] === words[i - 1]) score -= 25;
  // reward variety
  const unique = new Set(words).size;
  score += (unique / words.length) * 20;
  // reward presence of nature/imagery words common to haiku
  const nature = new Set([
    "river", "moon", "snow", "rain", "wind", "leaf", "flower", "frost", "cloud",
    "ocean", "forest", "autumn", "spring", "winter", "summer", "bird", "fish",
    "stone", "mountain", "sky", "dawn", "night", "shadow", "light", "garden",
  ]);
  for (const w of words) if (nature.has(w)) score += 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface MineOptions {
  ensoId: string;
  requireGrammar: boolean;
  grammarThreshold: number;
  maxAttempts: number;
}

// Mine a single haiku wallet that satisfies 5-7-5 (and optional grammar gate).
export function mineOne(opts: MineOptions): HaikuWalletItem | null {
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    const mnemonic = newMnemonic(128);
    const words = mnemonic.split(" ");
    const part = partition575(words);
    if (!part) continue;
    const gs = grammarScore(words);
    if (opts.requireGrammar && gs < opts.grammarThreshold) continue;
    const addr = deriveAddresses(mnemonic);
    return {
      id: "HK" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      mnemonic,
      lines: part.lines,
      counts: part.counts,
      address: addr.btcLegacy,
      path: addr.path,
      ensoId: opts.ensoId,
      grammarScore: gs,
      createdAt: Date.now(),
    };
  }
  return null;
}

export function mineMany(count: number, opts: MineOptions): HaikuWalletItem[] {
  const out: HaikuWalletItem[] = [];
  for (let i = 0; i < count; i++) {
    const w = mineOne(opts);
    if (w) out.push(w);
  }
  return out;
}

/**
 * Build a vault item from an existing mnemonic (e.g. one piped in from another
 * tool) rather than mining a fresh one. Returns null if the phrase fails the
 * BIP-39 checksum. Phrases that do not split cleanly into 5-7-5 are still
 * accepted; the line breakdown then falls back to the raw word sequence.
 */
export function itemFromMnemonic(
  mnemonic: string,
  ensoId: string
): HaikuWalletItem | null {
  const phrase = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
  if (!validateMnemonic(phrase)) return null;
  const words = phrase.split(" ");
  const part = partition575(words);
  const addr = deriveAddresses(phrase);
  return {
    id: "HK" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    mnemonic: phrase,
    lines: part ? part.lines : [words.join(" "), "", ""],
    counts: part ? part.counts : [countLineSyllables(words.join(" ")), 0, 0],
    address: addr.btcLegacy,
    path: addr.path,
    ensoId,
    grammarScore: grammarScore(words),
    createdAt: Date.now(),
  };
}

// ---- Encryption (AES-256) ---------------------------------------------------
export function encrypt(plain: string, password: string): string {
  return CryptoJS.AES.encrypt(plain, password).toString();
}
export function decrypt(cipher: string, password: string): string {
  const bytes = CryptoJS.AES.decrypt(cipher, password);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// ---- Persistence: encrypted cookie + localStorage mirror --------------------
const STORE_KEY = "haiku_vault_v1";

export function setCookie(name: string, value: string, days = 365) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  // cookies cap ~4KB; we still write what fits, localStorage is the source of truth
  const v = encodeURIComponent(value).slice(0, 3800);
  document.cookie = `${name}=${v}; expires=${exp}; path=/; SameSite=Lax`;
}
export function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function saveVault(items: HaikuWalletItem[], password: string) {
  const cipher = encrypt(JSON.stringify(items), password || "default-vault-key");
  try {
    localStorage.setItem(STORE_KEY, cipher);
  } catch {}
  setCookie(STORE_KEY, cipher);
}

export function loadVault(password: string): HaikuWalletItem[] {
  let cipher = "";
  try {
    cipher = localStorage.getItem(STORE_KEY) || "";
  } catch {}
  if (!cipher) cipher = getCookie(STORE_KEY) || "";
  if (!cipher) return [];
  try {
    const json = decrypt(cipher, password || "default-vault-key");
    return JSON.parse(json) as HaikuWalletItem[];
  } catch {
    return [];
  }
}

// Export the vault as an AES-256 encrypted .txt download
export function exportEncryptedTxt(items: HaikuWalletItem[], password: string) {
  const header = "# Haiku Wallet vault — AES-256 encrypted. Decrypt with your Ensō ID / password.\n";
  const cipher = encrypt(JSON.stringify(items, null, 2), password);
  download(header + cipher, "haiku-vault.txt", "text/plain");
}

export function exportPlainTxt(items: HaikuWalletItem[]) {
  const text = items
    .map(
      (w, i) =>
        `#${i + 1}  id:${w.id}  ensō:${w.ensoId}\n` +
        w.lines.join("\n") +
        `\n[${w.counts.join("-")}]\n` +
        `mnemonic: ${w.mnemonic}\n` +
        `address (${w.path}): ${w.address}\n`
    )
    .join("\n----------------------------------------\n");
  download(text, "haiku-wallets.txt", "text/plain");
}

export function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
