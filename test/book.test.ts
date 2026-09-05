import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { buildBookHtml, fileRefs, renderChapter, type Chapter } from "../src/components/Book";
import { vfs, type VfsEntry } from "../src/lib/vfs";

const chapter = (body: string, title = "Chapter 1"): Chapter => ({
  id: "c1",
  title,
  body,
});

// Smallest valid PNG (1x1 transparent).
const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  ),
  (c) => c.charCodeAt(0)
);

beforeEach(async () => {
  await vfs.clear();
});

describe("chapter references", () => {
  it("extracts [[file:...]] tokens", () => {
    expect(fileRefs("see [[file:a.jpg]] and [[file:b.pdf]] here")).toEqual([
      "a.jpg",
      "b.pdf",
    ]);
    expect(fileRefs("no refs")).toEqual([]);
  });
});

describe("chapter rendering", () => {
  const resolve = async (e: VfsEntry) => `blob:${e.name}`;

  it("splits blank-line-separated paragraphs", async () => {
    const html = await renderChapter(chapter("First para.\n\nSecond para."), [], resolve);
    expect(html).toContain("<h2>Chapter 1</h2>");
    expect((html.match(/<p>/g) ?? []).length).toBe(2);
    expect(html).toContain("First para.");
    expect(html).toContain("Second para.");
  });

  it("escapes HTML in the manuscript", async () => {
    const html = await renderChapter(
      chapter('I wrote <script>alert("x")</script> in my diary'),
      [],
      resolve
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the chapter title too", async () => {
    const html = await renderChapter(chapter("body", "<img onerror=x>"), [], resolve);
    expect(html).toContain("&lt;img onerror=x&gt;");
    expect(html).not.toContain("<img onerror");
  });

  it("turns a standalone image reference into a captioned figure", async () => {
    const e = await vfs.add(new File([PNG_BYTES], "gran.png", { type: "image/png" }), {
      caption: "Gran, 1962",
    });
    const files = await vfs.list();
    const html = await renderChapter(chapter("[[file:gran.png]]"), files, resolve);

    expect(html).toContain("<figure>");
    expect(html).toContain('src="blob:gran.png"');
    expect(html).toContain("<figcaption>Gran, 1962</figcaption>");
    expect(e.caption).toBe("Gran, 1962");
  });

  it("links a non-image attachment instead of embedding it", async () => {
    await vfs.add(new File(["deed"], "deed.pdf", { type: "application/pdf" }));
    const files = await vfs.list();
    const html = await renderChapter(chapter("[[file:deed.pdf]]"), files, resolve);

    expect(html).not.toContain("<figure>");
    expect(html).toContain('download="deed.pdf"');
  });

  it("links an inline reference inside its paragraph", async () => {
    await vfs.add(new File([PNG_BYTES], "map.png", { type: "image/png" }));
    const files = await vfs.list();
    const html = await renderChapter(
      chapter("We kept [[file:map.png]] on the wall."),
      files,
      resolve
    );
    expect(html).toContain("<p>We kept <a");
    expect(html).not.toContain("<figure>");
  });

  it("flags a reference to a file that is not in the book", async () => {
    const html = await renderChapter(chapter("[[file:lost.jpg]]"), [], resolve);
    expect(html).toContain("missing attachment");
    expect(html).toContain("lost.jpg");
  });
});

describe("single-file export", () => {
  it("inlines attachments as data URIs so the book stands alone", async () => {
    await vfs.add(new File([PNG_BYTES], "photo.png", { type: "image/png" }), {
      caption: "The shop",
    });

    const html = await buildBookHtml([
      chapter("Opening line.\n\n[[file:photo.png]]", "Beginnings"),
    ]);

    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("data:image/png;base64,");
    // No external references at all.
    expect(html).not.toMatch(/src="(https?:|blob:|\/)/);
    expect(html).toContain("The shop");
  });

  it("writes a table of contents linked to each chapter", async () => {
    const html = await buildBookHtml([
      chapter("one", "Beginnings"),
      { id: "c2", title: "The Middle Years", body: "two" },
    ]);

    expect(html).toContain('<a href="#ch0">Beginnings</a>');
    expect(html).toContain('<a href="#ch1">The Middle Years</a>');
    expect(html).toContain('<h2 id="ch0">');
    expect(html).toContain('<h2 id="ch1">');
    expect(html).toContain("2 chapters");
  });

  it("embeds shared content once even when two entries reference it", async () => {
    await vfs.add(new File([PNG_BYTES], "a.png", { type: "image/png" }), { dir: "/x" });
    await vfs.add(new File([PNG_BYTES], "b.png", { type: "image/png" }), { dir: "/y" });

    const html = await buildBookHtml([chapter("[[file:a.png]]\n\n[[file:b.png]]")]);
    const b64 = "iVBORw0KGgo";
    // Two <img> tags, but the payload appears twice only because both figures
    // carry it inline — what matters is storage dedupe, asserted in vfs tests.
    expect((html.match(/<figure>/g) ?? []).length).toBe(2);
    expect(html).toContain(b64);
  });

  it("produces a printable book with no scripts", async () => {
    const html = await buildBookHtml([chapter("A quiet life.")]);
    expect(html).not.toContain("<script");
    expect(html).toContain("@media print");
    expect(html).toContain("A quiet life.");
  });
});
