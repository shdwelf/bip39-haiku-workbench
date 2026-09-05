import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/lib/catalog";
import { validateMnemonic } from "../src/lib/wallet";
import { greedy575 } from "../src/lib/syllables";

describe("art catalog", () => {
  it("has 100 unique entries", () => {
    expect(CATALOG.length).toBe(100);
    expect(new Set(CATALOG.map((c) => c.text)).size).toBe(100);
  });

  it("every entry is a checksum-valid BIP-39 phrase", () => {
    for (const entry of CATALOG) {
      expect(validateMnemonic(entry.text.toLowerCase())).toBe(true);
    }
  });

  it("entry type matches the word count", () => {
    for (const entry of CATALOG) {
      const n = entry.text.trim().split(/\s+/).length;
      const want = entry.type.startsWith("11 / 12")
        ? 12
        : entry.type.startsWith("14 / 15")
          ? 15
          : entry.type.startsWith("23 / 24")
            ? 24
            : entry.type.includes("haiku")
              ? 12
              : -1;
      expect(n).toBe(want);
    }
  });

  it("repeat patterns actually repeat their stem word", () => {
    const repeat = CATALOG.filter((c) => /repeated/i.test(c.pattern));
    expect(repeat.length).toBeGreaterThan(30);
    for (const entry of repeat) {
      const words = entry.text.toLowerCase().split(" ");
      const stem = words[0];
      const n = words.length;
      // every word except the checksum word is the stem
      expect(words.slice(0, n - 1).every((w) => w === stem)).toBe(true);
    }
  });

  it("haiku/poetic entries lay out across three lines covering every word", () => {
    const haiku = CATALOG.filter((c) => c.type.includes("haiku"));
    expect(haiku.length).toBe(30);
    for (const entry of haiku) {
      const words = entry.text.toLowerCase().split(" ");
      const shape = greedy575(words);
      // the greedy layout never drops or duplicates a word
      expect(shape.lines.flat()).toEqual(words);
      expect(shape.lines.filter((l) => l.length > 0).length).toBeGreaterThanOrEqual(2);
    }
  });
});
