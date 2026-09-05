import { useEffect, useRef, useState } from "react";
import {
  EnsoSettings,
  drawEnso,
  encodeEnsoId,
  decodeEnsoId,
  randomSettings,
  settingsSummary,
  prettyId,
  HUE_NAMES,
  STRETCH_NAMES,
  STROKE_SIZE_NAMES,
} from "../lib/enso";

interface Props {
  settings: EnsoSettings;
  setSettings: (s: EnsoSettings) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export default function EnsoForge({ settings, setSettings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [idInput, setIdInput] = useState("");
  const ensoId = encodeEnsoId(settings);

  useEffect(() => {
    if (canvasRef.current) drawEnso(canvasRef.current, settings);
  }, [settings]);

  const up = (patch: Partial<EnsoSettings>) => setSettings({ ...settings, ...patch });

  const downloadPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.download = `enso-${ensoId}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };

  const loadId = () => {
    const s = decodeEnsoId(idInput);
    if (s) setSettings(s);
    else alert("Invalid Ensō ID");
  };

  const num = (
    key: keyof EnsoSettings,
    min: number,
    max: number,
    step = 1
  ) => (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={settings[key] as number}
      onChange={(e) => up({ [key]: Number(e.target.value) } as any)}
      className="accent-cyan-400"
    />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      {/* Canvas + ID */}
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <canvas
            ref={canvasRef}
            width={560}
            height={560}
            className="aspect-square w-full rounded-lg"
          />
        </div>

        <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-4">
          <div className="text-xs uppercase tracking-wider text-cyan-400">
            Ensōgen ID · terrain seed · master vault key
          </div>
          <div className="mt-1 break-all font-mono text-lg text-cyan-200">
            {prettyId(ensoId)}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            This deterministic ID encodes every setting below (like a Worms terrain
            seed). It is also the master password for your Haiku Wallet vault.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => up(randomSettings())}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-400"
          >
            🎲 Random Seed
          </button>
          <button
            onClick={() => up({ seed: Math.floor(Math.random() * 65536) })}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
          >
            ↻ Reroll Terrain
          </button>
          <button
            onClick={downloadPng}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
          >
            ⬇ Download PNG
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="Paste Ensō ID to load…"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
          />
          <button
            onClick={loadId}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
          >
            Load
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-5">
        <h2 className="text-lg font-semibold text-zinc-100">Manual Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Ink Load · ${settings.inkLoad}`}>{num("inkLoad", 1, 8)}</Field>
          <Field label="Direction">
            <select
              value={settings.direction}
              onChange={(e) => up({ direction: Number(e.target.value) })}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value={0}>Clockwise</option>
              <option value={1}>Counter-Clockwise</option>
            </select>
          </Field>
          <Field label="Paper Hue">
            <select
              value={settings.paperHue}
              onChange={(e) => up({ paperHue: Number(e.target.value) })}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              {HUE_NAMES.map((h) => (
                <option key={h.name} value={h.hue}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Brush Size · ${settings.brushSize}`}>{num("brushSize", 1, 12)}</Field>
          <Field label={`Ink Density · ${settings.inkDensity}`}>{num("inkDensity", 1, 9)}</Field>
          <Field label={`X/Y Stretch · ${STRETCH_NAMES[settings.stretch]}`}>
            {num("stretch", 0, 4)}
          </Field>
          <Field label={`Paper Texture · ${settings.paperTexture}`}>
            {num("paperTexture", 0, 9)}
          </Field>
          <Field label={`Bristle Density · ${settings.bristleDensity}`}>
            {num("bristleDensity", 1, 9)}
          </Field>
          <Field label="Signature Style">
            <select
              value={settings.signatureStyle}
              onChange={(e) => up({ signatureStyle: Number(e.target.value) })}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value={0}>Dark</option>
              <option value={1}>Light</option>
            </select>
          </Field>
          <Field label="Brushstroke Size">
            <select
              value={settings.brushstrokeSize}
              onChange={(e) => up({ brushstrokeSize: Number(e.target.value) })}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              {STROKE_SIZE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Brushstroke Start · ${settings.startRotation}°`}>
            {num("startRotation", 0, 359)}
          </Field>
          <Field label={`Terrain Seed · ${settings.seed}`}>{num("seed", 0, 65535)}</Field>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">Encoded variables</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {settingsSummary(settings).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-zinc-800/60 py-0.5">
                <span className="text-zinc-500">{k}</span>
                <span className="text-zinc-200">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
