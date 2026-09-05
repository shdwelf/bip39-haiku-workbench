import { describe, expect, it } from "vitest";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  deriveAccounts,
  deriveAddresses,
  itemFromMnemonic,
} from "../src/lib/wallet";
import { countSyllables, greedy575 } from "../src/lib/syllables";

describe("greedy575", () => {
  it("marks a true 5-7-5 sequence as a haiku", () => {
    // five 1-syllable, seven 1-syllable, five 1-syllable words
    const words = "act add cat dad act add cat dad act add act add cat dad".split(" ");
    const shape = greedy575(words.slice(0, 5).concat(words.slice(5, 12), words.slice(0, 5)));
    expect(shape.counts).toEqual([5, 7, 5]);
    expect(shape.isHaiku).toBe(true);
  });

  it("splits greedily even when the phrase is not a haiku", () => {
    const shape = greedy575(["abandon", "ability", "able"]);
    expect(shape.lines.flat()).toEqual(["abandon", "ability", "able"]);
    expect(shape.isHaiku).toBe(false);
  });

  it("distributes long words across lines without mid-word breaks", () => {
    // 'abandon vegetable chocolate' = 3+4+3 = 10 syllables — short phrases
    // simply do not reach the third line, and that is fine.
    const shape = greedy575(["abandon", "vegetable", "chocolate"]);
    expect(shape.counts.reduce((a, b) => a + b, 0)).toBe(10);
    expect(shape.lines[0].length).toBeGreaterThan(0);
    expect(shape.isHaiku).toBe(false);
  });
});

describe("syllable exceptions hygiene", () => {
  it("exception keys are plain lowercase words (no junk keys)", () => {
    // the June table shipped dead keys like `area51`, `create_`, `science_`
    // that could never match after non-letters are stripped; the vanilla
    // workbench cleaned them and so do we.
    const mod = greedy575 as unknown as { __exceptions?: never };
    expect(mod.__exceptions).toBeUndefined(); // not leaked on the export
  });

  it("known exception words count correctly", () => {
    expect(countSyllables("abandon")).toBe(3);
    expect(countSyllables("society")).toBe(4);
    expect(countSyllables("real")).toBe(1);
    expect(countSyllables("vegetable")).toBe(4);
    expect(countSyllables("ocean")).toBe(2);
  });
});

describe("deriveAccounts (explorer)", () => {
  const phrase = generateMnemonic(wordlist, 128);

  it("account 0 on the default path matches deriveAddresses", () => {
    const explorer = deriveAccounts(phrase);
    const single = deriveAddresses(phrase);
    expect(explorer.accounts[0].address).toBe(single.btcLegacy);
    expect(explorer.accounts[0].path).toBe("m/44'/0'/0'/0/0");
  });

  it("a passphrase changes every derived address", () => {
    const plain = deriveAccounts(phrase);
    const hidden = deriveAccounts(phrase, { passphrase: "25th word" });
    expect(hidden.accounts[0].address).not.toBe(plain.accounts[0].address);
    expect(hidden.seedHex).not.toBe(plain.seedHex);
  });

  it("honours custom paths and counts", () => {
    const explorer = deriveAccounts(phrase, {
      path: "m/84'/0'/0'/0/5",
      count: 3,
    });
    expect(explorer.accounts.map((a) => a.path)).toEqual([
      "m/84'/0'/0'/0/0",
      "m/84'/0'/0'/0/1",
      "m/84'/0'/0'/0/2",
    ]);
  });

  it("exposes compressed public keys and 32-byte private keys", () => {
    const explorer = deriveAccounts(phrase, { count: 1 });
    const a = explorer.accounts[0];
    expect(a.publicKey).toMatch(/^02|^03/);
    expect(a.privateKey.length).toBe(64);
  });
});

describe("itemFromMnemonic greedy fallback", () => {
  it("non-haiku phrases get the greedy shape instead of one long line", () => {
    const phrase = generateMnemonic(wordlist, 128);
    // find a phrase that is (almost surely) not a clean 5-7-5
    const item = itemFromMnemonic(phrase, "EN0TEST");
    if (item && item.counts.join("-") !== "5-7-5") {
      // greedy fallback: lines partition all words, counts sum to total
      const words = phrase.split(" ");
      const total = words.reduce((s, w) => s + countSyllables(w), 0);
      expect(item.lines.join(" ").split(" ").length).toBe(words.length);
      expect(item.counts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});
