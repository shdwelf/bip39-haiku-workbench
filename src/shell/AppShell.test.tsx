import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import AppShell, { type NavItem } from "./AppShell";
import Collapsible from "./Collapsible";

const NAV: NavItem[] = [
  { id: "enso", label: "Ensō Forge", icon: "⭕" },
  { id: "wallet", label: "Haiku Wallet", icon: "🪙" },
];

/** jsdom has no matchMedia; emulate a viewport width. */
function setViewport(desktop: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("min-width: 1024px") ? desktop : false,
        media: query,
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
        dispatchEvent: () => false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList
  );
}

function renderShell(onNavigate = vi.fn(), activeId = "enso") {
  const utils = render(
    <AppShell
      nav={NAV}
      activeId={activeId}
      onNavigate={onNavigate}
      title="BIP-39 Haiku Workbench"
      inboxTitle="Pipe Inbox"
      inboxBadge={3}
      inbox={<div>INBOX BODY</div>}
      footer={<span>FOOTER</span>}
    >
      <div>TOOL BODY</div>
    </AppShell>
  );
  return { ...utils, onNavigate };
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AppShell — desktop", () => {
  beforeEach(() => setViewport(true));

  it("shows labelled nav by default and collapses to an icon rail", () => {
    renderShell();
    const navBtn = () => screen.getByRole("button", { name: "Ensō Forge" });
    expect(navBtn().textContent).toContain("Ensō Forge");

    const burger = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(burger.getAttribute("aria-expanded")).toBe("true");
    act(() => fireEvent.click(burger));

    // Visible label is gone, but the icon-only button keeps an accessible
    // name via title — so it stays usable with a screen reader.
    expect(navBtn().textContent).not.toContain("Ensō Forge");
    expect(navBtn().getAttribute("title")).toBe("Ensō Forge");
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("remembers the collapsed rail across remounts", () => {
    const a = renderShell();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" })));
    a.unmount();

    renderShell();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
  });

  it("docks and undocks the inbox", () => {
    renderShell();
    expect(screen.queryByText("INBOX BODY")).toBeNull();

    act(() => fireEvent.click(screen.getByRole("button", { name: "Show Pipe Inbox" })));
    expect(screen.getByText("INBOX BODY")).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole("button", { name: "Hide Pipe Inbox" })));
    expect(screen.queryByText("INBOX BODY")).toBeNull();
  });

  it("keeps content and footer rendered", () => {
    renderShell();
    expect(screen.getByText("TOOL BODY")).toBeTruthy();
    expect(screen.getByText("FOOTER")).toBeTruthy();
  });

  it("marks the active tool for assistive tech", () => {
    renderShell(vi.fn(), "wallet");
    expect(
      screen.getByRole("button", { name: "Haiku Wallet" }).getAttribute("aria-current")
    ).toBe("page");
  });
});

describe("AppShell — mobile", () => {
  beforeEach(() => setViewport(false));

  it("hides the nav until the hamburger opens it", () => {
    renderShell();
    expect(screen.queryByRole("button", { name: "Ensō Forge" })).toBeNull();

    act(() => fireEvent.click(screen.getByRole("button", { name: "Open menu" })));
    expect(screen.getByRole("button", { name: "Ensō Forge" })).toBeTruthy();
  });

  it("closes the nav after choosing a tool", () => {
    const onNavigate = vi.fn();
    renderShell(onNavigate);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Open menu" })));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Haiku Wallet" })));

    expect(onNavigate).toHaveBeenCalledWith("wallet");
    expect(screen.queryByRole("button", { name: "Haiku Wallet" })).toBeNull();
  });

  it("closes an open overlay on Escape", () => {
    renderShell();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Open menu" })));
    expect(screen.getByRole("button", { name: "Ensō Forge" })).toBeTruthy();

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.queryByRole("button", { name: "Ensō Forge" })).toBeNull();
  });

  it("locks body scroll only while an overlay is open", () => {
    renderShell();
    expect(document.body.style.overflow).not.toBe("hidden");

    act(() => fireEvent.click(screen.getByRole("button", { name: "Open menu" })));
    expect(document.body.style.overflow).toBe("hidden");

    act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("does not restore an overlay on reload", () => {
    const a = renderShell();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Open menu" })));
    a.unmount();

    // A modal overlay restored on load would trap the user behind a backdrop.
    renderShell();
    expect(screen.queryByRole("button", { name: "Ensō Forge" })).toBeNull();
  });
});

describe("Collapsible", () => {
  beforeEach(() => setViewport(true));

  it("toggles and reports state via aria-expanded", () => {
    render(
      <Collapsible title="Targets" storageKey="t1">
        <div>PANEL</div>
      </Collapsible>
    );
    const btn = screen.getByRole("button", { name: /Targets/ });
    expect(btn.getAttribute("aria-expanded")).toBe("true");

    act(() => fireEvent.click(btn));
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("hides rather than unmounts, so tool state survives", () => {
    render(
      <Collapsible title="Targets" storageKey="t2">
        <input defaultValue="half typed" />
      </Collapsible>
    );
    const input = screen.getByDisplayValue("half typed");
    act(() => fireEvent.click(screen.getByRole("button", { name: /Targets/ })));

    // Still in the DOM (hidden), so its value is not lost.
    expect(screen.getByDisplayValue("half typed")).toBe(input);
  });

  it("remembers its state per storageKey", () => {
    const a = render(
      <Collapsible title="Targets" storageKey="t3">
        <div>PANEL</div>
      </Collapsible>
    );
    act(() => fireEvent.click(screen.getByRole("button", { name: /Targets/ })));
    a.unmount();

    render(
      <Collapsible title="Targets" storageKey="t3">
        <div>PANEL</div>
      </Collapsible>
    );
    expect(
      screen.getByRole("button", { name: /Targets/ }).getAttribute("aria-expanded")
    ).toBe("false");
  });
});
