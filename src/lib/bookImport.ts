import { vfs, type VfsEntry } from "./vfs";

// ---------------------------------------------------------------------------
// Serving
// ---------------------------------------------------------------------------

/** Path the service worker serves this entry at. */
export function servedPath(entry: VfsEntry): string {
  const dir = entry.dir === "/" ? "" : entry.dir.replace(/^\//, "") + "/";
  return `/book-fs/${dir}${encodeURIComponent(entry.name)}`;
}

export const FS_ROOT = "/book-fs/";

export function canServe(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    window.isSecureContext
  );
}

/**
 * Register the micro_httpd port.
 *
 * A Service Worker does not create a secure origin — it requires one — so this
 * fails by design on `file://`. That is the same reason the microphone never
 * prompted there.
 */
export async function startServer(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser has no Service Worker support.");
  }
  if (!window.isSecureContext) {
    throw new Error(
      "Not a secure context. Service Workers need https:// or localhost — a page opened from file:// cannot serve."
    );
  }
  const reg = await navigator.serviceWorker.register("/book-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function stopServer(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  let stopped = false;
  for (const r of regs) {
    if (r.active?.scriptURL.endsWith("/book-sw.js")) stopped = (await r.unregister()) || stopped;
  }
  return stopped;
}

export async function serverRunning(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.some((r) => r.active?.scriptURL.endsWith("/book-sw.js"));
}

// ---------------------------------------------------------------------------
// Vault import
// ---------------------------------------------------------------------------

export interface VaultJson {
  version?: number;
  files?: Record<string, string>;
}

export interface ImportResult {
  added: number;
  skipped: number;
  names: string[];
}

/**
 * Import an export from the book's original embedded vault.
 *
 * Shape is `{ version, files: { "/chapters/00-premise.md": "…" } }` — a flat
 * map of absolute path to text content, matching `greeran-book-vault-v1`.
 */
export async function importVaultJson(text: string): Promise<ImportResult> {
  let parsed: VaultJson;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const files = parsed?.files;
  if (!files || typeof files !== "object") {
    throw new Error(
      'No "files" object found. Export the vault with its own Export vault button, or copy localStorage["greeran-book-vault-v1"].'
    );
  }

  const existing = await vfs.list();
  const seen = new Set(existing.map((e) => `${e.dir}/${e.name}`));
  const res: ImportResult = { added: 0, skipped: 0, names: [] };

  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== "string") continue;
    const clean = path.startsWith("/") ? path : "/" + path;
    const slash = clean.lastIndexOf("/");
    const dir = slash <= 0 ? "/vault" : "/vault" + clean.slice(0, slash);
    const name = clean.slice(slash + 1) || "untitled.txt";

    if (seen.has(`${dir}/${name}`)) {
      res.skipped++;
      continue;
    }
    const type = name.endsWith(".json")
      ? "application/json"
      : name.endsWith(".md")
        ? "text/markdown"
        : "text/plain";
    await vfs.add(new File([content], name, { type }), {
      dir,
      caption: `Recovered from the book vault (${clean})`,
    });
    res.added++;
    res.names.push(name);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Genealogy
// ---------------------------------------------------------------------------

export interface GenealogyDoc {
  file: string;
  name: string;
  title: string;
  caption: string;
}

/** Research documents filed as attachments and cited from the text. */
export const GENEALOGY: GenealogyDoc[] = [
  {
    file: "/genealogy/seize-quartiers.html",
    name: "seize-quartiers.html",
    title: "Seize Quartiers",
    caption: "Seize Quartiers — all sixteen slots, final findings",
  },
  {
    file: "/genealogy/family-tree.html",
    name: "family-tree.html",
    title: "Family Tree",
    caption: "Greeran family tree — complete research database",
  },
  {
    file: "/genealogy/military-service-map.html",
    name: "military-service-map.html",
    title: "Military Service Map",
    caption: "The family uniform: a service map, 1780–1972",
  },
  {
    file: "/genealogy/bibliography.html",
    name: "bibliography.html",
    title: "Bibliography",
    caption: "Bibliography — sources used in the book model",
  },
];

/** Fetch the research documents and file them under /genealogy. */
export async function importGenealogy(): Promise<ImportResult> {
  const existing = await vfs.list("/genealogy");
  const seen = new Set(existing.map((e) => e.name));
  const res: ImportResult = { added: 0, skipped: 0, names: [] };

  for (const doc of GENEALOGY) {
    if (seen.has(doc.name)) {
      res.skipped++;
      continue;
    }
    const resp = await fetch(doc.file);
    if (!resp.ok) throw new Error(`Could not read ${doc.file} (HTTP ${resp.status})`);
    const blob = await resp.blob();
    await vfs.add(new File([blob], doc.name, { type: "text/html" }), {
      dir: "/genealogy",
      caption: doc.caption,
    });
    res.added++;
    res.names.push(doc.name);
  }
  return res;
}

/**
 * A chapter citing the research documents as attachments.
 *
 * Each is referenced rather than inlined, which is the distinction the book's
 * own evidence ladder draws: the narrative claims, the attachment evidences.
 */
export function genealogyChapterBody(): string {
  return [
    "The family-history research is filed with this book rather than retold in it.",
    "Each document below is an attachment: open it to see the evidence behind a",
    "claim made in the narrative chapters.",
    "",
    ...GENEALOGY.flatMap((d) => [`${d.title} — ${d.caption}.`, "", `[[file:${d.name}]]`, ""]),
    "Where a slot is still open, the narrative says so. Locate the record, cite it,",
    "and the slot moves from evidenced to proven.",
  ].join("\n");
}
