import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { BookVfs, humanSize, normaliseDir, sha256Hex } from "../src/lib/vfs";

function file(name: string, body: string, type = "text/plain") {
  return new File([body], name, { type });
}

let vfs: BookVfs;

beforeEach(async () => {
  vfs = new BookVfs();
  await vfs.clear();
});

describe("book filesystem", () => {
  it("stores a file and reads the bytes back", async () => {
    const e = await vfs.add(file("letter.txt", "dear reader"), { dir: "/letters" });
    expect(e.name).toBe("letter.txt");
    expect(e.dir).toBe("/letters");
    expect(e.size).toBe("dear reader".length);

    const blob = await vfs.read(e.id);
    expect(blob).not.toBeNull();
    expect(await blob!.text()).toBe("dear reader");
  });

  it("normalises messy folder paths", () => {
    expect(normaliseDir("photos")).toBe("/photos");
    expect(normaliseDir("/photos/")).toBe("/photos");
    expect(normaliseDir("//photos//1985//")).toBe("/photos/1985");
    expect(normaliseDir("/")).toBe("/");
    expect(normaliseDir("")).toBe("/");
  });

  it("addresses content by SHA-256", async () => {
    const e = await vfs.add(file("a.txt", "same bytes"));
    const expected = await sha256Hex(
      new TextEncoder().encode("same bytes").buffer as ArrayBuffer
    );
    expect(e.hash).toBe(expected);
  });

  it("stores identical content once but keeps both entries", async () => {
    const a = await vfs.add(file("scan.txt", "identical"), { dir: "/a" });
    const b = await vfs.add(file("copy.txt", "identical"), { dir: "/b" });

    expect(a.hash).toBe(b.hash);
    expect(a.id).not.toBe(b.id);

    const usage = await vfs.usage();
    expect(usage.entries).toBe(2);
    expect(usage.unique).toBe(1); // deduped
    expect(usage.bytes).toBe("identical".length);

    // Both still readable.
    expect(await (await vfs.read(a.id))!.text()).toBe("identical");
    expect(await (await vfs.read(b.id))!.text()).toBe("identical");
  });

  it("keeps shared bytes alive when one of two references is removed", async () => {
    const a = await vfs.add(file("one.txt", "shared"));
    const b = await vfs.add(file("two.txt", "shared"));

    await vfs.remove(a.id);

    // Regression guard: naive delete-by-hash would orphan `b`.
    expect(await vfs.get(a.id)).toBeUndefined();
    expect(await (await vfs.read(b.id))!.text()).toBe("shared");
  });

  it("drops the bytes once the last reference goes", async () => {
    const a = await vfs.add(file("only.txt", "unique content"));
    await vfs.remove(a.id);

    const usage = await vfs.usage();
    expect(usage.entries).toBe(0);
    expect(usage.unique).toBe(0);
    expect(usage.bytes).toBe(0);
  });

  it("lists by folder, newest first", async () => {
    await vfs.add(file("1.txt", "one"), { dir: "/photos" });
    await new Promise((r) => setTimeout(r, 2));
    await vfs.add(file("2.txt", "two"), { dir: "/photos" });
    await vfs.add(file("3.txt", "three"), { dir: "/docs" });

    const photos = await vfs.list("/photos");
    expect(photos.map((e) => e.name)).toEqual(["2.txt", "1.txt"]);
    expect(await vfs.list("/docs")).toHaveLength(1);
    expect(await vfs.list()).toHaveLength(3);
  });

  it("renames, re-files and captions an entry", async () => {
    const e = await vfs.add(file("DSC001.jpg", "bytes", "image/jpeg"));
    const updated = await vfs.update(e.id, {
      name: "grandad-1962.jpg",
      dir: "photos/1962/",
      caption: "Grandad outside the shop",
    });

    expect(updated!.name).toBe("grandad-1962.jpg");
    expect(updated!.dir).toBe("/photos/1962"); // normalised
    expect(updated!.caption).toBe("Grandad outside the shop");
    // Content is untouched by metadata edits.
    expect(updated!.hash).toBe(e.hash);
    expect(await (await vfs.read(e.id))!.text()).toBe("bytes");
  });

  it("reports the folders in use", async () => {
    await vfs.add(file("a", "1"), { dir: "/photos" });
    await vfs.add(file("b", "2"), { dir: "/letters" });
    await vfs.add(file("c", "3"), { dir: "/photos" });
    expect(await vfs.dirs()).toEqual(["/letters", "/photos"]);
  });

  it("returns null for a missing entry rather than throwing", async () => {
    expect(await vfs.read("nope")).toBeNull();
    expect(await vfs.get("nope")).toBeUndefined();
    await expect(vfs.remove("nope")).resolves.toBeUndefined();
  });

  it("survives a reopen — data is persistent, not in-memory", async () => {
    const e = await vfs.add(file("persist.txt", "still here"), { dir: "/x" });

    // A brand new instance opens the same IndexedDB database.
    const reopened = new BookVfs();
    const found = await reopened.get(e.id);
    expect(found?.name).toBe("persist.txt");
    expect(await (await reopened.read(e.id))!.text()).toBe("still here");
  });

  it("formats sizes for display", () => {
    expect(humanSize(512)).toBe("512 B");
    expect(humanSize(2048)).toBe("2.0 KB");
    expect(humanSize(5 * 1048576)).toBe("5.00 MB");
  });
});
