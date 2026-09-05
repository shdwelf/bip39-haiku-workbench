import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { wallet } from "bananocurrency-web";
import {
  ACCESSORIES,
  oneInN,
  probability,
  rarityTier,
  type AccessoryDef,
  type Category,
} from "../lib/monkey/accessories";
import { accessoriesFor } from "../lib/monkey/generate";
import MonkeyAvatar, { type ArtMode } from "./MonkeyAvatar";
import { PipeOutButton } from "../pipe/PipeButtons";
import Collapsible from "../shell/Collapsible";
import { usePersistentState } from "../shell/hooks";

const TOOL_ID = "monkey";
const TOOL_NAME = "MonKey Miner";

const CATEGORY_LABEL: Record<Category, string> = {
  misc: "Misc",
  hat: "Hats",
  glasses: "Glasses",
  mouth: "Mouth",
  shirt_and_pants: "Shirt & Pants",
  shoes: "Shoes",
  tail: "Tail",
};

interface Found {
  id: string;
  seed: string;
  index: number;
  address: string;
  privateKey: string;
  matched: AccessoryDef[];
  all: AccessoryDef[];
  rarest: number;
}

/** Rarity of the least likely accessory in a set. */
function rarestOf(list: AccessoryDef[]): number {
  return list.length ? Math.min(...list.map(probability)) : 1;
}

export default function MonkeyMiner() {
  const [targets, setTargets] = useState<Set<string>>(new Set(["flamethrower"]));
  const [mode, setMode] = useState<"any" | "all">("any");
  const [running, setRunning] = useState(false);
  const [checked, setChecked] = useState(0);
  const [found, setFound] = useState<Found[]>([]);
  const [selected, setSelected] = useState<Found | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [artMode, setArtMode] = usePersistentState<ArtMode>(
    "bhw.monkey.artMode",
    "offline"
  );

  const runRef = useRef(false);
  const startRef = useRef(0);

  const sorted = useMemo(
    () => [...ACCESSORIES].sort((a, b) => probability(a) - probability(b)),
    []
  );

  const grouped = useMemo(() => {
    const g = new Map<Category, AccessoryDef[]>();
    for (const a of sorted) {
      if (!g.has(a.category)) g.set(a.category, []);
      g.get(a.category)!.push(a);
    }
    return g;
  }, [sorted]);

  // Combined chance that one random address satisfies the current filter.
  const hitChance = useMemo(() => {
    const chosen = ACCESSORIES.filter((a) => targets.has(a.id));
    if (chosen.length === 0) return 0;
    if (mode === "all") return chosen.reduce((p, a) => p * probability(a), 1);
    return 1 - chosen.reduce((p, a) => p * (1 - probability(a)), 1);
  }, [targets, mode]);

  const toggle = (id: string) =>
    setTargets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const mine = useCallback(() => {
    // One synchronous slice per animation frame keeps the UI responsive.
    const SLICE = 400;
    let localChecked = 0;
    const hits: Found[] = [];

    for (let i = 0; i < SLICE; i++) {
      const w = wallet.generateLegacy();
      const acct = wallet.legacyAccounts(w.seed, 0, 0)[0];
      const all = accessoriesFor(acct.address);
      localChecked++;

      const matched = all.filter((a) => targets.has(a.id));
      const ok =
        targets.size > 0 &&
        (mode === "any" ? matched.length > 0 : matched.length === targets.size);

      if (ok) {
        hits.push({
          id: `${w.seed}-${acct.accountIndex}`,
          seed: w.seed,
          index: acct.accountIndex,
          address: acct.address,
          privateKey: acct.privateKey,
          matched,
          all,
          rarest: rarestOf(matched),
        });
      }
    }

    setChecked((c) => c + localChecked);
    if (hits.length) setFound((f) => [...hits, ...f].slice(0, 60));
    setElapsed(Date.now() - startRef.current);
  }, [targets, mode]);

  useEffect(() => {
    if (!running) return;
    runRef.current = true;
    let raf = 0;
    const loop = () => {
      if (!runRef.current) return;
      mine();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      runRef.current = false;
      cancelAnimationFrame(raf);
    };
  }, [running, mine]);

  const start = () => {
    if (targets.size === 0) return;
    startRef.current = Date.now() - elapsed;
    setRunning(true);
  };
  const stop = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setChecked(0);
    setFound([]);
    setElapsed(0);
  };

  const rate = elapsed > 0 ? Math.round(checked / (elapsed / 1000)) : 0;
  const expected = hitChance > 0 ? Math.round(1 / hitChance) : Infinity;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">🐒 {TOOL_NAME}</h2>
            <p className="text-[11px] text-zinc-500">
              Generates real Banano wallets and keeps the ones whose monKey wears
              the accessories you want. Runs fully offline.
            </p>
          </div>
          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={start}
                disabled={targets.size === 0}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40"
              >
                ▶ Start mining
              </button>
            ) : (
              <button
                onClick={stop}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-500"
              >
                ■ Stop
              </button>
            )}
            <button
              onClick={reset}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"
            >
              Reset
            </button>
            <button
              onClick={() =>
                setArtMode((m) => (m === "offline" ? "official" : "offline"))
              }
              title={
                artMode === "official"
                  ? "Fetching artwork from monkey.banano.cc"
                  : "Drawing artwork locally — no network"
              }
              className={`rounded-lg border px-3 py-2 text-xs transition ${
                artMode === "official"
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {artMode === "official" ? "🖼 Official art" : "✏️ Offline art"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Checked" value={checked.toLocaleString()} />
          <Stat label="Found" value={String(found.length)} tone="good" />
          <Stat label="Rate" value={`${rate.toLocaleString()}/s`} />
          <Stat
            label="Expected 1 in"
            value={expected === Infinity ? "—" : expected.toLocaleString()}
          />
        </div>
      </section>

      <Collapsible
        storageKey="bhw.monkey.targets"
        title={`Target accessories (${targets.size})`}
        icon="🎯"
        subtitle={mode === "any" ? "match any" : "match all"}
      >
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-zinc-400">
              <input
                type="radio"
                checked={mode === "any"}
                onChange={() => setMode("any")}
              />
              match any
            </label>
            <label className="flex items-center gap-1 text-[11px] text-zinc-400">
              <input
                type="radio"
                checked={mode === "all"}
                onChange={() => setMode("all")}
              />
              match all
            </label>
            <button
              onClick={() => setTargets(new Set())}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 transition hover:bg-zinc-800"
            >
              clear
            </button>
          </div>
        </div>

        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {[...grouped.entries()].map(([cat, list]) => (
            <div key={cat}>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">
                {CATEGORY_LABEL[cat]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((a) => {
                  const on = targets.has(a.id);
                  const tier = rarityTier(probability(a));
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggle(a.id)}
                      title={`${a.name} — 1 in ${oneInN(a).toLocaleString()} (${tier.label})`}
                      className={`rounded-full border px-2 py-1 text-[11px] transition ${
                        on
                          ? "border-amber-400 bg-amber-400/20 text-amber-200"
                          : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      <span className="mr-1">{a.emoji}</span>
                      {a.name}
                      <span
                        className="ml-1 font-mono text-[9px]"
                        style={{ color: tier.color }}
                      >
                        1:{oneInN(a).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible
        storageKey="bhw.monkey.found"
        title={`Found MonKeys (${found.length})`}
        icon="🐒"
      >
        {found.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-600">
            Nothing yet. Pick targets and start mining.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {found.map((m) => (
              <MonkeyCard
                key={m.id}
                m={m}
                artMode={artMode}
                onOpen={() => setSelected(m)}
              />
            ))}
          </div>
        )}
      </Collapsible>

      {selected && (
        <Detail m={selected} artMode={artMode} onClose={() => setSelected(null)} />
      )}

      <p className="text-[11px] text-zinc-600">
        Accessory odds use the real appditto weights and category chances, so
        rarity matches the live service exactly. <strong>Offline art</strong> is
        drawn locally and is not the official MonKey art — those assets are
        proprietary and cannot be bundled. <strong>Official art</strong> fetches
        from monkey.banano.cc and needs a network connection. Keys are generated
        in your browser — treat them as toys.
      </p>
    </div>
  );
}

function MonkeyCard({
  m,
  artMode,
  onOpen,
}: {
  m: Found;
  artMode: ArtMode;
  onOpen: () => void;
}) {
  const tier = rarityTier(m.rarest);
  return (
    <button
      onClick={onOpen}
      className="rounded-xl border bg-zinc-900/60 p-3 text-left transition hover:-translate-y-0.5"
      style={{ borderColor: tier.color + "66" }}
    >
      <div className="flex gap-3">
        <MonkeyAvatar address={m.address} size={88} mode={artMode} />
        <div className="min-w-0 flex-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-black"
            style={{ background: tier.color + "22", color: tier.color }}
          >
            {tier.label} · 1 in {Math.round(1 / m.rarest).toLocaleString()}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {m.matched.map((a) => (
              <span
                key={a.id}
                className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-200"
              >
                {a.emoji} {a.name}
              </span>
            ))}
          </div>
          <p className="mt-1.5 truncate font-mono text-[9px] text-zinc-500">
            {m.address}
          </p>
        </div>
      </div>
    </button>
  );
}

function Detail({
  m,
  artMode,
  onClose,
}: {
  m: Found;
  artMode: ArtMode;
  onClose: () => void;
}) {
  const tier = rarityTier(m.rarest);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-bold text-zinc-100">MonKey detail</h3>
          <button
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
        <div className="mt-3 flex gap-4">
          <MonkeyAvatar address={m.address} size={150} mode={artMode} />
          <div className="min-w-0 flex-1 space-y-2">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-black"
              style={{ background: tier.color + "22", color: tier.color }}
            >
              {tier.label} · 1 in {Math.round(1 / m.rarest).toLocaleString()}
            </span>
            <div>
              <p className="text-[10px] uppercase text-zinc-500">All accessories</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.all.length === 0 && (
                  <span className="text-[11px] text-zinc-600">plain monKey</span>
                )}
                {m.all.map((a) => (
                  <span
                    key={a.id}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-200"
                  >
                    {a.emoji} {a.name} · 1:{oneInN(a).toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Field label="Address" value={m.address} type="address" />
          <Field label="Seed" value={m.seed} type="text" secret />
          <Field label="Private key" value={m.privateKey} type="text" secret />
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  type,
  secret,
}: {
  label: string;
  value: string;
  type: "address" | "text";
  secret?: boolean;
}) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="rounded bg-zinc-900 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          {label}
          {secret && <span className="ml-1 text-rose-400">· secret</span>}
        </span>
        <div className="flex gap-1.5">
          {secret && (
            <button
              onClick={() => setShow((v) => !v)}
              className="rounded border border-zinc-700 px-1.5 text-[9px] text-zinc-400 hover:bg-zinc-800"
            >
              {show ? "hide" : "reveal"}
            </button>
          )}
          <PipeOutButton
            compact
            draft={{
              content: value,
              contentType: type,
              sourceId: TOOL_ID,
              sourceName: TOOL_NAME,
              label: `MonKey ${label.toLowerCase()}`,
            }}
          />
        </div>
      </div>
      <p className="break-all font-mono text-[11px] text-cyan-300">
        {show ? value : "•".repeat(Math.min(value.length, 48))}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good";
}) {
  return (
    <div className="rounded-lg bg-zinc-950 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={`font-mono text-lg ${tone === "good" ? "text-emerald-400" : "text-zinc-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
