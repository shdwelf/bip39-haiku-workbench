import { describe, expect, it } from "vitest";
import {
  decryptVaultFile,
  encryptVaultFile,
  PBKDF2_ITERATIONS,
  standaloneDecryptorHtml,
  VAULT_FILE_MAGIC,
} from "../src/lib/vaultfile";

describe("vault file format", () => {
  it("round-trips a payload", () => {
    const items = [{ id: "HK1", mnemonic: "abandon ability able" }];
    const blob = encryptVaultFile(items, "EN0ABC");
    expect(blob.startsWith(VAULT_FILE_MAGIC)).toBe(true);
    expect(decryptVaultFile(blob, "EN0ABC")).toEqual(items);
  });

  it("uses a fresh salt+IV every time", () => {
    const a = encryptVaultFile([{ x: 1 }], "pw");
    const b = encryptVaultFile([{ x: 1 }], "pw");
    expect(a).not.toBe(b);
  });

  it("rejects a wrong password", () => {
    const blob = encryptVaultFile([{ secret: true }], "correct horse");
    expect(() => decryptVaultFile(blob, "battery staple")).toThrow();
  });

  it("detects tampering (GCM tag)", () => {
    const blob = encryptVaultFile([{ secret: true }], "pw");
    const body = blob.slice(VAULT_FILE_MAGIC.length);
    // flip one character near the end of the ciphertext
    const flipped =
      body.slice(0, -2) +
      (body.slice(-2, -1) === "A" ? "B" : "A") +
      body.slice(-1);
    expect(() => decryptVaultFile(VAULT_FILE_MAGIC + flipped, "pw")).toThrow();
  });

  it("rejects non-v1 blobs", () => {
    expect(() => decryptVaultFile("not-a-vault", "pw")).toThrow(/haiku-vault-v1/);
  });
});

describe("standalone decryptor page", () => {
  it("is fully self-contained (no external URLs)", () => {
    const html = standaloneDecryptorHtml(encryptVaultFile([{ a: 1 }], "k"));
    const external = html.match(/(https?:)?\/\/[a-z0-9.-]+/gi) || [];
    expect(external).toEqual([]);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
  });

  it("embeds the vault blob and the format constants", () => {
    const blob = encryptVaultFile([{ a: 1 }], "k");
    const html = standaloneDecryptorHtml(blob);
    expect(html).toContain(JSON.stringify(blob));
    expect(html).toContain(VAULT_FILE_MAGIC);
    expect(html).toContain(String(PBKDF2_ITERATIONS));
  });

  it("generates without an embedded blob too", () => {
    const html = standaloneDecryptorHtml();
    expect(html).toContain("Decryptor");
    expect(html).not.toContain(`blob = "haiku-vault`);
  });
});
