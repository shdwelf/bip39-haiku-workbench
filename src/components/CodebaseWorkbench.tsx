import { useMemo, useState } from "react";

// These are the uploaded applications themselves, not React reimplementations.
// Keeping them as raw documents lets each bundle retain its own CSS, storage,
// workers, downloads, and duplicate element ids without leaking into a sibling.
// The canonical Gen2 document receives one signature-guarded Poetry bug fix.
import gen2August23 from "../../bip39-haiku-workbench-gen2-2026-08-23T11-46-10-756Z.html?raw";
import gen2August14 from "../../bip39-haiku-workbench-gen2-2026-08-14T20-01-22-058Z.html?raw";
import quipBuild from "../../bip39-haiku-workbench-quip.html?raw";
import classicWallet from "../../bip39_haiku_wallet.html?raw";
import patternValidator from "../../haikubip39.html?raw";
import { patchGen2Poetry } from "../lib/poetryPatch";

export type CodebaseId = "gen2" | "suite" | "gen2-aug14" | "quip" | "wallet-classic" | "validator-classic";

export interface ArchivedCodebase {
  id: Exclude<CodebaseId, "suite">;
  label: string;
  shortLabel: string;
  description: string;
  filename: string;
  /** Original uploaded document, retained for provenance and digest checks. */
  originalHtml: string;
  /** Runnable document; only Gen2 Aug 23 receives the targeted Poetry repair. */
  html: string;
}

/**
 * Every distinct, non-empty HTML codebase uploaded in the gen-2 patch.
 *
 * The second 23 August file is intentionally not listed: it is byte-for-byte
 * identical to the first (the digest is locked in test/codebase-archive.test.ts).
 * `bip39haiku.html` is also intentionally absent because it is a zero-byte file.
 */
export const ARCHIVED_CODEBASES: readonly ArchivedCodebase[] = [
  {
    id: "gen2",
    label: "Gen2 Workbench · 23 Aug 2026",
    shortLabel: "Gen2 · Aug 23",
    description: "The complete 12-tool Webxdc/quine build, with strict Poetry syllable validation.",
    filename: "bip39-haiku-workbench-gen2-2026-08-23T11-46-10-756Z.html",
    originalHtml: gen2August23,
    html: patchGen2Poetry(gen2August23),
  },
  {
    id: "gen2-aug14",
    label: "Gen2 Workbench · 14 Aug 2026",
    shortLabel: "Gen2 · Aug 14",
    description: "The earlier seven-tool generation, preserved without a visual rewrite.",
    filename: "bip39-haiku-workbench-gen2-2026-08-14T20-01-22-058Z.html",
    originalHtml: gen2August14,
    html: gen2August14,
  },
  {
    id: "quip",
    label: "Quip Workbench",
    shortLabel: "Quip build",
    description: "The uploaded mnemonic validator and derivation explorer bundle.",
    filename: "bip39-haiku-workbench-quip.html",
    originalHtml: quipBuild,
    html: quipBuild,
  },
  {
    id: "wallet-classic",
    label: "Classic Haiku Wallet",
    shortLabel: "Classic wallet",
    description: "The standalone miner, wallet list, and encrypted export application.",
    filename: "bip39_haiku_wallet.html",
    originalHtml: classicWallet,
    html: classicWallet,
  },
  {
    id: "validator-classic",
    label: "Classic Pattern Validator",
    shortLabel: "Pattern validator",
    description: "The original repeated-word and haiku checksum validator.",
    filename: "haikubip39.html",
    originalHtml: patternValidator,
    html: patternValidator,
  },
] as const;

export const SUITE_DESCRIPTION =
  "The typed-source recovery suite: recovery lab, pipe inbox, vaults, MonKey, book, and companion tools.";

export function findArchivedCodebase(id: CodebaseId): ArchivedCodebase | undefined {
  return ARCHIVED_CODEBASES.find((codebase) => codebase.id === id);
}

export function EmbeddedCodebase({ codebase }: { codebase: ArchivedCodebase }) {
  return (
    <iframe
      key={codebase.id}
      title={codebase.label}
      srcDoc={codebase.html}
      className="block h-dvh w-full border-0 bg-[#060b14]"
      allow="clipboard-read; clipboard-write"
      referrerPolicy="no-referrer"
    />
  );
}

interface WorkspaceOption {
  id: CodebaseId;
  label: string;
  description: string;
  provenance: string;
}

const WORKSPACES: readonly WorkspaceOption[] = [
  ...ARCHIVED_CODEBASES.map((codebase) => ({
    id: codebase.id,
    label: codebase.shortLabel,
    description: codebase.description,
    provenance: codebase.id === "gen2" ? "upload + validator fix" : "exact uploaded HTML",
  })),
  {
    id: "suite",
    label: "Recovery suite",
    description: SUITE_DESCRIPTION,
    provenance: "maintained TypeScript source",
  },
];

function downloadCodebase(codebase: ArchivedCodebase) {
  const url = URL.createObjectURL(new Blob([codebase.html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = codebase.filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** A deliberately small overlay: the canonical Gen2 document still owns the canvas. */
export function CodebaseSwitcher({
  activeId,
  onSelect,
}: {
  activeId: CodebaseId;
  onSelect: (id: CodebaseId) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeArchive = useMemo(() => findArchivedCodebase(activeId), [activeId]);
  const active = WORKSPACES.find((workspace) => workspace.id === activeId) ?? WORKSPACES[0];

  return (
    <div className="fixed right-3 top-3 z-[2147483647] font-sans text-zinc-100">
      {open && (
        <section
          aria-label="Combined codebases"
          className="mb-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-cyan-300/25 bg-zinc-950/95 shadow-2xl shadow-black/70 backdrop-blur-xl"
        >
          <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Combined workbench</p>
              <h2 className="mt-1 text-sm font-semibold text-white">Choose the actual codebase</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close codebase switcher"
              className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
          </header>

          <div className="max-h-[min(32rem,70vh)] space-y-1 overflow-y-auto p-2">
            {WORKSPACES.map((workspace) => {
              const selected = workspace.id === activeId;
              return (
                <button
                  type="button"
                  key={workspace.id}
                  onClick={() => {
                    onSelect(workspace.id);
                    setOpen(false);
                  }}
                  aria-current={selected ? "page" : undefined}
                  className={`block w-full rounded-lg border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-cyan-300/50 bg-cyan-300/10"
                      : "border-transparent hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className={`text-sm font-semibold ${selected ? "text-cyan-200" : "text-zinc-100"}`}>
                      {workspace.label}
                    </span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-zinc-500">
                      {workspace.provenance}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">
                    {workspace.description}
                  </span>
                </button>
              );
            })}
          </div>

          <footer className="border-t border-white/10 px-4 py-3 text-[10px] leading-relaxed text-zinc-500">
            <p>The duplicate 23 Aug upload is byte-identical; the empty upload contains no code.</p>
            {activeArchive && (
              <button
                type="button"
                onClick={() => downloadCodebase(activeArchive)}
                className="mt-2 font-semibold text-cyan-300 hover:text-cyan-200"
              >
                ↓ Save this {activeArchive.id === "gen2" ? "fixed" : "original"} HTML
              </button>
            )}
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Switch combined codebase"
        title="Switch combined codebase"
        className="ml-auto flex items-center gap-2 rounded-full border border-cyan-300/30 bg-zinc-950/90 px-3 py-2 text-xs font-semibold shadow-lg shadow-black/50 backdrop-blur transition hover:border-cyan-200/60 hover:bg-zinc-900"
      >
        <span aria-hidden className="text-cyan-300">⌘</span>
        <span className="max-w-36 truncate">{active.label}</span>
      </button>
    </div>
  );
}
