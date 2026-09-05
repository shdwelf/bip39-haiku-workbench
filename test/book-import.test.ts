import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  GENEALOGY,
  genealogyChapterBody,
  importVaultJson,
  servedPath,
} from "../src/lib/bookImport";
import { fileRefs } from "../src/components/Book";
import { vfs } from "../src/lib/vfs";

beforeEach(async () => {
  await vfs.clear();
});

describe("vault recovery", () => {
  // Exactly the shape greeran-book.js writes to greeran-book-vault-v1.
  const VAULT = JSON.stringify({
    version: 1,
    files: {
      "/chapters/00-premise.md": "# Premise\n\nTwo source classes.",
      "/chapters/01-southern-california-trail.md": "# Southern California trail",
      "/settings/style.json": '{"tone":"plain"}',
    },
  });

  it("recovers every file, preserving its path under /vault", async () => {
    const res = await importVaultJson(VAULT);
    expect(res.added).toBe(3);

    const all = await vfs.list();
    expect(all.map((e) => `${e.dir}/${e.name}`).sort()).toEqual([
      "/vault/chapters/00-premise.md",
      "/vault/chapters/01-southern-california-trail.md",
      "/vault/settings/style.json",
    ]);
  });

  it("keeps the text intact", async () => {
    await importVaultJson(VAULT);
    const premise = (await vfs.list("/vault/chapters")).find(
      (e) => e.name === "00-premise.md"
    )!;
    expect(await vfs.readText(premise.id)).toBe("# Premise\n\nTwo source classes.");
  });

  it("notes where each file came from", async () => {
    await importVaultJson(VAULT);
    const e = (await vfs.list("/vault/settings"))[0];
    expect(e.caption).toContain("/settings/style.json");
  });

  it("is safe to run twice — no duplicates", async () => {
    await importVaultJson(VAULT);
    const second = await importVaultJson(VAULT);
    expect(second.added).toBe(0);
    expect(second.skipped).toBe(3);
    expect(await vfs.list()).toHaveLength(3);
  });

  it("explains itself when handed the wrong file", async () => {
    await expect(importVaultJson("not json at all")).rejects.toThrow(/not valid JSON/);
    await expect(importVaultJson('{"nope":1}')).rejects.toThrow(
      /greeran-book-vault-v1/
    );
  });

  it("tags markdown and json by type", async () => {
    await importVaultJson(VAULT);
    const all = await vfs.list();
    expect(all.find((e) => e.name.endsWith(".md"))!.type).toBe("text/markdown");
    expect(all.find((e) => e.name.endsWith(".json"))!.type).toBe("application/json");
  });
});

describe("genealogy as attachments", () => {
  it("cites every document rather than reprinting it", () => {
    const body = genealogyChapterBody();
    const refs = fileRefs(body);
    expect(refs.sort()).toEqual(GENEALOGY.map((d) => d.name).sort());
    // Each reference sits alone on its line, so it renders as a figure/link.
    for (const d of GENEALOGY) {
      expect(body).toContain(`\n[[file:${d.name}]]\n`);
    }
  });

  it("covers the three documents that were asked for", () => {
    const names = GENEALOGY.map((d) => d.title);
    expect(names).toContain("Seize Quartiers");
    expect(names).toContain("Family Tree");
    expect(names).toContain("Military Service Map");
  });
});

describe("served paths", () => {
  it("maps a filed attachment to a URL under /book-fs/", async () => {
    const e = await vfs.add(new File(["x"], "family-tree.html", { type: "text/html" }), {
      dir: "/genealogy",
    });
    expect(servedPath(e)).toBe("/book-fs/genealogy/family-tree.html");
  });

  it("handles the root folder and escapes awkward names", async () => {
    const root = await vfs.add(new File(["x"], "note.txt"), { dir: "/" });
    expect(servedPath(root)).toBe("/book-fs/note.txt");

    const spaced = await vfs.add(new File(["x"], "gran 1962.jpg"), { dir: "/photos" });
    expect(servedPath(spaced)).toBe("/book-fs/photos/gran%201962.jpg");
  });
});

/**
 * The path rules carried over from micro_httpd. Mirrors safePath() in
 * public/book-sw.js — a Service Worker cannot be imported here, so the rule is
 * restated and pinned.
 */
function safePath(pathname: string): string | null {
  const ROOT = "/book-fs/";
  let p: string;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const out: string[] = [];
  for (const part of p.slice(ROOT.length).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return null;
    if (part.includes("\0")) return null;
    out.push(part);
  }
  return "/" + out.join("/");
}

describe("micro_httpd path safety", () => {
  it("refuses '..' snooping outright", () => {
    expect(safePath("/book-fs/../secret")).toBeNull();
    expect(safePath("/book-fs/photos/../../etc/passwd")).toBeNull();
    // …including percent-encoded, which is decoded before the check.
    expect(safePath("/book-fs/%2e%2e/secret")).toBeNull();
  });

  it("refuses NUL-byte truncation tricks", () => {
    expect(safePath("/book-fs/ok%00.png")).toBeNull();
  });

  it("refuses malformed percent-encoding rather than guessing", () => {
    expect(safePath("/book-fs/%zz")).toBeNull();
  });

  it("normalises harmless paths", () => {
    expect(safePath("/book-fs/")).toBe("/");
    expect(safePath("/book-fs/photos//1962/")).toBe("/photos/1962");
    expect(safePath("/book-fs/./photos/./a.jpg")).toBe("/photos/a.jpg");
  });
});
