import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ARCHIVED_CODEBASES,
  CodebaseSwitcher,
  EmbeddedCodebase,
} from "../src/components/CodebaseWorkbench";

const EXPECTED_SHA256: Record<string, string> = {
  gen2: "e410f0b57bf53c8bbde711f99d3a899eefd046a98b63eff47791d93c3e7e5b08",
  "gen2-aug14": "0852910297bdae9e28c12d5635cd04f7ed3055e809682c6ddc8b608e372817a6",
  quip: "f8bb51fb78381ee9eb4b144dfe792e404e2bc7f3fd40e73b5c4128e040dae04d",
  "wallet-classic": "f5baec953d514a6e2ee997358d63a886ea771cdb3a760dc3408bebfd77a788dc",
  "validator-classic": "f1751ed434911aa1ecbd5925eb7131cb14dd202cb357cac1e1f3c1158e9e3aed",
};

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

describe("uploaded codebase archive", () => {
  it("embeds every distinct non-empty upload byte-for-byte", () => {
    expect(ARCHIVED_CODEBASES.map(({ id }) => id)).toEqual([
      "gen2",
      "gen2-aug14",
      "quip",
      "wallet-classic",
      "validator-classic",
    ]);

    for (const codebase of ARCHIVED_CODEBASES) {
      expect(sha256(codebase.originalHtml), codebase.filename).toBe(EXPECTED_SHA256[codebase.id]);
    }
  });

  it("deduplicates only the byte-identical 23 August copy", () => {
    const duplicate = readFileSync(
      path.resolve("bip39-haiku-workbench-gen2-2026-08-23T11-46-10-756Z (1).html"),
    );
    expect(sha256(duplicate)).toBe(EXPECTED_SHA256.gen2);
  });

  it("mounts the canonical Gen2 document as an iframe source document", () => {
    const canonical = ARCHIVED_CODEBASES[0];
    render(<EmbeddedCodebase codebase={canonical} />);

    const frame = screen.getByTitle(canonical.label);
    expect(frame.getAttribute("srcdoc")).toBe(canonical.html);
    expect(frame.classList.contains("h-dvh")).toBe(true);
    expect(frame.classList.contains("w-full")).toBe(true);
  });

  it("switches into the maintained suite from the overlay", () => {
    const onSelect = vi.fn();
    render(<CodebaseSwitcher activeId="gen2" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Switch combined codebase" }));
    fireEvent.click(screen.getByRole("button", { name: /Recovery suite/i }));
    expect(onSelect).toHaveBeenCalledWith("suite");
  });
});
