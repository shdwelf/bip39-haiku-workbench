import { useState } from "react";
import { usePipe } from "./PipeProvider";
import { CONTENT_TYPE_META, type PipeContentType } from "./types";

function relTime(ts: number) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const TOOL_TARGETS: { id: string; label: string; accepts: PipeContentType[] }[] = [
  { id: "wallet", label: "Haiku Wallet", accepts: ["mnemonic", "haiku", "text"] },
  {
    id: "inspector",
    label: "Mnemonic Inspector",
    accepts: ["mnemonic", "haiku", "address", "xpub", "json", "text"],
  },
];

/**
 * Floating inbox drawer. Lists every parked pipe and lets the user forward one
 * into a tool that accepts its content type.
 */
export default function PipeInbox() {
  const { pipes, removePipe, clearPipes, sendToTool, queue } = usePipe();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Pipe Inbox"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border-2 border-violet-400/40 bg-violet-600 px-4 py-3 font-semibold text-white shadow-2xl shadow-violet-950/50 transition hover:scale-105"
      >
        <span className="text-lg leading-none">📥</span>
        <span className="text-sm">Inbox</span>
        {pipes.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-zinc-950 bg-cyan-400 px-1 text-[10px] font-black text-zinc-950">
            {pipes.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-violet-500/30 bg-zinc-950 shadow-2xl">
            <header className="flex items-start justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-black text-white">
                  <span className="text-violet-400">📥</span> Pipe Inbox
                </h2>
                <p className="mt-0.5 font-mono text-[10px] text-violet-300">
                  {pipes.length} stored {pipes.length === 1 ? "pipe" : "pipes"}
                  {queue.length > 0 && ` · ${queue.length} in flight`} · send
                  between tools
                </p>
              </div>
              <div className="flex gap-1.5">
                {pipes.length > 0 && (
                  <button
                    onClick={clearPipes}
                    className="rounded border border-rose-500/40 px-2 py-1 text-[11px] text-rose-300 transition hover:bg-rose-500/15"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-800"
                >
                  Close
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-3">
              {pipes.length === 0 ? (
                <div className="py-16 text-center text-zinc-500">
                  <p className="mb-3 text-4xl opacity-30">📥</p>
                  <p className="mb-1 text-sm font-bold">Inbox is empty</p>
                  <p className="text-xs leading-relaxed">
                    Use a <span className="text-violet-300">Pipe</span> button in
                    any tool to park data here, then send it into another tool.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {pipes.map((p) => {
                    const meta = CONTENT_TYPE_META[p.contentType];
                    const targets = TOOL_TARGETS.filter((t) =>
                      t.accepts.includes(p.contentType)
                    );
                    return (
                      <li
                        key={p.id}
                        className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                              <span className={meta.tint}>{meta.icon}</span>
                              {p.label}
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                              {meta.name} · {p.sourceName} · {relTime(p.createdAt)}
                            </p>
                          </div>
                          <button
                            onClick={() => removePipe(p.id)}
                            title="Discard"
                            className="shrink-0 rounded px-1.5 text-zinc-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                          >
                            ✕
                          </button>
                        </div>

                        <pre className="mt-2 max-h-20 overflow-y-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed text-emerald-300">
                          {p.content}
                        </pre>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {targets.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                sendToTool(t.id, {
                                  content: p.content,
                                  contentType: p.contentType,
                                  sourceId: p.sourceId,
                                  sourceName: p.sourceName,
                                  label: p.label,
                                });
                                setOpen(false);
                              }}
                              className="rounded bg-cyan-600 px-2 py-1 text-[10px] font-bold text-zinc-950 transition hover:bg-cyan-500"
                            >
                              → {t.label}
                            </button>
                          ))}
                          <button
                            onClick={() => navigator.clipboard?.writeText(p.content)}
                            className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 transition hover:bg-zinc-800"
                          >
                            Copy
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
