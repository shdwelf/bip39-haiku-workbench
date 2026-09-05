import { usePipe } from "../pipe/PipeProvider";

/**
 * The Crypto Cookbook, served from /apps/cookbook/ and framed here so it stays
 * byte-identical to the original document rather than being re-typeset.
 */
export default function Cookbook() {
  const { setActiveTab } = usePipe();

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              📚 Crypto Cookbook
            </h2>
            <p className="text-[11px] text-zinc-500">
              Block, stream, asymmetric, MAC and PQC reference — 83 sections.
              Appears as an appendix when you export the book.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("book")}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
            >
              📖 Back to the book
            </button>
            <a
              href="/apps/cookbook/"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-cyan-400"
            >
              ↗ Open full page
            </a>
          </div>
        </div>
      </section>

      <iframe
        src="/apps/cookbook/"
        title="Crypto Cookbook"
        className="h-[75vh] w-full rounded-xl border border-zinc-800 bg-white"
      />
    </div>
  );
}
