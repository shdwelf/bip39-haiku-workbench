import { StrictMode, useState } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PipeProvider, usePipe, usePipeReceiver } from "./PipeProvider";
import { MAX_PIPES, type PipeDraft } from "./types";

function draft(content: string, over: Partial<PipeDraft> = {}): PipeDraft {
  return {
    content,
    contentType: "mnemonic",
    sourceId: "wallet",
    sourceName: "Haiku Wallet",
    label: content,
    ...over,
  };
}

/** Renders the provider and exposes its context to the test. */
function harness(children?: React.ReactNode, strict = false) {
  let api: ReturnType<typeof usePipe>;
  function Probe() {
    api = usePipe();
    return null;
  }
  const tree = (
    <PipeProvider initialTab="enso">
      <Probe />
      {children}
    </PipeProvider>
  );
  const utils = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { ...utils, get api() { return api!; } };
}

/** A tool that records every delivery it receives. */
function Receiver({ toolId, log }: { toolId: string; log: string[] }) {
  const [n, setN] = useState(0);
  usePipeReceiver(toolId, (d) => {
    log.push(d.content);
    setN((v) => v + 1);
  });
  return <div data-testid={`recv-${toolId}`}>{n}</div>;
}

beforeEach(() => localStorage.clear());

describe("pipe inbox", () => {
  it("stores a pushed pipe and returns it with a stable id", () => {
    const h = harness();
    let id = "";
    act(() => {
      id = h.api.pushPipe(draft("abandon ability able")).id;
    });
    expect(h.api.pipes).toHaveLength(1);
    expect(h.api.pipes[0].id).toBe(id);
    expect(h.api.peekPipe(id)).toBe("abandon ability able");
  });

  it("generates unique ids across many rapid pushes", () => {
    const h = harness();
    act(() => {
      for (let i = 0; i < MAX_PIPES; i++) h.api.pushPipe(draft(`phrase ${i}`));
    });
    const ids = new Set(h.api.pipes.map((p) => p.id));
    expect(ids.size).toBe(h.api.pipes.length);
  });

  it("caps stored pipes at MAX_PIPES, evicting the oldest", () => {
    const h = harness();
    act(() => {
      for (let i = 0; i < MAX_PIPES + 8; i++) h.api.pushPipe(draft(`p${i}`));
    });
    expect(h.api.pipes).toHaveLength(MAX_PIPES);
    // Newest first, oldest gone.
    expect(h.api.pipes[0].content).toBe(`p${MAX_PIPES + 7}`);
    expect(h.api.pipes.some((p) => p.content === "p0")).toBe(false);
  });

  it("peekPipe distinguishes empty content from a missing pipe", () => {
    const h = harness();
    let id = "";
    act(() => {
      id = h.api.pushPipe(draft("")).id;
    });
    // Regression: the old `|| null` turned legitimate empty content into a miss.
    expect(h.api.peekPipe(id)).toBe("");
    expect(h.api.peekPipe("does-not-exist")).toBeNull();
  });

  it("removePipe deletes only the targeted entry", () => {
    const h = harness();
    const ids: string[] = [];
    act(() => {
      for (let i = 0; i < 3; i++) ids.push(h.api.pushPipe(draft(`p${i}`)).id);
    });
    act(() => h.api.removePipe(ids[1]));
    expect(h.api.pipes.map((p) => p.content).sort()).toEqual(["p0", "p2"]);
  });

  it("delivers a payload to the addressed tool and focuses it", () => {
    const log: string[] = [];
    const h = harness(<Receiver toolId="inspector" log={log} />);
    act(() => {
      h.api.sendToTool("inspector", draft("legal winner thank"));
    });
    expect(log).toEqual(["legal winner thank"]);
    expect(h.api.activeTab).toBe("inspector");
    // Delivery is acknowledged, so it is no longer in flight.
    expect(h.api.queue).toHaveLength(0);
  });

  it("does not deliver a payload to a non-addressed tool", () => {
    const inspector: string[] = [];
    const wallet: string[] = [];
    const h = harness(
      <>
        <Receiver toolId="inspector" log={inspector} />
        <Receiver toolId="wallet" log={wallet} />
      </>
    );
    act(() => h.api.sendToTool("wallet", draft("only for wallet")));
    expect(wallet).toEqual(["only for wallet"]);
    expect(inspector).toEqual([]);
  });

  it("keeps every payload when two are sent back to back", () => {
    const log: string[] = [];
    const h = harness(<Receiver toolId="inspector" log={log} />);
    act(() => {
      h.api.sendToTool("inspector", draft("first"));
      h.api.sendToTool("inspector", draft("second"));
    });
    // Regression: a single `inboundPayload` slot dropped "first" here.
    expect(log).toEqual(["first", "second"]);
  });

  it("holds a delivery for a tool that mounts later", () => {
    const log: string[] = [];
    function Late() {
      const [show, setShow] = useState(false);
      return (
        <>
          <button onClick={() => setShow(true)}>mount</button>
          {show && <Receiver toolId="inspector" log={log} />}
        </>
      );
    }
    const h = harness(<Late />);
    act(() => h.api.sendToTool("inspector", draft("waiting")));
    expect(log).toEqual([]);
    act(() => screen.getByText("mount").click());
    // Hardening: queued deliveries persist until their tool actually mounts.
    expect(log).toEqual(["waiting"]);
  });

  it("applies a delivery exactly once under StrictMode", () => {
    const log: string[] = [];
    const h = harness(<Receiver toolId="inspector" log={log} />, true);
    act(() => h.api.sendToTool("inspector", draft("once")));
    expect(log).toEqual(["once"]);
  });

  it("sending to a tool also parks a recoverable copy in the inbox", () => {
    const log: string[] = [];
    const h = harness(<Receiver toolId="inspector" log={log} />);
    act(() => h.api.sendToTool("inspector", draft("recoverable")));
    expect(h.api.pipes.map((p) => p.content)).toContain("recoverable");
  });

  it("restores the inbox from storage on remount", () => {
    const first = harness();
    act(() => {
      first.api.pushPipe(draft("survives reload"));
    });
    first.unmount();

    // Regression: pipes lived only in memory and vanished on refresh.
    const second = harness();
    expect(second.api.pipes.map((p) => p.content)).toEqual(["survives reload"]);
  });

  it("survives corrupt storage instead of throwing", () => {
    localStorage.setItem("bhw.pipes.v1", "{not json");
    const h = harness();
    expect(h.api.pipes).toEqual([]);
  });

  it("clearPipes empties the inbox", () => {
    const h = harness();
    act(() => {
      h.api.pushPipe(draft("a"));
      h.api.pushPipe(draft("b"));
    });
    act(() => h.api.clearPipes());
    expect(h.api.pipes).toEqual([]);
  });
});
