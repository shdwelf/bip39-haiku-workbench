// Testing Library only auto-registers cleanup when Vitest globals are enabled.
// We keep globals off (explicit imports), so unmount between tests here —
// otherwise each render stacks in the DOM and queries match multiple elements.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
