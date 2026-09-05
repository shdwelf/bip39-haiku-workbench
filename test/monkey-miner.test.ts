import { describe, expect, it } from "vitest";
import { wallet } from "bananocurrency-web";
import { accessoriesFor, monkeySvg } from "../src/lib/monkey/generate";
import { ACCESSORIES, probability } from "../src/lib/monkey/accessories";

describe("MonKey miner end-to-end (offline)", () => {
  it("generates valid Banano addresses", () => {
    const w = wallet.generateLegacy();
    const acct = wallet.legacyAccounts(w.seed, 0, 0)[0];
    expect(w.seed).toMatch(/^[0-9a-fA-F]{64}$/);
    expect(acct.address).toMatch(/^ban_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/);
    expect(acct.privateKey).toMatch(/^[0-9a-fA-F]{64}$/);
  });

  it("actually finds a target accessory by mining", () => {
    // Cyan Tie: weight 1 of 11.29 misc, 30% category odds => ~1 in 38.
    const target = ACCESSORIES.find((a) => a.id === "tie-cyan")!;
    let checked = 0;
    let hit: string | null = null;

    while (checked < 20000 && !hit) {
      const w = wallet.generateLegacy();
      const acct = wallet.legacyAccounts(w.seed, 0, 0)[0];
      checked++;
      if (accessoriesFor(acct.address).some((a) => a.id === target.id)) {
        hit = acct.address;
      }
    }

    expect(hit).not.toBeNull();
    // The winning address must still carry it when re-derived.
    expect(accessoriesFor(hit!).map((a) => a.id)).toContain(target.id);
    // Found well inside the statistically expected window.
    expect(checked).toBeLessThan(1 / probability(target) * 40);
  });

  it("renders an SVG that contains the rolled accessories", () => {
    // Find an address wearing a crown and confirm the drawing changes.
    let crowned: string | null = null;
    for (let i = 0; i < 20000 && !crowned; i++) {
      const addr = "ban_probe_" + i;
      if (accessoriesFor(addr).some((a) => a.id === "crown")) crowned = addr;
    }
    expect(crowned).not.toBeNull();

    const svg = monkeySvg(crowned!);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("#fbbf24"); // crown gold
    // A plain monKey should not draw the crown.
    const plain = monkeySvg("ban_definitely_not_crowned_xyz");
    expect(plain).not.toBe(svg);
  });
});
