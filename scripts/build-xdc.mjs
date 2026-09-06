import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const outputName = "bip39-haiku-workbench.xdc";
const manifest = `name = "BIP-39 Haiku Workbench"
orientation = "landscape"
`;

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const indexPath = path.join(dist, "index.html");
if (!(await stat(indexPath).catch(() => null))) {
  throw new Error("dist/index.html is missing; run Vite before packaging Webxdc");
}

await writeFile(path.join(dist, "manifest.toml"), manifest);

// Stable timestamps make two builds from identical input byte-for-byte equal.
const mtime = new Date("2026-08-23T00:00:00.000Z");
const archive = {};
for (const absolute of (await walk(dist)).sort()) {
  const relative = path.relative(dist, absolute).split(path.sep).join("/");
  if (relative === outputName) continue;
  archive[relative] = [new Uint8Array(await readFile(absolute)), { level: 9, mtime }];
}

// A Webxdc is a ZIP rooted at index.html + manifest.toml. Static companion
// applications are included too, so the maintained suite does not lose its
// cookbook, CyberChef, genealogy, or service-worker resources in chat.
const bytes = zipSync(archive, { level: 9, mtime });
const outputPath = path.join(dist, outputName);
await writeFile(outputPath, bytes);

const digest = createHash("sha256").update(bytes).digest("hex");
const indexDigest = createHash("sha256").update(await readFile(indexPath)).digest("hex");
console.log(`Webxdc: ${path.relative(root, outputPath)} (${bytes.length.toLocaleString()} bytes)`);
console.log(`  xdc sha256:   ${digest}`);
console.log(`  index sha256: ${indexDigest}`);
console.log(`  entries:      ${Object.keys(archive).length}`);
