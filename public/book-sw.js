/*
 * book-sw.js — the book's embedded filesystem, served over HTTP.
 *
 * A port of micro_httpd to a Service Worker.
 *
 *   micro_httpd - really small HTTP server
 *   Copyright (C) 1999,2005 by Jef Poskanzer <jef@mail.acme.com>.
 *   All rights reserved.
 *
 *   Redistribution and use in source and binary forms, with or without
 *   modification, are permitted provided that the following conditions
 *   are met:
 *   1. Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *   2. Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *
 *   THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
 *   ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 *   IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 *   ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 *   FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 *   DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 *   OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 *   HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 *   LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 *   OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 *   SUCH DAMAGE.
 *
 * What carried over from the C, feature for feature:
 *   - security against ".." filename snooping
 *   - the common MIME types
 *   - trailing-slash redirection
 *   - index.html
 *   - directory listings
 *
 * What could not: micro_httpd runs from inetd and owns a socket. A page cannot
 * bind one. A Service Worker does not create a secure origin either — it
 * *requires* one — but on that origin it answers fetches exactly as a server
 * would, so attachments in IndexedDB get real URLs instead of blob: handles.
 */

const ROOT = "/book-fs/";
const DB_NAME = "bhw-book-vfs";
const ENTRIES = "entries";
const BLOBS = "blobs";

/* From micro_httpd's figure_mime(), plus a few the book needs. */
const MIME = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  xml: "text/xml",
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  au: "audio/basic",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
};

function mimeFor(name, declared) {
  if (declared && declared !== "application/octet-stream") return declared;
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "text/plain; charset=utf-8";
  return MIME[name.slice(dot + 1).toLowerCase()] || "application/octet-stream";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
 * micro_httpd rejects any path containing a ".." component outright rather
 * than trying to resolve it. Same here: resolve, then verify nothing climbed
 * above the root.
 */
function safePath(pathname) {
  let p;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const rel = p.slice(ROOT.length);
  const out = [];
  for (const part of rel.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") return null; // "..": snooping, refused
    if (part.includes("\0")) return null;
    out.push(part);
  }
  return "/" + out.join("/");
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      // The app owns the schema; if the book has never been opened there is
      // nothing to serve, so make sure the stores at least exist.
      const db = req.result;
      if (!db.objectStoreNames.contains(ENTRIES))
        db.createObjectStore(ENTRIES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    };
  });
}

function getAll(db, store) {
  return new Promise((resolve, reject) => {
    const r = db.transaction([store], "readonly").objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });
}

function getOne(db, store, key) {
  return new Promise((resolve, reject) => {
    const r = db.transaction([store], "readonly").objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const PAGE = (title, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{background:#f6f3ec;color:#1d1b16;font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;padding:32px 24px}
.w{max-width:46rem;margin:0 auto}
h1{font-size:1.15rem;margin:0 0 4px}
.sub{color:#7a7364;font-size:.8rem;margin-bottom:20px}
table{width:100%;border-collapse:collapse}
td,th{text-align:left;padding:5px 10px 5px 0;border-bottom:1px solid #e2dbcb;font-size:.85rem}
th{color:#7a7364;font-weight:normal;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
a{color:#6b4f1d;text-decoration:none}a:hover{text-decoration:underline}
.n{text-align:right;color:#7a7364;white-space:nowrap}
hr{border:0;border-top:1px solid #ddd6c6;margin:24px 0 10px}
address{color:#7a7364;font-size:.72rem;font-style:normal}
</style></head><body><div class="w">${body}
<hr><address>book-sw — micro_httpd (BSD-2-Clause, Jef Poskanzer) ported to a Service Worker</address>
</div></body></html>`;

function errorPage(status, statusText, detail) {
  return new Response(
    PAGE(
      `${status} ${statusText}`,
      `<h1>${status} ${escapeHtml(statusText)}</h1><p class="sub">${escapeHtml(detail)}</p>`
    ),
    { status, statusText, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function humanSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(2) + " MB";
}

function listing(dir, entries, subdirs) {
  const rows = [];
  if (dir !== "/") {
    const up = dir.slice(0, dir.lastIndexOf("/")) || "/";
    rows.push(
      `<tr><td><a href="${ROOT}${up.replace(/^\//, "")}${up === "/" ? "" : "/"}">../</a></td><td></td><td></td></tr>`
    );
  }
  for (const d of subdirs) {
    const name = d.split("/").pop();
    rows.push(
      `<tr><td><a href="${ROOT}${d.replace(/^\//, "")}/">${escapeHtml(name)}/</a></td><td class="n">—</td><td></td></tr>`
    );
  }
  for (const e of entries) {
    const href = `${ROOT}${(e.dir === "/" ? "" : e.dir.replace(/^\//, "") + "/")}${encodeURIComponent(e.name)}`;
    rows.push(
      `<tr><td><a href="${href}">${escapeHtml(e.name)}</a></td>` +
        `<td class="n">${humanSize(e.size)}</td>` +
        `<td>${escapeHtml(e.caption || "")}</td></tr>`
    );
  }
  if (!rows.length) rows.push(`<tr><td colspan="3">(empty)</td></tr>`);

  return PAGE(
    `Index of ${dir}`,
    `<h1>Index of ${escapeHtml(dir)}</h1>` +
      `<p class="sub">${entries.length} file${entries.length === 1 ? "" : "s"} in the book's embedded filesystem</p>` +
      `<table><tr><th>Name</th><th class="n">Size</th><th>Caption</th></tr>${rows.join("")}</table>`
  );
}

async function serve(request) {
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorPage(501, "Not Implemented", `That method is not implemented.`);
  }

  const path = safePath(url.pathname);
  if (path === null) {
    // micro_httpd: "illegal filename" — refuse rather than resolve.
    return errorPage(400, "Bad Request", "Illegal filename.");
  }

  let db;
  try {
    db = await openDb();
  } catch {
    return errorPage(503, "Service Unavailable", "The book's filesystem is unavailable.");
  }

  const all = await getAll(db, ENTRIES);

  // Exact file match?
  const dir = path.slice(0, path.lastIndexOf("/")) || "/";
  const name = path.slice(path.lastIndexOf("/") + 1);
  const hit = name ? all.find((e) => e.dir === dir && e.name === name) : null;

  if (hit) {
    const buf = await getOne(db, BLOBS, hit.hash);
    if (!buf) return errorPage(404, "Not Found", "The file's contents are missing.");
    const headers = {
      "Content-Type": mimeFor(hit.name, hit.type),
      "Content-Length": String(hit.size),
      "Last-Modified": new Date(hit.addedAt).toUTCString(),
      "Cache-Control": "no-cache",
      // Served from the book's own origin; keep it from being framed elsewhere.
      "X-Content-Type-Options": "nosniff",
    };
    return new Response(request.method === "HEAD" ? null : buf, { headers });
  }

  // Directory?
  const asDir = path === "/" ? "/" : path.replace(/\/$/, "");
  const inDir = all.filter((e) => e.dir === asDir);
  const subdirs = [
    ...new Set(
      all
        .map((e) => e.dir)
        .filter((d) => d !== asDir && d.startsWith(asDir === "/" ? "/" : asDir + "/"))
        .map((d) => {
          const rest = d.slice(asDir === "/" ? 1 : asDir.length + 1);
          return (asDir === "/" ? "/" : asDir + "/") + rest.split("/")[0];
        })
    ),
  ].sort();

  if (inDir.length || subdirs.length || asDir === "/") {
    // Trailing-slash redirection, straight from micro_httpd.
    if (!url.pathname.endsWith("/")) {
      return Response.redirect(url.pathname + "/" + url.search, 301);
    }
    // index.html takes precedence over a generated listing.
    const index = inDir.find((e) => e.name === "index.html");
    if (index) {
      const buf = await getOne(db, BLOBS, index.hash);
      if (buf) {
        return new Response(request.method === "HEAD" ? null : buf, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }
    }
    return new Response(
      request.method === "HEAD" ? null : listing(asDir, inDir, subdirs),
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } }
    );
  }

  return errorPage(404, "Not Found", `${path} was not found in the book.`);
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(ROOT)) return;
  event.respondWith(
    serve(event.request).catch((err) =>
      errorPage(500, "Internal Error", String(err && err.message ? err.message : err))
    )
  );
});
