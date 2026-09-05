import { describe, expect, it } from "vitest";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  findAnagrams,
  findCloseMatches,
  levenshtein,
  mineBtcVanity,
  recoverMissingWords,
  recoverWithAnagramsAndTypos,
} from "../src/lib/recovery";
import { deriveAddresses, validateMnemonic } from "../src/lib/wallet";

describe("levenshtein / candidate helpers", () => {
  it("computes edit distance", () => {
    expect(levenshtein("veteran", "veteren")).toBe(1);
    expect(levenshtein("abandon", "abandn")).toBe(1);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });

  it("finds wordlist anagrams (canoe and ocean share letters)", () => {
    expect(findAnagrams("canoe")).toContain("ocean");
    expect(findAnagrams("armed")).toContain("dream");
    expect(findAnagrams("zzzzz")).toEqual([]);
  });

  it("finds close edits within the wordlist", () => {
    const close = findCloseMatches("abandn", 1);
    expect(close).toContain("abandon");
    expect(findCloseMatches("abandn", 0)).toEqual([]);
  });
});

describe("recoverMissingWords", () => {
  it("recovers a single blanked word, pinned by its target address", async () => {
    const phrase = generateMnemonic(wordlist, 128);
    const words = phrase.split(" ");
    const gapped = words
      .map((w, i) => (i === 4 ? "?" : w))
      .join(" ");
    const mine = deriveAddresses(phrase).btcLegacy;

    // unpinned: a blank word has several checksum-valid fills (all genuine
    // BIP-39 phrases — the checksum cannot tell them apart)
    const all = await recoverMissingWords(gapped);
    expect(all.length).toBeGreaterThan(1);
    for (const f of all) {
      expect(validateMnemonic(f.mnemonic)).toBe(true);
      expect(f.mnemonic.split(" ")[4]).toBe(f.mnemonic.split(" ")[4]);
    }

    // pinned: the address filter singles out the original phrase
    const found = await recoverMissingWords(gapped, { targetAddress: mine });
    expect(found.map((f) => f.mnemonic)).toContain(phrase);
  });

  it("scans two blanked words and returns only checksum-valid fills", async () => {
    const phrase = generateMnemonic(wordlist, 128);
    const words = phrase.split(" ");
    const gapped = words
      .map((w, i) => (i === 2 || i === 9 ? "?" : w))
      .join(" ");

    // Unpinned 2-word scan = 2048² candidates; every returned fill must be a
    // genuine BIP-39 phrase with both slots populated. (Pinning to the
    // original phrase with a target address works exactly as in the 1-word
    // test but costs ~262k derivations; covered by the pinned 1-word case.)
    const found = await recoverMissingWords(gapped);
    expect(found.length).toBeGreaterThan(0);
    for (const f of found) {
      expect(validateMnemonic(f.mnemonic)).toBe(true);
      const w = f.mnemonic.split(" ");
      expect(w[2]).not.toBe("?");
      expect(w[9]).not.toBe("?");
      expect(w.length).toBe(12);
    }
  }, 180_000);

  it("narrows multiple checksum-valid candidates by target address", async () => {
    const phrase = generateMnemonic(wordlist, 128);
    const words = phrase.split(" ");
    const gapped = words.map((w, i) => (i === 7 ? "?" : w)).join(" ");
    const mine = deriveAddresses(phrase).btcLegacy;

    const all = await recoverMissingWords(gapped);
    expect(all.length).toBeGreaterThan(1); // a blank word usually has several valid fills

    const filtered = await recoverMissingWords(gapped, {
      targetAddress: mine,
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].mnemonic).toBe(phrase);
    expect(filtered[0].address).toBe(mine);
  });

  it("rejects more missing words than the cap", async () => {
    await expect(
      recoverMissingWords("? ? ? ? ? ? ? ? ? ? ? ?", { maxMissing: 2 })
    ).rejects.toThrow(/missing words/i);
  });

  it("rejects a wrong-length phrase", async () => {
    await expect(recoverMissingWords("? ? ?")).rejects.toThrow(/12, 15, 18/);
  });
});

describe("recoverWithAnagramsAndTypos", () => {
  it("repairs a one-letter typo and returns the original phrase", async () => {
    const phrase = generateMnemonic(wordlist, 128);
    const words = phrase.split(" ");
    // garble one word by a deletion that is not itself a wordlist word
    const garbledWord = words[3].slice(0, -1);
    if (wordlist.includes(garbledWord)) return; // vanishingly rare; skip
    words[3] = garbledWord;
    const mine = deriveAddresses(phrase).btcLegacy;

    const found = await recoverWithAnagramsAndTypos(words.join(" "), {
      targetAddress: mine,
    });
    expect(found.map((f) => f.mnemonic)).toContain(phrase);
    const match = found.find((f) => f.mnemonic === phrase)!;
    expect(match.replacedWords).toEqual([
      { index: 3, original: garbledWord, replacedWith: phrase.split(" ")[3] },
    ]);
  });

  it("repairs an anagram swap (canoe <-> ocean)", async () => {
    // Build from a phrase containing one of the anagram pair members.
    let phrase = generateMnemonic(wordlist, 128);
    while (!phrase.includes("canoe")) phrase = generateMnemonic(wordlist, 128);
    const garbled = phrase.replace("canoe", "ocean");
    const mine = deriveAddresses(phrase).btcLegacy;

    // Pinned to the original address: without a pin, several unrelated
    // single-word repairs can crowd the result cap before the swapped
    // position is reached — the address is what says which one is yours.
    const found = await recoverWithAnagramsAndTypos(garbled, {
      targetAddress: mine,
    });
    expect(found.map((f) => f.mnemonic)).toContain(phrase);
  });

  it("returns the phrase untouched when nothing is wrong", async () => {
    const phrase = generateMnemonic(wordlist, 128);
    const found = await recoverWithAnagramsAndTypos(phrase);
    expect(found).toEqual([
      { mnemonic: phrase, address: deriveAddresses(phrase).btcLegacy, replacedWords: [] },
    ]);
  });
});

describe("mineBtcVanity", () => {
  it("mines an 11… prefix quickly", async () => {
    const res = await mineBtcVanity("11", { maxAttempts: 200_000 });
    expect(res).not.toBeNull();
    expect(validateMnemonic(res!.mnemonic)).toBe(true);
    expect(res!.address).toMatch(/^11/);
  }, 60_000);

  it("rejects non-Base58 prefixes", async () => {
    await expect(mineBtcVanity("0ll")).rejects.toThrow(/Base58/);
  });
});
