import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  ACCESSORIES,
  CATEGORY_ODDS,
  CATEGORY_TOTAL,
  type Category,
} from "../src/lib/monkey/accessories";
import MonkeyAvatar, { officialMonkeyUrl } from "../src/components/MonkeyAvatar";

/**
 * Ground truth taken from appditto/MonKey (MIT-licensed code and asset
 * filenames — no artwork is copied):
 *   server/image/accessories.go   -> category chances
 *   server/assets/.../accessories -> per-item [w-N] weights
 */
const REAL_CATEGORY_CHANCE: Record<Category, number> = {
  glasses: 0.25,
  hat: 0.35,
  misc: 0.3,
  shirt_and_pants: 0.25,
  shoes: 0.22,
  tail: 0.2,
  mouth: 1, // no mouthChance in the Go source: a mouth is always drawn
};

const REAL_ITEM_COUNT: Record<Category, number> = {
  glasses: 9,
  hat: 25,
  misc: 13,
  mouth: 8,
  shirt_and_pants: 6,
  shoes: 6,
  tail: 1,
};

const REAL_WEIGHT_SUM: Record<Category, number> = {
  glasses: 8,
  hat: 19.4,
  misc: 11.29,
  mouth: 5.56,
  shirt_and_pants: 6,
  shoes: 6,
  tail: 1,
};

const CATEGORIES = Object.keys(REAL_CATEGORY_CHANCE) as Category[];

describe("catalog matches appditto/MonKey", () => {
  it("uses the same category chances as the Go source", () => {
    expect(CATEGORY_ODDS).toEqual(REAL_CATEGORY_CHANCE);
  });

  it("declares the real per-category weight totals", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_TOTAL[c]).toBeCloseTo(REAL_WEIGHT_SUM[c], 6);
    }
  });

  it("is complete — all 68 accessories, none missing", () => {
    expect(ACCESSORIES).toHaveLength(68);
    for (const c of CATEGORIES) {
      const items = ACCESSORIES.filter((a) => a.category === c);
      expect(items, `count for ${c}`).toHaveLength(REAL_ITEM_COUNT[c]);
    }
  });

  it("allocates every category's weight exactly, leaving no unreachable mass", () => {
    for (const c of CATEGORIES) {
      const sum = ACCESSORIES.filter((a) => a.category === c).reduce(
        (t, a) => t + a.weight,
        0
      );
      // Equal to CATEGORY_TOTAL => the "plain" remainder bucket is now empty,
      // so every accessory in the catalog is actually mineable.
      expect(sum, `weight sum for ${c}`).toBeCloseTo(CATEGORY_TOTAL[c], 6);
    }
  });

  it("has unique ids and no match string shadowing another accessory", () => {
    const ids = ACCESSORIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Within a category, a match must not be a substring of a sibling's match,
    // which would make the sibling unidentifiable from an API filename.
    for (const c of CATEGORIES) {
      const items = ACCESSORIES.filter((a) => a.category === c);
      for (const a of items) {
        for (const b of items) {
          if (a.id === b.id) continue;
          expect(
            b.match.toLowerCase().includes(a.match.toLowerCase()),
            `${a.id} ("${a.match}") shadows ${b.id} ("${b.match}")`
          ).toBe(false);
        }
      }
    }
  });
});

describe("MonkeyAvatar", () => {
  const ADDR = "ban_1bananobh5rat99qfgt1ptpieie5swmoth1p1jayjjbss1hjm9fh1x3ig6hb";

  it("builds an official URL against the public endpoint", () => {
    const url = officialMonkeyUrl(ADDR, 200);
    expect(url.startsWith("https://monkey.banano.cc/api/v1/monkey/")).toBe(true);
    expect(url).toContain("format=svg");
    expect(url).toContain("size=200");
  });

  it("clamps the requested size to what the service accepts", () => {
    expect(officialMonkeyUrl(ADDR, 5)).toContain("size=100");
    expect(officialMonkeyUrl(ADDR, 99999)).toContain("size=1000");
  });

  it("draws locally in offline mode and issues no network request", () => {
    const { container } = render(
      <MonkeyAvatar address={ADDR} mode="offline" size={80} />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders an <img> in official mode", () => {
    render(<MonkeyAvatar address={ADDR} mode="official" size={80} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("monkey.banano.cc");
  });

  it("falls back to the local drawing when the service is unreachable", () => {
    const { container } = render(
      <MonkeyAvatar address={ADDR} mode="official" size={80} />
    );
    const img = container.querySelector("img")!;
    // jsdom never loads images; simulate the failure the browser would report.
    act(() => {
      fireEvent.error(img);
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
