// Mnemonic recovery + vanity mining.
// Ported from the recovered `crypto-mnemonic-mining-app` (June 2026) onto this
// repo's dependency stack: @scure/bip39 for checksums, the wallet's own BTC
// P2PKH derivation instead of ethers/bananojs. All searches are checksum-gated
// and batched so the UI stays responsive and cancellable.

import {
  deriveAddresses,
  newMnemonic,
  validateMnemonic,
  WORDLIST,
} from "./wallet";

export interface Cancel {
  cancelled: boolean;
}

export interface WordFix {
  index: number;
  original: string;
  replacedWith: string;
}

export interface RecoveryMatch {
  mnemonic: string;
  address: string;
  replacedWords: WordFix[];
}

const YIELD_EVERY = 25;

function yieldToUi(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function normalize(words: string[]): string[] {
  return words.map((w) => w.toLowerCase().trim()).filter(Boolean);
}

/** Classic dynamic-programming edit distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** Wordlist entries that are exact letter-shuffles of `word`. */
export function findAnagrams(word: string): string[] {
  const sig = (w: string) => w.toLowerCase().split("").sort().join("");
  const target = sig(word);
  return WORDLIST.filter((w) => sig(w) === target);
}

/** Wordlist entries within `maxDistance` edits of `word`. */
export function findCloseMatches(word: string, maxDistance = 2): string[] {
  const w = word.toLowerCase();
  return WORDLIST.filter((x) => levenshtein(w, x) <= maxDistance);
}

function addressMatches(candidate: string, target: string): boolean {
  if (!target) return true;
  return candidate.toLowerCase().includes(target.toLowerCase());
}

export interface RecoverMissingOptions {
  /** Abort flag; set `cancelled = true` from the UI. */
  cancel?: Cancel;
  /** Hard cap on `?` slots (2048^n combinations). Default 2. */
  maxMissing?: number;
  /** Optional substring an address must contain to keep a candidate. */
  targetAddress?: string;
  passphrase?: string;
  onProgress?: (attempts: number) => void;
}

/**
 * Brute-force `?` placeholders in a phrase. Each unknown slot walks the 2048
 * words; only phrases whose BIP-39 checksum validates survive, then (option-
 * ally) the derived address must contain the target. One missing word is
 * instant; two is a few million combinations worst-case and is chunked so it
 * can be cancelled.
 */
export async function recoverMissingWords(
  partialMnemonic: string,
  opts: RecoverMissingOptions = {}
): Promise<RecoveryMatch[]> {
  const maxMissing = opts.maxMissing ?? 2;
  const words = normalize(partialMnemonic.split(/[,\s]+/));
  const missing = words
    .map((w, i) => (w === "?" || w === "_" ? i : -1))
    .filter((i) => i !== -1);

  if (words.length !== 12 && words.length !== 15 && words.length !== 18 && words.length !== 21 && words.length !== 24) {
    throw new Error(
      `Phrase has ${words.length} slots; BIP-39 needs 12, 15, 18, 21 or 24.`
    );
  }
  if (missing.length === 0) {
    if (validateMnemonic(words.join(" "))) {
      const addr = deriveAddresses(words.join(" "), {
        passphrase: opts.passphrase,
      }).btcLegacy;
      if (addressMatches(addr, opts.targetAddress ?? "")) {
        return [{ mnemonic: words.join(" "), address: addr, replacedWords: [] }];
      }
    }
    return [];
  }
  if (missing.length > maxMissing) {
    throw new Error(
      `${missing.length} missing words; this lab caps brute force at ${maxMissing}.`
    );
  }

  const results: RecoveryMatch[] = [];
  const maxResults = 20;
  let attempts = 0;

  const dfs = async (depth: number, current: string[]): Promise<void> => {
    if (opts.cancel?.cancelled) return;
    if (depth === missing.length) {
      attempts++;
      if (attempts % YIELD_EVERY === 0) {
        opts.onProgress?.(attempts);
        await yieldToUi();
      }
      if (results.length >= maxResults) return;
      const phrase = current.join(" ");
      if (validateMnemonic(phrase)) {
        // Derivation (PBKDF2) is the expensive step: without an address
        // filter it is only paid for the results we can actually keep.
        const addr = deriveAddresses(phrase, {
          passphrase: opts.passphrase,
        }).btcLegacy;
        if (addressMatches(addr, opts.targetAddress ?? "")) {
          results.push({ mnemonic: phrase, address: addr, replacedWords: [] });
        }
      }
      return;
    }
    for (let i = 0; i < WORDLIST.length; i++) {
      if (opts.cancel?.cancelled) return;
      current[missing[depth]] = WORDLIST[i];
      await dfs(depth + 1, current);
      if (results.length >= maxResults) return;
    }
  };

  await dfs(0, [...words]);
  opts.onProgress?.(attempts);
  return results.slice(0, maxResults);
}

export interface RepairOptions {
  cancel?: Cancel;
  targetAddress?: string;
  passphrase?: string;
  onProgress?: (wordIndex: number, totalWords: number, attempts: number) => void;
}

/**
 * Repair a garbled phrase. Words outside the wordlist are replaced by their
 * anagrams and close edits (edit distance <= 2); if every word is already in
 * the list but the checksum still fails, each single word is tried against its
 * near neighbours (edit distance <= 1 plus anagrams). Optional address target
 * narrows multiple checksum-valid candidates down to yours.
 */
export async function recoverWithAnagramsAndTypos(
  mnemonic: string,
  opts: RepairOptions = {}
): Promise<RecoveryMatch[]> {
  const words = normalize(mnemonic.split(/[,\s]+/));
  if (words.length < 12) throw new Error("Need at least 12 words to repair.");
  const invalid = words
    .map((w, i) => (WORDLIST.includes(w) || w === "?" ? -1 : i))
    .filter((i) => i !== -1);

  const results: RecoveryMatch[] = [];
  let attempts = 0;

  const tryPhrase = async (
    current: string[],
    replaced: WordFix[]
  ): Promise<boolean> => {
    attempts++;
    if (attempts % YIELD_EVERY === 0) {
      opts.onProgress?.(0, words.length, attempts);
      await yieldToUi();
    }
    const phrase = current.join(" ");
    if (validateMnemonic(phrase)) {
      const addr = deriveAddresses(phrase, { passphrase: opts.passphrase })
        .btcLegacy;
      if (addressMatches(addr, opts.targetAddress ?? "")) {
        results.push({ mnemonic: phrase, address: addr, replacedWords: replaced });
        return true;
      }
    }
    return false;
  };

  if (invalid.length === 0) {
    if (validateMnemonic(words.join(" "))) {
      const addr = deriveAddresses(words.join(" "), {
        passphrase: opts.passphrase,
      }).btcLegacy;
      if (addressMatches(addr, opts.targetAddress ?? "")) {
        return [{ mnemonic: words.join(" "), address: addr, replacedWords: [] }];
      }
    }
    // Every word is valid but the checksum is wrong: hunt single silent typos.
    for (let i = 0; i < words.length; i++) {
      if (opts.cancel?.cancelled) break;
      const original = words[i];
      const candidates = Array.from(
        new Set([...findAnagrams(original), ...findCloseMatches(original, 1)])
      ).filter((c) => c !== original);
      for (const cand of candidates) {
        if (opts.cancel?.cancelled) break;
        opts.onProgress?.(i + 1, words.length, attempts);
        const test = [...words];
        test[i] = cand;
        await tryPhrase(test, [
          { index: i, original, replacedWith: cand },
        ]);
        if (results.length >= 40) break;
      }
      if (results.length >= 40) break;
    }
    return results;
  }

  // Candidate sets for the garbled positions.
  const candidateMap = new Map<number, string[]>();
  for (const idx of invalid) {
    const w = words[idx];
    const cands = Array.from(
      new Set([...findAnagrams(w), ...findCloseMatches(w, 2)])
    );
    candidateMap.set(idx, cands.length > 0 ? cands : [...WORDLIST]);
  }

  const dfs = async (
    depth: number,
    current: string[],
    replaced: WordFix[]
  ): Promise<void> => {
    if (opts.cancel?.cancelled) return;
    if (depth === invalid.length) {
      await tryPhrase(current, replaced);
      return;
    }
    const idx = invalid[depth];
    for (const cand of candidateMap.get(idx)!) {
      if (opts.cancel?.cancelled) return;
      const next = [...current];
      next[idx] = cand;
      await dfs(
        depth + 1,
        next,
        replaced.concat([{ index: idx, original: words[idx], replacedWith: cand }])
      );
      if (results.length >= 10) return;
    }
  };

  await dfs(0, [...words], []);
  opts.onProgress?.(words.length, words.length, attempts);
  return results;
}

export interface VanityResult {
  mnemonic: string;
  address: string;
  attempts: number;
}

/**
 * Mine fresh mnemonics until the BTC legacy address starts with `prefix`
 * (everything after the mandatory leading `1`). Expected work grows ~58x per
 * character; the miner gives up after `maxAttempts` (default 2,000,000).
 */
export async function mineBtcVanity(
  prefix: string,
  opts: {
    cancel?: Cancel;
    maxAttempts?: number;
    onProgress?: (attempts: number) => void;
  } = {}
): Promise<VanityResult | null> {
  // Base58 is case-sensitive, so the comparison is too. The leading `1` of a
  // P2PKH address is implicit, but typing it is allowed.
  const want = prefix.trim();
  const B58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if ([...want].some((ch) => !B58_CHARS.includes(ch))) {
    throw new Error("Prefix uses characters outside the Base58 alphabet.");
  }
  const maxAttempts = opts.maxAttempts ?? 2_000_000;
  let attempts = 0;
  while (attempts < maxAttempts) {
    for (let i = 0; i < YIELD_EVERY * 4; i++) {
      attempts++;
      const mnemonic = newMnemonic(128);
      const address = deriveAddresses(mnemonic).btcLegacy;
      if (address.startsWith(want)) {
        opts.onProgress?.(attempts);
        return { mnemonic, address, attempts };
      }
      if (attempts >= maxAttempts) break;
    }
    opts.onProgress?.(attempts);
    if (opts.cancel?.cancelled) return null;
    await yieldToUi();
  }
  return null;
}
