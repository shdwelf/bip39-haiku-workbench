import { useState } from "react";
import { DEFAULT_SETTINGS, EnsoSettings, encodeEnsoId } from "./lib/enso";
import EnsoForge from "./components/EnsoForge";
import HaikuWallet from "./components/HaikuWallet";
import MnemonicInspector from "./components/MnemonicInspector";
import Terminal from "./components/Terminal";
import WavesExchange from "./components/WavesExchange";
import MarketData from "./components/MarketData";
import { PipeProvider, usePipe } from "./pipe/PipeProvider";
import PipeInbox from "./pipe/PipeInbox";

const TABS = [
  { id: "enso", label: "Ensō Forge", icon: "⭕" },
  { id: "wallet", label: "Haiku Wallet", icon: "🪙" },
  { id: "inspector", label: "Inspector", icon: "🔍" },
  { id: "terminal", label: "Terminal / IRC", icon: "▌" },
  { id: "waves", label: "wAves Exchange", icon: "🌊" },
  { id: "market", label: "Market Data", icon: "📈" },
] as const;

function Workbench() {
  // Tab state lives in the pipe context so `sendToTool` can focus a target.
  const { activeTab, setActiveTab } = usePipe();
  const [settings, setSettings] = useState<EnsoSettings>(DEFAULT_SETTINGS);
  const ensoId = encodeEnsoId(settings);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⭕</span>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                BIP-39 Haiku Workbench
              </h1>
              <p className="text-[11px] text-zinc-500">
                offline standalone · BIP-39/44 · 5-7-5 seed mining · piped inbox
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  activeTab === t.id
                    ? "bg-cyan-500 font-semibold text-zinc-950"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-24">
        {activeTab === "enso" && (
          <EnsoForge settings={settings} setSettings={setSettings} />
        )}
        {activeTab === "wallet" && <HaikuWallet ensoId={ensoId} />}
        {activeTab === "inspector" && <MnemonicInspector />}
        {activeTab === "terminal" && <Terminal />}
        {activeTab === "waves" && <WavesExchange />}
        {activeTab === "market" && <MarketData />}
      </main>

      <PipeInbox />

      <footer className="border-t border-zinc-800 px-4 py-4 text-center text-[11px] text-zinc-600">
        Vault key (Ensō ID): <span className="font-mono text-cyan-500">{ensoId}</span>
        {"  ·  "}
        For entertainment/education. Do not store real funds in browser-generated
        seeds.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <PipeProvider initialTab="enso">
      <Workbench />
    </PipeProvider>
  );
}
