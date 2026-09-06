import { describe, expect, it } from "vitest";
import { ARCHIVED_CODEBASES } from "../src/components/CodebaseWorkbench";
import {
  GEN2_POETRY_PATCH_SIGNATURES,
  patchGen2Poetry,
} from "../src/lib/poetryPatch";
import { checkHaiku, countSyllables } from "../src/lib/syllables";

const five = "wind stone leaf moon rain";
const seven = "wind stone leaf moon rain cloud frost";
const four = "wind stone leaf moon";
const six = "wind stone leaf moon rain cloud";

describe("strict Poetry syllable validation", () => {
  it("accepts exactly 5-7-5 and rejects a third line over or under by one", () => {
    expect(checkHaiku([five, seven, five])).toEqual({ counts: [5, 7, 5], valid: true });
    expect(checkHaiku([five, seven, four])).toEqual({ counts: [5, 7, 4], valid: false });
    expect(checkHaiku([five, seven, six])).toEqual({ counts: [5, 7, 6], valid: false });
  });

  it("uses validator pronunciations for words the old Poetry heuristic miscounted", () => {
    expect(countSyllables("little")).toBe(2);
    expect(countSyllables("temple")).toBe(2);
    expect(countSyllables("poetry")).toBe(3);
    expect(countSyllables("changes")).toBe(2);
    expect(countSyllables("hototogisu")).toBe(5);
    expect(countSyllables("winter-peony")).toBe(5);
  });

  it("injects the same corrected counter into the compiled Gen2 application", () => {
    const evaluate = new Function(`${GEN2_POETRY_PATCH_SIGNATURES.fixedCounter};return hr;`) as () => (
      word: string,
    ) => number;
    const bundledCounter = evaluate();

    for (const word of ["little", "temple", "poetry", "changes", "hototogisu", "winter-peony"]) {
      expect(bundledCounter(word), word).toBe(countSyllables(word));
    }
  });

  it("replaces only the known broken counter and line builder", () => {
    const canonical = ARCHIVED_CODEBASES.find(({ id }) => id === "gen2");
    expect(canonical).toBeDefined();
    expect(canonical!.originalHtml).toContain(GEN2_POETRY_PATCH_SIGNATURES.brokenCounter);
    expect(canonical!.originalHtml).toContain(GEN2_POETRY_PATCH_SIGNATURES.brokenLineBuilder);
    expect(canonical!.html).toContain(GEN2_POETRY_PATCH_SIGNATURES.strictValidator);
    expect(GEN2_POETRY_PATCH_SIGNATURES.strictValidator).toContain("t[l]!==a[l]");
    expect(canonical!.html).not.toContain(GEN2_POETRY_PATCH_SIGNATURES.brokenCounter);
    expect(canonical!.html).not.toContain(GEN2_POETRY_PATCH_SIGNATURES.brokenLineBuilder);
    expect(canonical!.html).toContain(GEN2_POETRY_PATCH_SIGNATURES.fixedCounter);
    expect(canonical!.html).toContain(GEN2_POETRY_PATCH_SIGNATURES.fixedLineBuilder);
    expect(() => patchGen2Poetry(canonical!.html)).toThrow(/signature is missing/);
  });

  it("makes the bundled line builder fill every requested syllable exactly", () => {
    const evaluate = new Function(`
      const we={noun:["beautiful","wind"],verb:["changes","rain"],adjective:["poetry","cold"]};
      const sS=[0,2],oR=["ya"],J=(_rng,items)=>items[0],rS=()=>"wind";
      function lR(){return 2}
      ${GEN2_POETRY_PATCH_SIGNATURES.fixedCounter}
      ${GEN2_POETRY_PATCH_SIGNATURES.fixedLineBuilder}
      return ig;
    `) as () => (rng: () => number, target: number, options?: Record<string, unknown>) => { total: number };
    const buildLine = evaluate();

    for (const target of [1, 2, 3, 5, 7]) {
      expect(buildLine(() => 0, target).total).toBe(target);
    }
    expect(buildLine(() => 0, 3, { kigo: "hototogisu" }).total).toBe(3);
  });
});
