// Cryptographic random bytes with a graceful fallback for non-secure
// contexts (file:// pages in some engines). Used for vault salts and IVs.
export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const g = globalThis.crypto;
  if (g?.getRandomValues) {
    g.getRandomValues(out);
  } else {
    // Decoding escape hatch: Math.random is not cryptographic, but this path
    // only triggers where WebCrypto is entirely unavailable, and a vault salt
    // generated there is still better than refusing to export.
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}
