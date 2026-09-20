import { describe, expect, it } from "vitest";
import { haikuChapterBody, parseHaikuText } from "../src/lib/haikuImport";

describe("journal haiku import", () => {
  it("imports a three-line text entry and uses its filename as the title", () => {
    const poem = parseHaikuText("old pond\na frog jumps in\nsound of water", "pond.txt");
    expect(poem).toMatchObject({ title: "pond", lines: ["old pond", "a frog jumps in", "sound of water"] });
    expect(haikuChapterBody(poem!, "pond.txt")).toContain("[[file:pond.txt]]");
  });

  it("accepts a markdown heading and bullet lines", () => {
    const poem = parseHaikuText("# First snow\n\n- the gate is quiet\n- blue shadows gather\n- winter enters", "snow.md");
    expect(poem?.title).toBe("First snow");
    expect(poem?.body).toBe("the gate is quiet\nblue shadows gather\nwinter enters");
  });

  it("accepts the portable JSON shape", () => {
    const poem = parseHaikuText(JSON.stringify({ title: "Night ferry", lines: ["lamps cross the river", "one bell answers" , "dark water carries on"] }), "entry.json");
    expect(poem?.title).toBe("Night ferry");
    expect(poem?.lines).toHaveLength(3);
  });

  it("rejects files without three poem lines", () => {
    expect(parseHaikuText("just a note", "note.txt")).toBeNull();
  });
});
