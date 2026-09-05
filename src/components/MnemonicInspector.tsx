import { useMemo, useState } from "react";
import { deriveAddresses, validateMnemonic, WORDLIST } from "../lib/wallet";
import { countSyllables } from "../lib/syllables";
import { PipeInButton, PipeOutButton } from "../pipe/PipeButtons";
import { usePipeReceiver } from "../pipe/PipeProvider";
import Collapsible from "../shell/Collapsible";

const TOOL_ID = "inspector";
const TOOL_NAME = "Mnemonic Inspector";

export default function MnemonicInspector() {
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  // Deliveries pushed at this tool from the inbox land here.
  usePipeReceiver(TOOL_ID, (d) => {
    setText(d.content.replace(/\n+/g, " ").replace(/\s+/g, " ").trim());
    setFlash(`Received ${d.contentType} from ${d.sourceName}`);
    window.setTimeout(() => setFlash(null), 2600);
  });

  const words = useMemo(
    () => text.toLowerCase().trim().split(/\s+/).filter(Boolean),
    [text]
  );

  const analysis = useMemo(() => {
    if (words.length === 0) return null;
    const unknown = words.filter((w) => !WORDLIST.includes(w));
    const valid = unknown.length === 0 && validateMnemonic(words.join(" "));
    const syllables = words.map(countSyllables);
    const total = syllables.reduce((a, b) => a + b, 0);

    // Greedy 5/7/5 split across the word sequence.
    const lines: string[][] = [[], [], []];
    const targets = [5, 7, 5];
    let li = 0;
    let acc = 0;
    for (let i = 0; i < words.length && li < 3; i++) {
      lines[li].push(words[i]);
      acc += syllables[i];
      if (acc >= targets[li]) {
        li++;
        acc = 0;
      }
    }
    const counts = lines.map((l) =>
      l.reduce((s, w) => s + countSyllables(w), 0)
    );
    const isHaiku =
      counts[0] === 5 && counts[1] === 7 && counts[2] === 5 && li >= 2;

    let derived: { btcLegacy: string; path: string; xpub: string } | null = null;
    if (valid) {
      try {
        derived = deriveAddresses(words.join(" "));
      } catch {
        derived = null;
      }
    }

    return { unknown, valid, syllables, total, lines, counts, isHaiku, derived };
  }, [words]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              🔍 {TOOL_NAME}
            </h2>
            <p className="text-[11px] text-zinc-500">
              Paste or pipe in a mnemonic to check its BIP-39 checksum and 5-7-5
              shape.
            </p>
          </div>
          <div className="flex gap-1.5">
            <PipeInButton
              accepts={["mnemonic", "haiku", "text"]}
              onReceive={(content) =>
                setText(content.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
              }
            />
            {text.trim() && (
              <PipeOutButton
                draft={{
                  content: text.trim(),
                  contentType: "mnemonic",
                  sourceId: TOOL_ID,
                  sourceName: TOOL_NAME,
                  label: `${words.length}-word phrase`,
                }}
              />
            )}
          </div>
        </div>

        {flash && (
          <p className="mb-2 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300">
            {flash}
          </p>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="abandon ability able about above absent…"
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-sm text-emerald-300 outline-none focus:border-cyan-600"
        />
      </section>

      {analysis && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Collapsible storageKey="bhw.insp.validity" title="Validity" icon="✅">
            <dl className="space-y-2 text-sm">
              <Row label="Words" value={String(words.length)} />
              <Row label="Total syllables" value={String(analysis.total)} />
              <Row
                label="BIP-39 checksum"
                value={analysis.valid ? "valid ✓" : "invalid ✕"}
                tone={analysis.valid ? "good" : "bad"}
              />
              <Row
                label="5-7-5 haiku"
                value={analysis.isHaiku ? "yes ✓" : "no"}
                tone={analysis.isHaiku ? "good" : "warn"}
              />
            </dl>
            {analysis.unknown.length > 0 && (
              <p className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
                Not in the BIP-39 wordlist:{" "}
                <span className="font-mono">{analysis.unknown.join(", ")}</span>
              </p>
            )}
          </Collapsible>

          <Collapsible storageKey="bhw.insp.haiku" title="Haiku shape" icon="🍃">
            <div className="space-y-1.5">
              {analysis.lines.map((line, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-3 rounded bg-zinc-950 px-3 py-2"
                >
                  <span className="font-mono text-sm text-emerald-300">
                    {line.join(" ") || "—"}
                  </span>
                  <span
                    className={`shrink-0 font-mono text-xs ${
                      analysis.counts[i] === [5, 7, 5][i]
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {analysis.counts[i]}/{[5, 7, 5][i]}
                  </span>
                </div>
              ))}
            </div>
            {analysis.isHaiku && (
              <div className="mt-3">
                <PipeOutButton
                  draft={{
                    content: analysis.lines.map((l) => l.join(" ")).join("\n"),
                    contentType: "haiku",
                    sourceId: TOOL_ID,
                    sourceName: TOOL_NAME,
                    label: "5-7-5 haiku",
                  }}
                />
              </div>
            )}
          </Collapsible>

          {analysis.derived && (
            <Collapsible
              className="lg:col-span-2"
              storageKey="bhw.insp.derived"
              title={`Derived (BIP-44 ${analysis.derived.path})`}
              icon="🔑"
            >
              <div className="space-y-2">
                <Mono
                  label="BTC legacy"
                  value={analysis.derived.btcLegacy}
                  pipe={{
                    content: analysis.derived.btcLegacy,
                    contentType: "address" as const,
                    sourceId: TOOL_ID,
                    sourceName: TOOL_NAME,
                    label: "BTC address",
                  }}
                />
                <Mono
                  label="Account xpub"
                  value={analysis.derived.xpub}
                  pipe={{
                    content: analysis.derived.xpub,
                    contentType: "xpub" as const,
                    sourceId: TOOL_ID,
                    sourceName: TOOL_NAME,
                    label: "Account xpub",
                  }}
                />
              </div>
            </Collapsible>
          )}
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "warn";
}) {
  const tint =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-rose-400"
        : tone === "warn"
          ? "text-amber-400"
          : "text-zinc-200";
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`font-mono ${tint}`}>{value}</dd>
    </div>
  );
}

function Mono({
  label,
  value,
  pipe,
}: {
  label: string;
  value: string;
  pipe: Parameters<typeof PipeOutButton>[0]["draft"];
}) {
  return (
    <div className="rounded bg-zinc-950 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <PipeOutButton draft={pipe} compact />
      </div>
      <p className="break-all font-mono text-xs text-cyan-300">{value}</p>
    </div>
  );
}
