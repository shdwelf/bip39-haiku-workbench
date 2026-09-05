import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipeProvider } from "../src/pipe/PipeProvider";
import RecoveryLab from "../src/components/RecoveryLab";
import ArtGallery from "../src/components/ArtGallery";
import HaikuWallet from "../src/components/HaikuWallet";

beforeEach(() => localStorage.clear());

describe("new tabs render", () => {
  it("Recovery Lab shows its sections", () => {
    render(
      <PipeProvider initialTab="recovery">
        <RecoveryLab />
      </PipeProvider>
    );
    expect(screen.getByText(/🧩 Recovery Lab/)).toBeTruthy();
    expect(screen.getByText(/Find \? words/)).toBeTruthy();
    expect(screen.getByText(/Repair typos & anagrams/)).toBeTruthy();
    expect(screen.getByText(/Vanity mining \(BTC\)/)).toBeTruthy();
  });

  it("Art Gallery verifies the whole catalog on render", () => {
    render(
      <PipeProvider initialTab="gallery">
        <ArtGallery />
      </PipeProvider>
    );
    expect(screen.getByText(/all 100 entries checksum-valid/)).toBeTruthy();
    // filter chips exist for every catalog type
    expect(screen.getByText(/11 \/ 12 pattern \(40\)/)).toBeTruthy();
    expect(screen.getByText(/haiku \/ poetic \(30\)/)).toBeTruthy();
  });

  it("Haiku Wallet offers the vault-file export, decryptor and import", () => {
    render(
      <PipeProvider initialTab="wallet">
        <HaikuWallet ensoId="EN0TEST" />
      </PipeProvider>
    );
    expect(screen.getByText(/Export \.haikuvault/)).toBeTruthy();
    expect(screen.getByText(/Standalone decryptor ⬇/)).toBeTruthy();
    expect(screen.getByText(/Import \.haikuvault/)).toBeTruthy();
  });
});
