import { useState } from "react";
import { usePipe } from "./PipeProvider";
import { CONTENT_TYPE_META, type PipeContentType, type PipeDraft } from "./types";

/** "Park this in the inbox" button, rendered inside a producing tool. */
export function PipeOutButton({
  draft,
  compact = false,
}: {
  draft: PipeDraft;
  compact?: boolean;
}) {
  const { pushPipe } = usePipe();
  const [done, setDone] = useState(false);

  return (
    <button
      onClick={() => {
        pushPipe(draft);
        setDone(true);
        window.setTimeout(() => setDone(false), 1400);
      }}
      title="Save to Pipe Inbox"
      className={`inline-flex items-center gap-1 rounded border font-bold transition ${
        done
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
          : "border-violet-500/35 bg-violet-600/15 text-violet-300 hover:bg-violet-600/30"
      } ${compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"}`}
    >
      <span>{done ? "✓" : "📤"}</span>
      {done ? "Piped" : "Pipe"}
    </button>
  );
}

/**
 * "Pull from Pipe" dropdown, rendered inside a consuming tool. Lists parked
 * pipes whose content type this tool accepts.
 */
export function PipeInButton({
  accepts,
  onReceive,
  compact = false,
}: {
  accepts: PipeContentType[];
  onReceive: (content: string, contentType: PipeContentType) => void;
  compact?: boolean;
}) {
  const { pipes, removePipe } = usePipe();
  const [open, setOpen] = useState(false);
  const usable =
    accepts.length === 0 ? pipes : pipes.filter((p) => accepts.includes(p.contentType));

  if (usable.length === 0 && !open) return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Receive piped data from another tool"
        className={`relative inline-flex items-center gap-1 rounded border border-cyan-500/35 bg-cyan-600/15 font-bold text-cyan-300 transition hover:bg-cyan-600/30 ${
          compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
        }`}
      >
        <span>📥</span>
        {compact ? "Pull" : "Pull from Pipe"}
        {usable.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-500 text-[8px] font-black text-zinc-950">
            {usable.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 max-h-80 min-w-[260px] max-w-[340px] overflow-hidden rounded-lg border border-cyan-500/30 bg-zinc-950 shadow-2xl">
            <p className="border-b border-cyan-500/20 bg-cyan-600/15 px-3 py-2 text-[9px] font-extrabold uppercase tracking-wider text-cyan-300">
              Pipe Inbox ({usable.length})
            </p>
            <div className="max-h-64 overflow-y-auto p-1.5">
              {usable.length === 0 ? (
                <p className="px-2 py-3 text-center text-[10px] italic text-zinc-500">
                  Nothing compatible in the inbox.
                </p>
              ) : (
                usable.map((p) => {
                  const meta = CONTENT_TYPE_META[p.contentType];
                  return (
                    <div
                      key={p.id}
                      className="mb-1 rounded border border-zinc-800 bg-zinc-900/60 p-2"
                    >
                      <p className="flex items-center gap-1 text-[10px] font-bold text-zinc-200">
                        <span className={meta.tint}>{meta.icon}</span>
                        {p.label}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-zinc-500">
                        {p.content}
                      </p>
                      <div className="mt-1.5 flex gap-1">
                        <button
                          onClick={() => {
                            onReceive(p.content, p.contentType);
                            setOpen(false);
                          }}
                          className="flex-1 rounded bg-cyan-600 py-1 text-[9px] font-bold text-zinc-950 transition hover:bg-cyan-500"
                        >
                          Use this value
                        </button>
                        <button
                          onClick={() => removePipe(p.id)}
                          className="rounded border border-zinc-700 px-1.5 text-[9px] text-zinc-400 transition hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
