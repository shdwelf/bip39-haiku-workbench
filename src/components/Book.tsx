import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  humanSize,
  isImage,
  isText,
  vfs,
  type VfsEntry,
} from "../lib/vfs";
import { usePersistentState } from "../shell/hooks";
import Collapsible from "../shell/Collapsible";
import { PipeOutButton } from "../pipe/PipeButtons";
import { usePipeReceiver } from "../pipe/PipeProvider";
import {
  canServe,
  FS_ROOT,
  genealogyChapterBody,
  importGenealogy,
  importVaultJson,
  serverRunning,
  servedPath,
  startServer,
  stopServer,
} from "../lib/bookImport";

const TOOL_ID = "book";
const TOOL_NAME = "Autobiography";

export interface Chapter {
  id: string;
  title: string;
  body: string;
}

const STARTER: Chapter[] = [
  {
    id: "ch-1",
    title: "Chapter 1",
    body:
      "Start writing here.\n\n" +
      "Attach a photograph or a document in the Files panel below, then press " +
      "“Insert” to drop a reference into whichever chapter you are editing. " +
      "References look like [[file:NAME]] and are resolved when you preview or " +
      "export the book.",
  },
];

function newId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto)
      return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `ch-${Date.now().toString(36)}`;
}

/** Chapter text may reference attachments as [[file:name]]. */
export function fileRefs(body: string): string[] {
  return [...body.matchAll(/\[\[file:([^\]]+)\]\]/g)].map((m) => m[1].trim());
}

export default function Book() {
  const [chapters, setChapters] = usePersistentState<Chapter[]>(
    "bhw.book.chapters",
    STARTER
  );
  const [activeId, setActiveId] = usePersistentState<string>(
    "bhw.book.active",
    STARTER[0].id
  );
  const [files, setFiles] = useState<VfsEntry[]>([]);
  const [dir, setDir] = useState("/");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const vaultInput = useRef<HTMLInputElement>(null);
  const [serving, setServing] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const active = chapters.find((c) => c.id === activeId) ?? chapters[0];

  const refresh = useCallback(async () => {
    setFiles(await vfs.list());
  }, []);

  useEffect(() => {
    void refresh();
    void serverRunning().then(setServing);
  }, [refresh]);

  // Anything piped at the book becomes a text attachment.
  usePipeReceiver(TOOL_ID, (d) => {
    const name = `${d.contentType}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    void (async () => {
      await vfs.add(new File([d.content], name, { type: "text/plain" }), {
        dir: "/piped",
        caption: `Piped from ${d.sourceName}`,
      });
      await refresh();
      setBusy(`Filed ${name} under /piped`);
      window.setTimeout(() => setBusy(null), 2600);
    })();
  });

  const dirs = useMemo(
    () => ["/", ...new Set(files.map((f) => f.dir).filter((d) => d !== "/"))].sort(),
    [files]
  );
  const shown = dir === "/" ? files : files.filter((f) => f.dir === dir);

  const patchChapter = (id: string, patch: Partial<Chapter>) =>
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const addChapter = () => {
    const c: Chapter = {
      id: newId(),
      title: `Chapter ${chapters.length + 1}`,
      body: "",
    };
    setChapters((prev) => [...prev, c]);
    setActiveId(c.id);
  };

  const removeChapter = (id: string) => {
    if (chapters.length === 1) return;
    if (!confirm("Delete this chapter?")) return;
    setChapters((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const move = (id: string, delta: number) =>
    setChapters((prev) => {
      const i = prev.findIndex((c) => c.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const onUpload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(`Filing ${list.length} item${list.length === 1 ? "" : "s"}…`);
    for (const f of Array.from(list)) {
      await vfs.add(f, { dir: dir === "/" ? "/attachments" : dir });
    }
    await refresh();
    setBusy(null);
  };

  /** Insert a [[file:…]] reference at the caret of the chapter body. */
  const insertRef = (entry: VfsEntry) => {
    const token = `[[file:${entry.name}]]`;
    const ta = bodyRef.current;
    if (!ta) {
      patchChapter(active.id, { body: `${active.body}\n${token}\n` });
      return;
    }
    const start = ta.selectionStart ?? active.body.length;
    const end = ta.selectionEnd ?? start;
    const next = active.body.slice(0, start) + token + active.body.slice(end);
    patchChapter(active.id, { body: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    });
  };

  const onImportVault = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setBusy("Reading vault export…");
    try {
      const res = await importVaultJson(await f.text());
      await refresh();
      setBusy(
        `Recovered ${res.added} file${res.added === 1 ? "" : "s"} into /vault` +
          (res.skipped ? ` · ${res.skipped} already present` : "")
      );
    } catch (e) {
      setBusy((e as Error).message);
    }
    window.setTimeout(() => setBusy(null), 6000);
  };

  const onImportGenealogy = async () => {
    setBusy("Filing the research documents…");
    try {
      const res = await importGenealogy();
      await refresh();
      if (res.added > 0 && !chapters.some((c) => c.title === "The research file")) {
        setChapters((prev) => [
          ...prev,
          { id: newId(), title: "The research file", body: genealogyChapterBody() },
        ]);
      }
      setBusy(
        `Filed ${res.added} document${res.added === 1 ? "" : "s"} under /genealogy` +
          (res.skipped ? ` · ${res.skipped} already present` : "")
      );
    } catch (e) {
      setBusy((e as Error).message);
    }
    window.setTimeout(() => setBusy(null), 6000);
  };

  const toggleServer = async () => {
    try {
      if (serving) {
        await stopServer();
        setServing(false);
        setBusy("Filesystem server stopped.");
      } else {
        await startServer();
        setServing(true);
        setBusy(`Serving the filesystem at ${FS_ROOT}`);
      }
    } catch (e) {
      setBusy((e as Error).message);
    }
    window.setTimeout(() => setBusy(null), 6000);
  };

  const exportBook = async () => {
    setBusy("Building single-file book…");
    try {
      const html = await buildBookHtml(chapters);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "autobiography.html";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 0);
      setBusy(`Exported ${humanSize(blob.size)}`);
      window.setTimeout(() => setBusy(null), 3000);
    } catch (e) {
      setBusy(`Export failed: ${(e as Error).message}`);
    }
  };

  const missing = useMemo(() => {
    const names = new Set(files.map((f) => f.name));
    const out = new Set<string>();
    for (const c of chapters)
      for (const r of fileRefs(c.body)) if (!names.has(r)) out.add(r);
    return [...out];
  }, [chapters, files]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">📖 {TOOL_NAME}</h2>
            <p className="text-[11px] text-zinc-500">
              Chapters plus an embedded filesystem. Everything is stored locally
              and exports as one self-contained HTML file.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPreview((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-xs transition ${
                preview
                  ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {preview ? "✎ Edit" : "👁 Preview"}
            </button>
            <button
              onClick={exportBook}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-cyan-400"
            >
              ⬇ Export book
            </button>
          </div>
        </div>
        {busy && (
          <p className="mt-2 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300">
            {busy}
          </p>
        )}
        {missing.length > 0 && (
          <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
            Referenced but not in the filesystem: {missing.join(", ")}
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Collapsible storageKey="bhw.book.toc" title="Contents" icon="🗂" className="h-fit">
          <div className="space-y-1">
            {chapters.map((c, i) => (
              <div key={c.id} className="flex items-center gap-1">
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-xs transition ${
                    c.id === active.id
                      ? "bg-cyan-500 font-semibold text-zinc-950"
                      : "text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {i + 1}. {c.title || "Untitled"}
                </button>
                <button
                  onClick={() => move(c.id, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${c.title} up`}
                  className="rounded px-1 text-[10px] text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(c.id, 1)}
                  disabled={i === chapters.length - 1}
                  aria-label={`Move ${c.title} down`}
                  className="rounded px-1 text-[10px] text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            ))}
            <button
              onClick={addChapter}
              className="mt-2 w-full rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
            >
              + Add chapter
            </button>
          </div>
        </Collapsible>

        <div className="space-y-4">
          {preview ? (
            <ChapterPreview chapter={active} files={files} />
          ) : (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={active.title}
                  onChange={(e) => patchChapter(active.id, { title: e.target.value })}
                  aria-label="Chapter title"
                  className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none focus:border-cyan-600"
                />
                <PipeOutButton
                  compact
                  draft={{
                    content: `${active.title}\n\n${active.body}`,
                    contentType: "text",
                    sourceId: TOOL_ID,
                    sourceName: TOOL_NAME,
                    label: active.title || "chapter",
                  }}
                />
                <button
                  onClick={() => removeChapter(active.id)}
                  disabled={chapters.length === 1}
                  className="rounded border border-rose-900 px-2 py-1.5 text-xs text-rose-300 transition hover:bg-rose-950/40 disabled:opacity-30"
                >
                  Delete
                </button>
              </div>
              <textarea
                ref={bodyRef}
                value={active.body}
                onChange={(e) => patchChapter(active.id, { body: e.target.value })}
                aria-label="Chapter text"
                rows={18}
                spellCheck
                className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-serif text-sm leading-relaxed text-zinc-200 outline-none focus:border-cyan-600"
              />
              <p className="mt-1 text-[10px] text-zinc-600">
                {active.body.trim() ? active.body.trim().split(/\s+/).length : 0} words
                · blank line starts a new paragraph · [[file:name]] embeds an
                attachment
              </p>
            </section>
          )}

          <Collapsible
            storageKey="bhw.book.import"
            title="Import & serve"
            icon="🗄"
            subtitle={serving ? `serving at ${FS_ROOT}` : "not serving"}
          >
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-zinc-200">
                  Recover the original book vault
                </p>
                <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
                  The old book kept drafts in <code>localStorage</code> under{" "}
                  <code className="text-cyan-400">greeran-book-vault-v1</code>, which
                  is per-origin — open the book from the origin you wrote on, press
                  its <em>Export vault</em> button, then load the JSON here.
                </p>
                <input
                  ref={vaultInput}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    void onImportVault(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => vaultInput.current?.click()}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700"
                >
                  ⬆ Import vault JSON
                </button>
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <p className="mb-1 text-xs font-semibold text-zinc-200">
                  Genealogy research
                </p>
                <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
                  Files the Seize Quartiers, family tree, service map and
                  bibliography under <code>/genealogy</code> as attachments, and adds
                  a chapter that cites each one rather than reprinting it.
                </p>
                <button
                  onClick={onImportGenealogy}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700"
                >
                  📚 File the research documents
                </button>
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <p className="mb-1 text-xs font-semibold text-zinc-200">
                  Serve the filesystem
                </p>
                <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
                  A port of ACME Labs&rsquo; <code>micro_httpd</code> to a Service
                  Worker: attachments get real URLs under{" "}
                  <code className="text-cyan-400">{FS_ROOT}</code> instead of
                  temporary blob handles, with directory listings, index.html and
                  &ldquo;..&rdquo; protection. Needs a secure origin — this is the
                  same reason a page opened from <code>file://</code> gets no
                  microphone.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={toggleServer}
                    disabled={!canServe() && !serving}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                      serving
                        ? "bg-rose-600 text-white hover:bg-rose-500"
                        : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                    }`}
                  >
                    {serving ? "■ Stop serving" : "▶ Start serving"}
                  </button>
                  {serving && (
                    <a
                      href={FS_ROOT}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-cyan-300 transition hover:bg-zinc-800"
                    >
                      ↗ Browse {FS_ROOT}
                    </a>
                  )}
                  {!canServe() && (
                    <span className="text-[11px] text-amber-400">
                      Not a secure context — serving unavailable here.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Collapsible>

          <Collapsible
            storageKey="bhw.book.files"
            title="Files"
            icon="📎"
            subtitle={`${files.length} in the book`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                multiple
                onChange={(e) => {
                  void onUpload(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInput.current?.click()}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700"
              >
                📁 Add files
              </button>
              <select
                value={dir}
                onChange={(e) => setDir(e.target.value)}
                aria-label="Folder"
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300"
              >
                {dirs.map((d) => (
                  <option key={d} value={d}>
                    {d === "/" ? "All folders" : d}
                  </option>
                ))}
              </select>
              <Usage files={files} />
            </div>

            {shown.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-600">
                Nothing filed yet. Photographs, scans, letters and certificates
                all live in here.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {shown.map((f) => (
                  <FileRow
                    key={f.id}
                    entry={f}
                    serving={serving}
                    onInsert={() => insertRef(f)}
                    onChanged={refresh}
                  />
                ))}
              </ul>
            )}
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

function Usage({ files }: { files: VfsEntry[] }) {
  const [u, setU] = useState<{ bytes: number; unique: number } | null>(null);
  useEffect(() => {
    void vfs.usage().then(setU);
  }, [files]);
  if (!u) return null;
  const deduped = files.length - u.unique;
  return (
    <span className="text-[10px] text-zinc-500">
      {humanSize(u.bytes)} stored
      {deduped > 0 && ` · ${deduped} duplicate${deduped === 1 ? "" : "s"} deduped`}
    </span>
  );
}

function FileRow({
  entry,
  serving,
  onInsert,
  onChanged,
}: {
  entry: VfsEntry;
  serving: boolean;
  onInsert: () => void;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let made: string | null = null;
    if (isImage(entry.type)) {
      void vfs.read(entry.id).then((b) => {
        if (!b || revoked) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      });
    }
    return () => {
      revoked = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [entry.id, entry.type]);

  const download = async () => {
    const blob = await vfs.read(entry.id);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = entry.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  };

  return (
    <li className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-900 text-xl">
        {url ? (
          <img src={url} alt={entry.name} className="h-full w-full object-cover" />
        ) : isText(entry.type) ? (
          "📄"
        ) : (
          "📦"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-zinc-100">{entry.name}</p>
        <p className="truncate font-mono text-[10px] text-zinc-500">
          {entry.dir} · {humanSize(entry.size)}
        </p>
        {entry.caption && (
          <p className="truncate text-[10px] italic text-zinc-400">{entry.caption}</p>
        )}
        {serving && (
          <a
            href={servedPath(entry)}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block truncate font-mono text-[10px] text-cyan-400 hover:underline"
          >
            {servedPath(entry)}
          </a>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          <button
            onClick={onInsert}
            className="rounded bg-cyan-600 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950 transition hover:bg-cyan-500"
          >
            Insert
          </button>
          <button
            onClick={() => {
              const name = prompt("Rename to", entry.name);
              if (name) void vfs.update(entry.id, { name }).then(onChanged);
            }}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
          >
            Rename
          </button>
          <button
            onClick={() => {
              const caption = prompt("Caption", entry.caption ?? "");
              if (caption !== null) void vfs.update(entry.id, { caption }).then(onChanged);
            }}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
          >
            Caption
          </button>
          <button
            onClick={download}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
          >
            Save
          </button>
          <button
            onClick={() => {
              if (confirm(`Remove ${entry.name} from the book?`))
                void vfs.remove(entry.id).then(onChanged);
            }}
            className="rounded border border-rose-900 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-950/40"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function ChapterPreview({
  chapter,
  files,
}: {
  chapter: Chapter;
  files: VfsEntry[];
}) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let dead = false;
    const urls: string[] = [];
    void (async () => {
      const out = await renderChapter(chapter, files, async (entry) => {
        const blob = await vfs.read(entry.id);
        if (!blob) return null;
        const u = URL.createObjectURL(blob);
        urls.push(u);
        return u;
      });
      if (!dead) setHtml(out);
    })();
    return () => {
      dead = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [chapter, files]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <article
        className="book-prose mx-auto max-w-2xl"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Turn chapter text into HTML, resolving [[file:name]] to the attachment.
 * `resolve` supplies a URL (object URL for preview, data URI for export).
 */
export async function renderChapter(
  chapter: Chapter,
  files: VfsEntry[],
  resolve: (entry: VfsEntry) => Promise<string | null>
): Promise<string> {
  const byName = new Map(files.map((f) => [f.name, f]));
  const parts: string[] = [`<h2>${escapeHtml(chapter.title)}</h2>`];

  for (const para of chapter.body.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const refs = fileRefs(trimmed);
    if (refs.length === 1 && trimmed === `[[file:${refs[0]}]]`) {
      // A reference on its own line becomes a figure.
      const entry = byName.get(refs[0]);
      if (!entry) {
        parts.push(
          `<p class="missing">[missing attachment: ${escapeHtml(refs[0])}]</p>`
        );
        continue;
      }
      const url = await resolve(entry);
      if (url && isImage(entry.type)) {
        parts.push(
          `<figure><img src="${url}" alt="${escapeHtml(entry.caption ?? entry.name)}">` +
            `<figcaption>${escapeHtml(entry.caption ?? entry.name)}</figcaption></figure>`
        );
      } else if (url) {
        parts.push(
          `<p class="attachment"><a href="${url}" download="${escapeHtml(entry.name)}">📎 ${escapeHtml(entry.name)}</a>` +
            (entry.caption ? ` — ${escapeHtml(entry.caption)}` : "") +
            `</p>`
        );
      }
      continue;
    }

    // Inline references become links inside the paragraph.
    let body = escapeHtml(trimmed).replace(/\n/g, "<br>");
    for (const ref of refs) {
      const entry = byName.get(ref);
      const token = escapeHtml(`[[file:${ref}]]`);
      if (!entry) {
        body = body.replace(
          token,
          `<span class="missing">[missing: ${escapeHtml(ref)}]</span>`
        );
        continue;
      }
      const url = await resolve(entry);
      body = body.replace(
        token,
        url
          ? `<a href="${url}" download="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</a>`
          : escapeHtml(entry.name)
      );
    }
    parts.push(`<p>${body}</p>`);
  }

  return parts.join("\n");
}

const BOOK_CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f6f3ec;color:#1d1b16;font:17px/1.7 Georgia,'Iowan Old Style',serif}
.wrap{max-width:44rem;margin:0 auto;padding:56px 24px 96px}
h1{font-size:2.1rem;line-height:1.2;margin:0 0 4px}
.byline{color:#7a7364;font-size:.9rem;margin-bottom:40px;font-style:italic}
h2{font-size:1.35rem;margin:56px 0 14px;padding-top:20px;border-top:1px solid #ddd6c6}
h2:first-of-type{border-top:0;padding-top:0;margin-top:24px}
p{margin:0 0 1.1em;text-align:justify;hyphens:auto}
figure{margin:28px 0;text-align:center}
figure img{max-width:100%;border-radius:6px;box-shadow:0 2px 14px rgba(0,0,0,.18)}
figcaption{font-size:.82rem;color:#7a7364;margin-top:8px;font-style:italic}
.attachment a,p a{color:#6b4f1d}
.missing{color:#b45309;font-style:italic}
nav.toc{background:#efe9dc;border:1px solid #ddd6c6;border-radius:8px;padding:16px 20px;margin-bottom:8px}
nav.toc p{margin:0 0 8px;font-weight:bold;text-align:left}
nav.toc ol{margin:0;padding-left:20px}
nav.toc a{color:#1d1b16;text-decoration:none}
nav.toc a:hover{text-decoration:underline}
footer{margin-top:64px;padding-top:16px;border-top:1px solid #ddd6c6;font-size:.8rem;color:#7a7364;text-align:center}
@media print{
  body{background:#fff}
  .wrap{max-width:none;padding:0}
  h2{page-break-before:always;border-top:0}
  h2:first-of-type{page-break-before:avoid}
  figure{page-break-inside:avoid}
  nav.toc{page-break-after:always}
}
`;

/**
 * Build the whole book as one self-contained HTML file.
 * Attachments are inlined as data URIs so the file travels on its own.
 */
export async function buildBookHtml(chapters: Chapter[]): Promise<string> {
  const files = await vfs.list();
  const cache = new Map<string, string>();

  const resolve = async (entry: VfsEntry) => {
    if (cache.has(entry.id)) return cache.get(entry.id)!;
    const buf = await vfs.readBuffer(entry.id);
    if (!buf) return null;
    let bin = "";
    const bytes = new Uint8Array(buf);
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
    }
    const uri = `data:${entry.type};base64,${btoa(bin)}`;
    cache.set(entry.id, uri);
    return uri;
  };

  const rendered: string[] = [];
  for (const c of chapters) rendered.push(await renderChapter(c, files, resolve));

  const toc = chapters
    .map(
      (c, i) =>
        `<li><a href="#ch${i}">${escapeHtml(c.title || `Chapter ${i + 1}`)}</a></li>`
    )
    .join("");

  const bodies = rendered
    .map((html, i) => html.replace("<h2>", `<h2 id="ch${i}">`))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autobiography</title>
<style>${BOOK_CSS}</style>
</head>
<body>
<div class="wrap">
<h1>Autobiography</h1>
<p class="byline">Exported ${new Date().toLocaleDateString()} · ${chapters.length} chapter${chapters.length === 1 ? "" : "s"} · ${files.length} attachment${files.length === 1 ? "" : "s"} embedded</p>
<nav class="toc"><p>Contents</p><ol>${toc}</ol></nav>
${bodies}
<footer>Self-contained: every attachment is embedded in this file.</footer>
</div>
</body>
</html>`;
}
