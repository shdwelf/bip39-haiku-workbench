import { describe, expect, it, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PipeProvider, usePipe } from "../pipe/PipeProvider";
import MnemonicInspector from "./MnemonicInspector";

// A known-good 12-word BIP-39 test vector.
const VECTOR =
  "legal winner thank year wave sausage worth useful legal winner thank yellow";

function harness() {
  let api: ReturnType<typeof usePipe>;
  function Probe() {
    api = usePipe();
    return null;
  }
  render(
    <PipeProvider initialTab="inspector">
      <Probe />
      <MnemonicInspector />
    </PipeProvider>
  );
  return {
    get api() {
      return api!;
    },
  };
}

beforeEach(() => localStorage.clear());

describe("Inspector ← piped inbox", () => {
  it("receives a piped mnemonic and reports it as a valid BIP-39 phrase", () => {
    const h = harness();

    act(() =>
      h.api.sendToTool("inspector", {
        content: VECTOR,
        contentType: "mnemonic",
        sourceId: "wallet",
        sourceName: "Haiku Wallet",
        label: "piped phrase",
      })
    );

    // The delivery populated the textarea… (the explorer inputs are also
    // textboxes now, so the phrase field is addressed by name)
    expect(
      (screen.getByRole("textbox", { name: "Mnemonic phrase" }) as HTMLTextAreaElement).value
    ).toBe(VECTOR);
    // …and the tool analysed it rather than just displaying it.
    expect(screen.getByText("valid ✓")).toBeTruthy();
    expect(screen.getByText(/Received mnemonic from Haiku Wallet/)).toBeTruthy();
  });

  it("flags a phrase whose checksum does not hold", () => {
    const h = harness();
    const broken = VECTOR.replace("yellow", "zoo");

    act(() =>
      h.api.sendToTool("inspector", {
        content: broken,
        contentType: "mnemonic",
        sourceId: "wallet",
        sourceName: "Haiku Wallet",
        label: "broken phrase",
      })
    );

    expect(screen.getByText("invalid ✕")).toBeTruthy();
  });
});
