import { useMemo, useState } from "react";
import { CATALOG, type CatalogEntry } from "../lib/catalog";
import { validateMnemonic } from "../lib/wallet";
import { greedy575 } from "../lib/syllables";
import { PipeOutButton } from "../pipe/PipeButtons";
import Collapsible from "../shell/Collapsible";

const TOOL_NAME = "Art Gallery";
const TARGETS = [5, 7, 5];

const TYPE_FILTERS = [
  "all",
  ...Array.from(new Set(CATALOG.map((c) => c.type))),
] as const;

function EntryCard({ entry }: { entry: CatalogEntry }) {
  const words = useMemo(
    () => entry.text.toLowerCase().trim().split(/\s+/),
    [entry]
  );
  const valid = useMemo(
    () => validateMnemonic(entry.text.toLowerCase()),
    [entry]
  );
  const shape = useMemo(() => greedy575(words), [words]);
  const isHaiku = entry.type.includes("haiku");

  return (
    <article className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
            valid
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-red-500/15 text-red-300"
          }`}
          title="Re-verified against the BIP-39 checksum when this card rendered"
        >
          {valid ? "✓ checksum valid" : "✕ invalid"}
        </span>
        <span className="text-[9px] text-zinc-500">{words.length} words</span>
      </div>

      {isHaiku ? (
        <div className="mb-2 space-y-0.5">
          {shape.lines.map((line, i) => (
            <p key={i} className="font-serif text-sm leading-snug text-zinc-200">
              {line.join(" ") || "—"}
              <span
                className={`ml-2 align-middle text-[9px] ${
                  shape.counts[i] === TARGETS[i]
                    ? "text-emerald-400/80"
                    : "text-amber-400/80"
                }`}
              >
                {shape.counts[i]}
              </span>
            </p>
          ))}
        </div>
      ) : (
        <p className="mb-2 break-words font-mono text-[11px] leading-relaxed text-zinc-300">
          {entry.text}
        </p>
      )}

      <p className="mt-auto text-[10px] text-zinc-500">{entry.pattern}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-zinc-600">
          {shape.counts.join("-")} shape
        </span>
        <PipeOutButton
          compact
          draft={{
            content: entry.text.toLowerCase(),
            contentType: "mnemonic",
            sourceId: "gallery",
            sourceName: TOOL_NAME,
            label: `${entry.type} entry`,
          }}
        />
      </div>
    </article>
  );
}

export default function ArtGallery() {
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>("all");
  const shown = useMemo(
    () => (type === "all" ? CATALOG : CATALOG.filter((c) => c.type === type)),
    [type]
  );
  const allValid = useMemo(
    () => CATALOG.every((c) => validateMnemonic(c.text.toLowerCase())),
    []
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              🖼 {TOOL_NAME}
            </h2>
            <p className="text-[11px] text-zinc-500">
              Curated BIP-39 art patterns — phrases whose words repeat, rhyme or
              scan, every one carrying a valid checksum. Ported from the vanilla
              workbench's catalog and re-verified live on render.
            </p>
          </div>
          <span
            className={`rounded px-2 py-1 text-[10px] font-semibold ${
              allValid
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            {allValid
              ? `all ${CATALOG.length} entries checksum-valid`
              : "some entries failed verification"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                type === t
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t === "all"
                ? `all ${CATALOG.length}`
                : `${t} (${CATALOG.filter((c) => c.type === t).length})`}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((entry) => (
          <EntryCard key={entry.text} entry={entry} />
        ))}
      </div>

      <Collapsible
        storageKey="bhw.gallery.about"
        title="Why these are found art"
        icon="ℹ"
        defaultOpen={false}
      >
        <p className="text-xs leading-relaxed text-zinc-500">
          In BIP-39 the last word of a phrase is not free: its low bits are the
          checksum of everything before it. An eleven-word stem of repeated
          words therefore pins exactly one valid twelfth word — the pattern
          chooses the stem, and the checksum chooses the ending. The 5-7-5
          entries are the same idea on quiet nature words, and the 15- and
          24-word patterns stretch it across the longer strengths. Every card
          above was re-validated the moment it rendered, so a corrupted import
          shows up immediately.
        </p>
      </Collapsible>
    </div>
  );
}
