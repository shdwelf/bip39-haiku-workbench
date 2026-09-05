// Embedded filesystem for the book.
//
// Blobs live in IndexedDB (not localStorage) because a book's attachments are
// photographs and scans — megabytes, not kilobytes. Content is addressed by
// SHA-256 so the same scan referenced from three chapters is stored once.

export interface VfsEntry {
  /** Stable per-entry id. Two entries may share one `hash`. */
  id: string;
  name: string;
  /** Folder, always normalised to a leading slash and no trailing slash. */
  dir: string;
  type: string;
  size: number;
  hash: string;
  addedAt: number;
  /** Optional caption shown when the file is placed in a chapter. */
  caption?: string;
}

const DB_NAME = "bhw-book-vfs";
const DB_VERSION = 1;
const ENTRIES = "entries";
const BLOBS = "blobs";

export function normaliseDir(dir: string): string {
  const parts = dir
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p && p !== ".");
  return "/" + parts.join("/");
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ENTRIES)) {
        db.createObjectStore(ENTRIES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BLOBS)) {
        // Keyed by hash: identical content is stored exactly once.
        // Values are ArrayBuffers, not Blobs — buffers structured-clone
        // reliably across engines, Blobs do not.
        db.createObjectStore(BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => IDBRequest<T> | Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result: T;
    let pending: Promise<T> | null = null;
    const out = fn(t);
    if (out instanceof Promise) pending = out;
    else {
      out.onsuccess = () => {
        result = out.result;
      };
      out.onerror = () => reject(out.error);
    }
    t.oncomplete = async () => {
      resolve(pending ? await pending : result);
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("transaction aborted"));
  });
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export class BookVfs {
  private dbp: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbp) this.dbp = openDb();
    return this.dbp;
  }

  /** Store a file. Returns the new entry; content is deduped by hash. */
  async add(
    file: File | Blob,
    opts: { name?: string; dir?: string; caption?: string } = {}
  ): Promise<VfsEntry> {
    const name = opts.name ?? (file instanceof File ? file.name : "untitled");
    const dir = normaliseDir(opts.dir ?? "/");
    const buf = await file.arrayBuffer();
    const hash = await sha256Hex(buf);

    const entry: VfsEntry = {
      id: newId(),
      name,
      dir,
      type: file.type || "application/octet-stream",
      size: buf.byteLength,
      hash,
      addedAt: Date.now(),
      ...(opts.caption ? { caption: opts.caption } : {}),
    };

    const db = await this.db();
    await tx(db, [ENTRIES, BLOBS], "readwrite", (t) => {
      const blobs = t.objectStore(BLOBS);
      // Only write the bytes when this content is genuinely new.
      const check = blobs.get(hash);
      check.onsuccess = () => {
        if (check.result === undefined) blobs.put(buf, hash);
      };
      return t.objectStore(ENTRIES).put(entry) as unknown as IDBRequest<unknown>;
    });
    return entry;
  }

  async list(dir?: string): Promise<VfsEntry[]> {
    const db = await this.db();
    const all = await tx<VfsEntry[]>(db, [ENTRIES], "readonly", (t) =>
      t.objectStore(ENTRIES).getAll()
    );
    const filtered = dir ? all.filter((e) => e.dir === normaliseDir(dir)) : all;
    return filtered.sort((a, b) => b.addedAt - a.addedAt);
  }

  async get(id: string): Promise<VfsEntry | undefined> {
    const db = await this.db();
    return tx(db, [ENTRIES], "readonly", (t) => t.objectStore(ENTRIES).get(id));
  }

  /** Raw bytes for an entry, or null if the content is missing. */
  async readBuffer(id: string): Promise<ArrayBuffer | null> {
    const entry = await this.get(id);
    if (!entry) return null;
    const db = await this.db();
    const buf = await tx<ArrayBuffer | undefined>(db, [BLOBS], "readonly", (t) =>
      t.objectStore(BLOBS).get(entry.hash)
    );
    return buf ?? null;
  }

  /** Bytes as a Blob tagged with the entry's MIME type. */
  async read(id: string): Promise<Blob | null> {
    const entry = await this.get(id);
    if (!entry) return null;
    const buf = await this.readBuffer(id);
    if (!buf) return null;
    return new Blob([buf], { type: entry.type });
  }

  /** Convenience for text attachments. */
  async readText(id: string): Promise<string | null> {
    const buf = await this.readBuffer(id);
    return buf ? new TextDecoder().decode(buf) : null;
  }

  async update(id: string, patch: Partial<Omit<VfsEntry, "id" | "hash">>) {
    const entry = await this.get(id);
    if (!entry) return null;
    const next: VfsEntry = {
      ...entry,
      ...patch,
      ...(patch.dir ? { dir: normaliseDir(patch.dir) } : {}),
    };
    const db = await this.db();
    await tx(db, [ENTRIES], "readwrite", (t) => t.objectStore(ENTRIES).put(next));
    return next;
  }

  /**
   * Remove an entry. The underlying blob is only deleted once no other entry
   * references that hash, so removing one of two copies keeps the bytes.
   */
  async remove(id: string): Promise<void> {
    const entry = await this.get(id);
    if (!entry) return;
    const db = await this.db();
    const remaining = (await this.list()).filter(
      (e) => e.hash === entry.hash && e.id !== id
    );
    await tx(db, [ENTRIES, BLOBS], "readwrite", (t) => {
      if (remaining.length === 0) t.objectStore(BLOBS).delete(entry.hash);
      return t.objectStore(ENTRIES).delete(id) as unknown as IDBRequest<unknown>;
    });
  }

  async dirs(): Promise<string[]> {
    const all = await this.list();
    return [...new Set(all.map((e) => e.dir))].sort();
  }

  /** Total bytes actually stored, counting deduped content once. */
  async usage(): Promise<{ entries: number; bytes: number; unique: number }> {
    const all = await this.list();
    const seen = new Map<string, number>();
    for (const e of all) seen.set(e.hash, e.size);
    let bytes = 0;
    for (const size of seen.values()) bytes += size;
    return { entries: all.length, bytes, unique: seen.size };
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await tx(db, [ENTRIES, BLOBS], "readwrite", (t) => {
      t.objectStore(BLOBS).clear();
      return t.objectStore(ENTRIES).clear() as unknown as IDBRequest<unknown>;
    });
  }
}

export const vfs = new BookVfs();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(2)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(blob);
  });
}

export function isImage(type: string) {
  return type.startsWith("image/");
}

export function isText(type: string) {
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml"
  );
}
