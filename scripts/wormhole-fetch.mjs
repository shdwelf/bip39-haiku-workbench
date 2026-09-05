// Downloads every file from a wormhole.app link in real chromium.
// The URL fragment carries the symmetric key; wormhole decrypts client-side,
// so no network-only client can do this. Expects WH_URL in the environment.
import { chromium } from "playwright";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const URL_ = process.env.WH_URL;
const OUT = "uploads-wormhole";
if (!URL_) {
  console.error("WH_URL missing");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log(...a);
const savedCount = () => {
  try {
    return readdirSync(OUT).length;
  } catch {
    return 0;
  }
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const inFlight = new Set();

page.on("download", async (d) => {
  inFlight.add(d);
  try {
    const dest = path.join(OUT, d.suggestedFilename());
    await d.saveAs(dest);
    log("saved:", d.suggestedFilename());
  } catch (e) {
    log("save error:", e.message);
  } finally {
    inFlight.delete(d);
  }
});
page.on("pageerror", (e) => log("PAGEERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") log("console.error:", m.text().slice(0, 200));
});

try {
  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 60000 });
} catch (e) {
  log("goto failed:", e.message.split("\n")[0]);
}
// let the client decrypt the metadata and render file rows
await page.waitForTimeout(12000);

const sample = await page
  .textContent("body")
  .catch(() => "");
log("page text:", JSON.stringify((sample || "").replace(/\s+/g, " ").slice(0, 300)));

// Primary path: the site's own "Download all files" button.
try {
  const btn = page
    .getByRole("button", { name: /download all/i })
    .or(page.getByRole("link", { name: /download all/i }))
    .or(page.getByText(/download all/i))
    .first();
  await btn.click({ timeout: 10000 });
  log("clicked: download all files");
} catch (e) {
  log("download-all not clickable:", e.message.split("\n")[0]);
}

// Wait for downloads to land (relay is fast; P2P can be slower).
const deadline = Date.now() + 180000;
while (Date.now() < deadline) {
  await page.waitForTimeout(5000);
  if (inFlight.size === 0 && savedCount() >= 6) break;
}
log("after download-all, files:", savedCount());

// Fallback: click each per-file download control if we came up short.
if (savedCount() < 6) {
  const cands = await page.$$("button, a");
  for (const c of cands) {
    const t = ((await c.textContent().catch(() => "")) || "").trim();
    const aria = (await c.getAttribute("aria-label").catch(() => "")) || "";
    const title = (await c.getAttribute("title").catch(() => "")) || "";
    if (/^(download|save)$/i.test(t) || /download/i.test(aria) || /download/i.test(title)) {
      await c
        .click({ timeout: 2000 })
        .then(() => log("clicked per-file control:", JSON.stringify(t || aria || title)))
        .catch(() => {});
      await page.waitForTimeout(4000);
    }
  }
  const deadline2 = Date.now() + 90000;
  while (Date.now() < deadline2 && inFlight.size > 0) await page.waitForTimeout(5000);
  log("after per-file pass, files:", savedCount());
}

await page.screenshot({ path: "uploads-wormhole-debug.png", fullPage: true }).catch(() => {});
await browser.close();

log("final file count:", savedCount());
process.exit(savedCount() > 0 ? 0 : 1);
