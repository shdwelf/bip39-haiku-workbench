import { useEffect, useRef, useState } from "react";
import {
  HaikuWalletItem,
  mineOne,
  validateMnemonic,
  saveVault,
  loadVault,
  exportEncryptedTxt,
  exportPlainTxt,
  itemFromMnemonic,
} from "../lib/wallet";
import { drawEnso } from "../lib/enso";
import { decodeEnsoId } from "../lib/enso";
import { PipeInButton, PipeOutButton } from "../pipe/PipeButtons";
import { usePipeReceiver } from "../pipe/PipeProvider";
import Collapsible from "../shell/Collapsible";

interface Props {
  ensoId: string;
}

function EnsoThumb({ ensoId }: { ensoId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const s = decodeEnsoId(ensoId);
    if (s && ref.current) drawEnso(ref.current, s);
  }, [ensoId]);
  return <canvas ref={ref} width={120} height={120} className="h-20 w-20 rounded-lg" />;
}

export default function HaikuWallet({ ensoId }: Props) {
  const [items, setItems] = useState<HaikuWalletItem[]>([]);
  const [count, setCount] = useState(1);
  const [requireGrammar, setRequireGrammar] = useState(true);
  const [grammarThreshold, setGrammarThreshold] = useState(70);
  const [mining, setMining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [forged, setForged] = useState(0);
  const cancel = useRef(false);
  const [imported, setImported] = useState<string | null>(null);

  // Accept a mnemonic piped in from another tool and fold it into the vault.
  usePipeReceiver("wallet", (d) => {
    const phrase = d.content.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
    if (!validateMnemonic(phrase)) {
      setImported(`Received an invalid BIP-39 phrase from ${d.sourceName}.`);
      window.setTimeout(() => setImported(null), 3200);
      return;
    }
    setImported(`Imported a phrase from ${d.sourceName}.`);
    window.setTimeout(() => setImported(null), 3200);
    addMnemonic(phrase);
  });

  // Load encrypted vault using the Ensō ID as the master password
  useEffect(() => {
    setItems(loadVault(ensoId));
  }, [ensoId]);

  const persist = (next: HaikuWalletItem[]) => {
    setItems(next);
    saveVault(next, ensoId);
  };

  // Add an externally supplied phrase (from the piped inbox) to the vault.
  const addMnemonic = (phrase: string) => {
    const item = itemFromMnemonic(phrase, ensoId);
    if (!item) return;
    setItems((prev) => {
      if (prev.some((p) => p.mnemonic === item.mnemonic)) return prev;
      const next = [item, ...prev];
      saveVault(next, ensoId);
      return next;
    });
  };

  const forge = async () => {
    setMining(true);
    cancel.current = false;
    setProgress(0);
    setForged(0);
    const collected: HaikuWalletItem[] = [];
    for (let i = 0; i < count; i++) {
      if (cancel.current) break;
      // chunked mining so the forging animation can render
      const w = await mineAsync({
        ensoId,
        requireGrammar,
        grammarThreshold,
        maxAttempts: 60000,
      });
      if (w) {
        collected.push(w);
        setForged(collected.length);
        persist([...items, ...collected]);
      }
      setProgress(((i + 1) / count) * 100);
    }
    setMining(false);
  };

  // Mine with cooperative yielding to keep the UI animated
  const mineAsync = (opts: Parameters<typeof mineOne>[0]) =>
    new Promise<HaikuWalletItem | null>((resolve) => {
      let tries = 0;
      const batch = 1500;
      const step = () => {
        if (cancel.current) return resolve(null);
        const w = mineOne({ ...opts, maxAttempts: batch });
        tries += batch;
        if (w || tries >= opts.maxAttempts) return resolve(w);
        setProgress((p) => (p < 99 ? p + 0.4 : p));
        requestAnimationFrame(step);
      };
      step();
    });

  const remove = (id: string) => persist(items.filter((w) => w.id !== id));
  const clearAll = () => {
    if (confirm("Delete all saved haiku wallets?")) persist([]);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Forge panel */}
        <Collapsible
          storageKey="bhw.wallet.forge"
          title="Forge Haiku Wallet"
          icon="⚒"
          className="h-fit"
        >
          <div className="space-y-4">
          <p className="text-xs text-zinc-500">
            Mnemonics are real BIP-39 (128-bit, valid checksum). We mine seeds whose
            words naturally read as a 5-7-5 haiku, derive a BIP-44 Bitcoin address
            (m/44'/0'/0'/0/0), and mint it as a collectible bound to your Ensō ID.
          </p>

          <label className="flex items-center justify-between text-sm">
            <span>Mine at once</span>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, +e.target.value)))}
              className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireGrammar}
              onChange={(e) => setRequireGrammar(e.target.checked)}
              className="accent-cyan-400"
            />
            Spell/grammar gate (skip awkward haiku)
          </label>
          {requireGrammar && (
            <label className="block text-xs text-zinc-400">
              Min readability score: {grammarThreshold}
              <input
                type="range"
                min={40}
                max={95}
                value={grammarThreshold}
                onChange={(e) => setGrammarThreshold(+e.target.value)}
                className="w-full accent-cyan-400"
              />
            </label>
          )}

          {!mining ? (
            <button
              onClick={forge}
              className="w-full rounded-lg bg-cyan-500 py-2.5 font-semibold text-zinc-950 hover:bg-cyan-400"
            >
              Forge {count > 1 ? `${count} wallets` : "wallet"}
            </button>
          ) : (
            <button
              onClick={() => (cancel.current = true)}
              className="w-full rounded-lg bg-rose-600 py-2.5 font-semibold hover:bg-rose-500"
            >
              Stop
            </button>
          )}

          {/* Forging animation */}
          {mining && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-cyan-900/40 bg-cyan-950/20 p-4">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-400" />
                <div className="absolute inset-0 flex items-center justify-center text-3xl">
                  ⭕
                </div>
              </div>
              <div className="text-sm text-cyan-300">
                Forging ensō &amp; haiku… {forged}/{count}
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
                <div
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => exportEncryptedTxt(items, ensoId)}
              disabled={!items.length}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-40"
            >
              ⬇ Export AES-256 .txt
            </button>
            <button
              onClick={() => exportPlainTxt(items)}
              disabled={!items.length}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-40"
            >
              ⬇ Export plain .txt
            </button>
            <button
              onClick={clearAll}
              disabled={!items.length}
              className="rounded-lg border border-rose-900 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-40"
            >
              🗑 Clear vault
            </button>
          </div>
          <p className="text-[11px] text-zinc-600">
            Vault is AES-256 encrypted with your Ensō ID and saved to an encrypted
            cookie + localStorage for offline persistence.
          </p>
          </div>
        </Collapsible>

        {/* Collection */}
        <Collapsible
          storageKey="bhw.wallet.collection"
          title={`Collection (${items.length})`}
          icon="📦"
          className="h-fit"
          right={
            <PipeInButton
              accepts={["mnemonic", "text"]}
              onReceive={(content) => addMnemonic(content)}
            />
          }
        >
          <div className="space-y-3">
          {imported && (
            <p className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300">
              {imported}
            </p>
          )}
          {items.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-600">
              No wallets yet. Forge your first haiku wallet.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((w) => {
              const valid = validateMnemonic(w.mnemonic);
              return (
                <div
                  key={w.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex gap-3">
                    <EnsoThumb ensoId={w.ensoId} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-cyan-400">{w.id}</span>
                        <button
                          onClick={() => remove(w.id)}
                          className="text-xs text-rose-400 hover:text-rose-300"
                        >
                          delete
                        </button>
                      </div>
                      <div className="mt-1 space-y-0.5 font-serif text-sm italic text-zinc-200">
                        {w.lines.map((l, i) => (
                          <div key={i}>
                            {l}{" "}
                            <span className="not-italic text-[10px] text-zinc-600">
                              ({w.counts[i]})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 border-t border-zinc-800 pt-2 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <span className="text-zinc-500">BTC {w.path}</span>
                      <span className="truncate font-mono text-zinc-300">{w.address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Checksum</span>
                      <span className={valid ? "text-emerald-400" : "text-rose-400"}>
                        {valid ? "✓ valid BIP-39" : "✗ invalid"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Readability</span>
                      <span className="text-zinc-300">{w.grammarScore}/100</span>
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-zinc-500">
                        reveal mnemonic
                      </summary>
                      <code className="mt-1 block break-all rounded bg-zinc-950 p-2 text-cyan-200">
                        {w.mnemonic}
                      </code>
                    </details>
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      <PipeOutButton
                        compact
                        draft={{
                          content: w.mnemonic,
                          contentType: "mnemonic",
                          sourceId: "wallet",
                          sourceName: "Haiku Wallet",
                          label: `${w.id} mnemonic`,
                        }}
                      />
                      <PipeOutButton
                        compact
                        draft={{
                          content: w.lines.filter(Boolean).join("\n"),
                          contentType: "haiku",
                          sourceId: "wallet",
                          sourceName: "Haiku Wallet",
                          label: `${w.id} haiku`,
                        }}
                      />
                      <PipeOutButton
                        compact
                        draft={{
                          content: w.address,
                          contentType: "address",
                          sourceId: "wallet",
                          sourceName: "Haiku Wallet",
                          label: `${w.id} address`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
