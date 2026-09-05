// Authentic-ish English syllable counter (heuristic, handles common edge cases).
// Used to validate 5-7-5 haiku structure for the wallet mnemonics.

const EXCEPTIONS: Record<string, number> = {
  // BIP-39 words / common words that the heuristic gets wrong
  abandon: 3, area: 3, idea: 3, video: 3, radio: 3, audio: 3, ratio: 3,
  poem: 2, poet: 2, lion: 2, quiet: 2, science: 2, fire: 1, hour: 1,
  iron: 2, every: 2, evening: 2, family: 3, vegetable: 4, chocolate: 3,
  business: 2, average: 3, different: 3, interest: 3, camera: 3, favorite: 3,
  orange: 2, people: 2, little: 2, simple: 2, table: 2, able: 2, apple: 2,
  bicycle: 3, animal: 3, energy: 3, enemy: 3, melody: 3, memory: 3,
  ocean: 2, create: 2, react: 2, riot: 2, diet: 2, giant: 2, client: 2,
  society: 4, real: 1, really: 2,
};

export function countSyllables(word: string): number {
  let w = word.toLowerCase().trim().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (EXCEPTIONS[w] != null) return EXCEPTIONS[w];
  if (w.length <= 3) return 1;

  // Remove silent endings
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  w = w.replace(/^y/, "");

  const groups = w.match(/[aeiouy]{1,2}/g);
  let count = groups ? groups.length : 1;

  // Words ending in "le" preceded by a consonant gain a syllable
  if (/[^aeiouy]le$/.test(word.toLowerCase())) count += 1;

  return Math.max(1, count);
}

export function countLineSyllables(line: string): number {
  return line
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, w) => sum + countSyllables(w), 0);
}

export interface HaikuCheck {
  counts: number[];
  valid: boolean;
}

// Validate a 3-line haiku as 5-7-5
export function checkHaiku(lines: string[]): HaikuCheck {
  const target = [5, 7, 5];
  const counts = lines.map(countLineSyllables);
  const valid = counts.length === 3 && counts.every((c, i) => c === target[i]);
  return { counts, valid };
}

export interface GreedySplit {
  lines: string[][];
  counts: number[];
  /** True only when the greedy split happens to land exactly on 5-7-5. */
  isHaiku: boolean;
}

/**
 * Greedy 5/7/5 split across the word sequence — the best-effort shape shown
 * when a phrase does not contain a clean contiguous 5/7/5 partition. Words are
 * poured into a line until its syllable target is reached, then the next line
 * starts. `isHaiku` is true only if every line lands exactly on target.
 */
export function greedy575(words: string[]): GreedySplit {
  const syllables = words.map(countSyllables);
  const lines: string[][] = [[], [], []];
  const targets = [5, 7, 5];
  let li = 0;
  let acc = 0;
  for (let i = 0; i < words.length; i++) {
    // Once the third line is full, extra words overflow into it rather than
    // being dropped — the shape always accounts for every word.
    const line = Math.min(li, 2);
    lines[line].push(words[i]);
    if (li < 2) {
      acc += syllables[i];
      if (acc >= targets[li]) {
        li++;
        acc = 0;
      }
    }
  }
  const counts = lines.map((l) => l.reduce((s, w) => s + countSyllables(w), 0));
  return {
    lines,
    counts,
    isHaiku: counts[0] === 5 && counts[1] === 7 && counts[2] === 5 && li >= 2,
  };
}
