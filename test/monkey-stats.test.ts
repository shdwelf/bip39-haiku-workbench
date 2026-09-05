import { describe, expect, it } from "vitest";
import { accessoriesFor, monkeySvg } from "../src/lib/monkey/generate";
import { ACCESSORIES, probability, oneInN, rarityTier } from "../src/lib/monkey/accessories";

const N = 300000;
const counts: Record<string, number> = {};
for (let i = 0; i < N; i++) {
  for (const a of accessoriesFor("ban_test_address_" + i)) counts[a.id] = (counts[a.id] ?? 0) + 1;
}

describe("offline MonKey sampling", () => {
  it("is deterministic per address", () => {
    const a = accessoriesFor("ban_1abc").map((x) => x.id);
    const b = accessoriesFor("ban_1abc").map((x) => x.id);
    expect(a).toEqual(b);
    expect(monkeySvg("ban_1abc")).toBe(monkeySvg("ban_1abc"));
  });

  it("differs across addresses", () => {
    const svgs = new Set([0,1,2,3,4,5].map((i) => monkeySvg("ban_addr" + i)));
    expect(svgs.size).toBeGreaterThan(1);
  });

  it("matches the published probability for every catalog accessory", () => {
    const bad: string[] = [];
    for (const a of ACCESSORIES) {
      const expected = probability(a);
      const observed = (counts[a.id] ?? 0) / N;
      // 4-sigma binomial tolerance, floored for very rare items
      const sigma = Math.sqrt((expected * (1 - expected)) / N);
      const tol = Math.max(4 * sigma, expected * 0.06);
      if (Math.abs(observed - expected) > tol) {
        bad.push(`${a.id}: expected ${expected.toExponential(2)} got ${observed.toExponential(2)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("keeps the flamethrower the rarest item in the catalog", () => {
    const flame = ACCESSORIES.find((a) => a.id === "flamethrower")!;
    // (0.04 / 11.29) * 0.3 => roughly 1 in 941, the Epic tier.
    expect(oneInN(flame)).toBe(941);
    expect(rarityTier(probability(flame)).label).toBe("Epic");

    // Nothing in the catalog is rarer.
    const rarest = ACCESSORIES.reduce((a, b) => (probability(a) <= probability(b) ? a : b));
    expect(rarest.id).toBe("flamethrower");

    // And it really is that rare when mined.
    const observed = (counts["flamethrower"] ?? 0) / N;
    expect(observed).toBeGreaterThan(probability(flame) * 0.5);
    expect(observed).toBeLessThan(probability(flame) * 1.5);
  });
});
