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
    label: "Inspector",
    accepts: ["mnemonic", "haiku", "address", "xpub", "json", "text"],
  },
];

/**
 * Inbox contents, rendered inside the shell's right sidebar.
 * The shell owns the header and the show/hide affordance.
 */
export default function PipeInboxPanel() {
  const { pipes, removePipe, clearPipes, sendToTool, queue } = usePipe();

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] text-violet-300">
          {pipes.length} stored {pipes.length === 1 ? "pipe" : "pipes"}
          {queue.length > 0 && ` · ${queue.length} in flight`}
        </p>
        {pipes.length > 0 && (
          <button
            onClick={clearPipes}
            className="rounded border border-rose-500/40 px-2 py-0.5 text-[10px] text-rose-300 transition hover:bg-rose-500/15"
          >
            Clear
          </button>
        )}
      </div>

      {pipes.length === 0 ? (
        <div className="py-12 text-center text-zinc-500">
          <p className="mb-2 text-3xl opacity-30">📥</p>
          <p className="mb-1 text-sm font-bold">Inbox is empty</p>
          <p className="text-xs leading-relaxed">
            Use a <span className="text-violet-300">Pipe</span> button in any tool
            to park data here, then send it into another tool.
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
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">
                      <span className={meta.tint}>{meta.icon}</span>
                      <span className="truncate">{p.label}</span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                      {meta.name} · {p.sourceName} · {relTime(p.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => removePipe(p.id)}
                    title="Discard"
                    aria-label={`Discard ${p.label}`}
                    className="shrink-0 rounded px-1.5 text-zinc-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </div>

                <pre className="mt-2 max-h-16 overflow-y-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed text-emerald-300">
                  {p.content}
                </pre>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {targets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() =>
                        sendToTool(t.id, {
                          content: p.content,
                          contentType: p.contentType,
                          sourceId: p.sourceId,
                          sourceName: p.sourceName,
                          label: p.label,
                        })
                      }
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
  );
}
