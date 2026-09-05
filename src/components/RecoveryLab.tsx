import { useRef, useState } from "react";
import {
  levenshtein,
  mineBtcVanity,
  recoverMissingWords,
  recoverWithAnagramsAndTypos,
  type RecoveryMatch,
  type VanityResult,
} from "../lib/recovery";
import { WORDLIST } from "../lib/wallet";
import { PipeInButton, PipeOutButton } from "../pipe/PipeButtons";
import { usePipeReceiver } from "../pipe/PipeProvider";
import Collapsible from "../shell/Collapsible";

const TOOL_ID = "recovery";
const TOOL_NAME = "Recovery Lab";

// Live per-word validation chips, ported from the recovered
// crypto-mnemonic-mining-app's real-time word validation.
function WordChips({ text }: { text: string }) {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {words.map((w, i) => {
        const ok = w === "?" || w === "_" || WORDLIST.includes(w);
        return (
          <span
            key={i}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
              ok
                ? "bg-zinc-800 text-zinc-400"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            {w === "?" || w === "_" ? "?" : w}
          </span>
        );
      })}
    </div>
  );
}

function MatchCard({ m }: { m: RecoveryMatch }) {
  return (
    <article className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-zinc-300">
          {m.address}
        </span>
        <div className="flex gap-1.5">
          <PipeOutButton
            compact
            draft={{
              content: m.mnemonic,
              contentType: "mnemonic",
              sourceId: TOOL_ID,
              sourceName: TOOL_NAME,
              label: "recovered mnemonic",
            }}
          />
        </div>
      </div>
      <p className="font-mono text-xs leading-relaxed text-emerald-300">
        {m.mnemonic}
      </p>
      {m.replacedWords.length > 0 && (
        <p className="mt-1 text-[10px] text-zinc-500">
          {m.replacedWords
            .map((r) => `#${r.index + 1} ${r.original} → ${r.replacedWith}`)
            .join(" · ")}
        </p>
      )}
    </article>
  );
}

export default function RecoveryLab() {
  const [text, setText] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState<null | "missing" | "repair" | "vanity">(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<RecoveryMatch[] | null>(null);
  const cancel = useRef({ cancelled: false });

  // Vanity section state
  const [prefix, setPrefix] = useState("");
  const [vanity, setVanity] = useState<VanityResult | null>(null);

  usePipeReceiver(TOOL_ID, (d) => {
    setText(d.content.replace(/\n+/g, " ").replace(/\s+/g, " ").trim());
  });

  const run = async (mode: "missing" | "repair") => {
    if (busy) {
      cancel.current.cancelled = true;
      return;
    }
    if (!text.trim()) {
      setError("Paste a phrase first — use ? for words you cannot read.");
      return;
    }
    setError(null);
    setMatches(null);
    setBusy(mode);
    cancel.current = { cancelled: false };
    try {
      const found =
        mode === "missing"
          ? await recoverMissingWords(text, {
              cancel: cancel.current,
              targetAddress: target.trim(),
              onProgress: (a) =>
                setProgress(
                  a >= 2048 * 2048
                    ? `${(a / 1e6).toFixed(1)}M candidates tested`
                    : `${a.toLocaleString()} candidates tested`
                ),
            })
          : await recoverWithAnagramsAndTypos(text, {
              cancel: cancel.current,
              targetAddress: target.trim(),
              onProgress: (w, t, a) =>
                setProgress(`word ${w}/${t} · ${a.toLocaleString()} candidates`),
            });
      setMatches(found);
      if (found.length === 0) {
        setError(
          "No checksum-valid candidate found. Widen the damage window or clear the address filter."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const runVanity = async () => {
    if (busy) {
      cancel.current.cancelled = true;
      return;
    }
    if (!prefix.trim()) {
      setError("Enter the address prefix to mine for (after the leading 1).");
      return;
    }
    setError(null);
    setVanity(null);
    setBusy("vanity");
    cancel.current = { cancelled: false };
    try {
      const res = await mineBtcVanity(prefix.trim(), {
        cancel: cancel.current,
        onProgress: (a) => setProgress(`${a.toLocaleString()} mnemonics tried`),
      });
      if (res) setVanity(res);
      else setError("Stopped before a match. Each extra character is ~58× harder.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const busyLabel =
    busy === "missing"
      ? "Stop scan"
      : busy === "repair"
        ? "Stop repair"
        : busy === "vanity"
          ? "Stop mining"
          : null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              🧩 {TOOL_NAME}
            </h2>
            <p className="text-[11px] text-zinc-500">
              Recover damaged mnemonics and mine vanity addresses — checksum-gated
              brute force, ported from the recovered mining app onto the
              workbench's own BTC derivation.
            </p>
          </div>
          <div className="flex gap-1.5">
            <PipeInButton
              accepts={["mnemonic", "text"]}
              onReceive={(c) => setText(c.replace(/\s+/g, " ").trim())}
            />
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="veteran flood oak … ? … — mark each unread word with ?"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600"
        />
        <WordChips text={text} />

        <label className="mt-3 block text-[11px] text-zinc-500">
          Optional: target address fragment (e.g. the first characters of the
          wallet you know is yours) — filters checksum-valid candidates to yours
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            spellCheck={false}
            placeholder="1ABC…"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => run("missing")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              busy === "missing"
                ? "bg-red-600/80 text-white"
                : "bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
            }`}
          >
            {busy === "missing" ? busyLabel : "🔍 Find ? words"}
          </button>
          <button
            onClick={() => run("repair")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              busy === "repair"
                ? "bg-red-600/80 text-white"
                : "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
            }`}
          >
            {busy === "repair" ? busyLabel : "🩹 Repair typos & anagrams"}
          </button>
          {busy && <span className="self-center text-[11px] text-zinc-400">{progress}</span>}
        </div>

        {error && (
          <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
            {error}
          </p>
        )}
        {matches && matches.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-zinc-500">
              {matches.length} checksum-valid candidate{matches.length > 1 ? "s" : ""}:
            </p>
            {matches.map((m) => (
              <MatchCard key={m.mnemonic} m={m} />
            ))}
          </div>
        )}
      </section>

      <Collapsible storageKey="bhw.recovery.vanity" title="Vanity mining (BTC)" icon="⛏">
        <p className="mb-2 text-xs text-zinc-500">
          Mines fresh 12-word mnemonics until the BTC legacy address starts with
          your prefix (case-sensitive Base58; the leading <code>1</code> is
          optional). One extra character ≈ 58× the work — three characters is
          minutes, four is a long night.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">1</span>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            spellCheck={false}
            placeholder="abcd…"
            className="w-32 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600"
          />
          <button
            onClick={runVanity}
            disabled={!busy && prefix.trim().length === 0}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              busy === "vanity"
                ? "bg-red-600/80 text-white"
                : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
            }`}
          >
            {busy === "vanity" ? "Stop mining" : "⛏ Mine vanity address"}
          </button>
          {busy === "vanity" && (
            <span className="text-[11px] text-zinc-400">{progress}</span>
          )}
        </div>
        {vanity && (
          <div className="mt-3">
            <MatchCard
              m={{
                mnemonic: vanity.mnemonic,
                address: vanity.address,
                replacedWords: [],
              }}
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              found after {vanity.attempts.toLocaleString()} mnemonics
            </p>
          </div>
        )}
      </Collapsible>

      <Collapsible
        storageKey="bhw.recovery.about"
        title="How recovery works"
        icon="ℹ"
        defaultOpen={false}
      >
        <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-500">
          <li>
            A BIP-39 phrase carries its own checksum, so of the 2048 words that
            could fill a <code>?</code> slot, on average 1 in 16 survives for a
            12-word phrase — the checksum does most of the work.
          </li>
          <li>
            Two <code>?</code> slots walk 2048² = 4.2M combinations, chunked and
            cancellable; more than two is out of scope for a browser lab.
          </li>
          <li>
            Repairs try anagrams (letter shuffles that are themselves wordlist
            words) and near edits — Levenshtein distance ≤ 2 for unknown words,
            ≤ 1 for words that are valid but break the checksum.
          </li>
          <li>
            {`levenshtein("veteran", "veteren")`} ={" "}
            {levenshtein("veteran", "veteren")} — one transposition-style typo
            away, exactly what the repair pass catches.
          </li>
        </ul>
      </Collapsible>
    </div>
  );
}
