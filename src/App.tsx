import { useState } from "react";
import { DEFAULT_SETTINGS, EnsoSettings, encodeEnsoId } from "./lib/enso";
import EnsoForge from "./components/EnsoForge";
import HaikuWallet from "./components/HaikuWallet";
import MnemonicInspector from "./components/MnemonicInspector";
import MonkeyMiner from "./components/MonkeyMiner";
import Book from "./components/Book";
import Cookbook from "./components/Cookbook";
import Terminal from "./components/Terminal";
import WavesExchange from "./components/WavesExchange";
import MarketData from "./components/MarketData";
import { PipeProvider, usePipe } from "./pipe/PipeProvider";
import PipeInboxPanel from "./pipe/PipeInboxPanel";
import AppShell, { type NavItem } from "./shell/AppShell";

const NAV: NavItem[] = [
  { id: "enso", label: "Ensō Forge", icon: "⭕" },
  { id: "wallet", label: "Haiku Wallet", icon: "🪙" },
  { id: "inspector", label: "Inspector", icon: "🔍" },
  { id: "monkey", label: "MonKey Miner", icon: "🐒" },
  { id: "book", label: "Autobiography", icon: "📖" },
  { id: "cookbook", label: "Crypto Cookbook", icon: "📚" },
  { id: "terminal", label: "Terminal / IRC", icon: "▌" },
  { id: "waves", label: "wAves Exchange", icon: "🌊" },
  { id: "market", label: "Market Data", icon: "📈" },
];

function Workbench() {
  // Tab state lives in the pipe context so `sendToTool` can focus a target.
  const { activeTab, setActiveTab, pipes } = usePipe();
  const [settings, setSettings] = useState<EnsoSettings>(DEFAULT_SETTINGS);
  const ensoId = encodeEnsoId(settings);

  return (
    <AppShell
      nav={NAV}
      activeId={activeTab}
      onNavigate={setActiveTab}
      title="BIP-39 Haiku Workbench"
      subtitle="offline standalone · BIP-39/44 · 5-7-5 seed mining · piped inbox"
      inboxTitle="Pipe Inbox"
      inboxBadge={pipes.length}
      inbox={<PipeInboxPanel />}
      footer={
        <>
          Vault key (Ensō ID):{" "}
          <span className="font-mono text-cyan-500">{ensoId}</span>
          {"  ·  "}
          For entertainment/education. Do not store real funds in
          browser-generated seeds.
        </>
      }
    >
      {activeTab === "enso" && (
        <EnsoForge settings={settings} setSettings={setSettings} />
      )}
      {activeTab === "wallet" && <HaikuWallet ensoId={ensoId} />}
      {activeTab === "inspector" && <MnemonicInspector />}
      {activeTab === "monkey" && <MonkeyMiner />}
      {activeTab === "book" && <Book />}
      {activeTab === "cookbook" && <Cookbook />}
      {activeTab === "terminal" && <Terminal />}
      {activeTab === "waves" && <WavesExchange />}
      {activeTab === "market" && <MarketData />}
    </AppShell>
  );
}

export default function App() {
  return (
    <PipeProvider initialTab="enso">
      <Workbench />
    </PipeProvider>
  );
}
