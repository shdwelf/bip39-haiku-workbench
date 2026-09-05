// Encrypted vault file exchange + standalone offline decryptor.
//
// Format (version 1), also understood by the generated decryptor page:
//
//   haiku-vault-v1.<base64( 0x01 | salt(16) | iv(12) | ciphertext+tag )>
//
// Key: PBKDF2-HMAC-SHA256, 120,000 iterations, 32 bytes -> AES-256-GCM.
// The salt is separate from the IV, so one Ensō ID can safely back multiple
// files. Implemented with @noble (deterministic, Node-testable); the emitted
// decryptor page re-implements the same layout with native WebCrypto.

import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "./rngBytes";
import { download } from "./wallet";

export const VAULT_FILE_MAGIC = "haiku-vault-v1.";
export const PBKDF2_ITERATIONS = 120_000;

function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(sha256, new TextEncoder().encode(password), salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  });
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encrypt any JSON-serialisable payload into the v1 exchange format. */
export function encryptVaultFile(value: unknown, password: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(value, null, 2));
  const ct = gcm(key, iv).encrypt(plaintext);
  const packed = new Uint8Array(1 + salt.length + iv.length + ct.length);
  packed[0] = 1;
  packed.set(salt, 1);
  packed.set(iv, 17);
  packed.set(ct, 29);
  return VAULT_FILE_MAGIC + toB64(packed);
}

/** Decrypt a v1 exchange blob. Throws on wrong password or tampering. */
export function decryptVaultFile(blob: string, password: string): unknown {
  const body = blob.trim().startsWith(VAULT_FILE_MAGIC)
    ? blob.trim().slice(VAULT_FILE_MAGIC.length)
    : blob.trim();
  let packed: Uint8Array;
  try {
    packed = fromB64(body);
  } catch {
    throw new Error("Not a haiku-vault-v1 file.");
  }
  if (packed[0] !== 1 || packed.length < 46) {
    throw new Error("Not a haiku-vault-v1 file.");
  }
  const salt = packed.slice(1, 17);
  const iv = packed.slice(17, 29);
  const ct = packed.slice(29);
  const key = deriveKey(password, salt);
  const plain = gcm(key, iv).decrypt(ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

export function downloadVaultFile(value: unknown, password: string) {
  download(
    encryptVaultFile(value, password),
    `haiku-vault-${new Date().toISOString().slice(0, 10)}.haikuvault`,
    "text/plain"
  );
}

/**
 * A self-contained decryptor page: no imports, no network, no scripts loaded
 * from anywhere — save it next to the vault file and open it from a USB stick.
 * Re-derives the key with native WebCrypto and only ever shows the plaintext
 * locally. Generated with the vault blob optionally pre-embedded.
 */
export function standaloneDecryptorHtml(embeddedBlob?: string): string {
  const embedded = embeddedBlob
    ? JSON.stringify(embeddedBlob)
    : "null";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Haiku Vault Decryptor</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background:#09090b; color:#e4e4e7; margin:0; padding:2rem 1rem; }
  main { max-width: 46rem; margin: 0 auto; }
  h1 { font-size: 1.1rem; color:#a1a1aa; letter-spacing:.08em; text-transform:uppercase; }
  p { color:#a1a1aa; font-size:.85rem; line-height:1.5; }
  input[type=file], input[type=password] { width:100%; box-sizing:border-box; margin:.4rem 0 1rem; padding:.6rem; background:#18181b; color:#e4e4e7; border:1px solid #3f3f46; border-radius:.5rem; }
  textarea { width:100%; box-sizing:border-box; min-height:18rem; margin-top:.5rem; padding:.6rem; background:#18181b; color:#e4e4e7; border:1px solid #3f3f46; border-radius:.5rem; font-family:inherit; font-size:.75rem; }
  button { padding:.6rem 1.2rem; background:#18181b; color:#e4e4e7; border:1px solid #52525b; border-radius:.5rem; cursor:pointer; }
  button:hover { border-color:#a1a1aa; }
  .ok { color:#34d399; } .bad { color:#f87171; }
  pre { white-space:pre-wrap; word-break:break-all; }
</style>
</head>
<body>
<main>
  <h1>Haiku Vault Decryptor</h1>
  <p>Decrypts <code>haiku-vault-v1.*</code> files produced by the BIP-39 Haiku
  Workbench (PBKDF2-SHA256 &times; 120,000, AES-256-GCM; salt 16 &hairsp;|&hairsp;
  IV 12 &hairsp;|&hairsp; ciphertext+tag). Everything runs locally in this page
  &mdash; it loads nothing and talks to nobody.</p>
  <label>Vault file${embeddedBlob ? " (pre-loaded &mdash; you can replace it)" : ""}</label>
  <input type="file" id="file" accept=".haikuvault,text/plain">
  <label>Vault password (your Ens&#333; ID)</label>
  <input type="password" id="pass" autocomplete="off" spellcheck="false">
  <button id="go">Decrypt</button>
  <button id="save" hidden>Download plaintext JSON</button>
  <p id="status"></p>
  <textarea id="out" spellcheck="false" placeholder="plaintext appears here"></textarea>
</main>
<script>
(() => {
  "use strict";
  const MAGIC = ${JSON.stringify(VAULT_FILE_MAGIC)};
  const ITERS = ${String(PBKDF2_ITERATIONS)};
  let blob = ${embedded};
  let plain = null;
  const $ = (id) => document.getElementById(id);
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
  $("file").addEventListener("change", async () => {
    blob = await $("file").files[0]?.text() ?? null;
    $("status").textContent = blob ? "File loaded." : "";
  });
  $("go").addEventListener("click", async () => {
    $("status").className = ""; $("status").textContent = "Deriving key (120k PBKDF2)\u2026";
    try {
      if (!blob) throw new Error("Load a vault file first.");
      const body = blob.trim().startsWith(MAGIC) ? blob.trim().slice(MAGIC.length) : blob.trim();
      const packed = b64ToBytes(body);
      if (packed[0] !== 1 || packed.length < 46) throw new Error("Not a haiku-vault-v1 file.");
      const pass = new TextEncoder().encode($("pass").value || "default-vault-key");
      const base = await crypto.subtle.importKey("raw", pass, "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: packed.slice(1, 17), iterations: ITERS, hash: "SHA-256" },
        base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: packed.slice(17, 29) }, key, packed.slice(29));
      plain = new TextDecoder().decode(pt);
      $("out").value = plain;
      $("save").hidden = false;
      $("status").className = "ok"; $("status").textContent = "Decrypted.";
    } catch (e) {
      plain = null; $("save").hidden = true;
      $("status").className = "bad";
      $("status").textContent = "Failed: " + (e.message || e) + " (wrong password?)";
    }
  });
  $("save").addEventListener("click", () => {
    if (plain == null) return;
    const url = URL.createObjectURL(new Blob([plain], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "haiku-vault-plain.json"; a.click();
    URL.revokeObjectURL(url);
  });
})();
</script>
</body>
</html>
`;
}

export function downloadStandaloneDecryptor(embeddedBlob?: string) {
  download(
    standaloneDecryptorHtml(embeddedBlob),
    "haiku-vault-decryptor.html",
    "text/html"
  );
}
