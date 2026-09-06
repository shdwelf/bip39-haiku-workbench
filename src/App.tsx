import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, EnsoSettings, encodeEnsoId } from "./lib/enso";
import EnsoForge from "./components/EnsoForge";
import HaikuWallet from "./components/HaikuWallet";
import MnemonicInspector from "./components/MnemonicInspector";
import RecoveryLab from "./components/RecoveryLab";
import ArtGallery from "./components/ArtGallery";
import MonkeyMiner from "./components/MonkeyMiner";
import Book from "./components/Book";
import Cookbook from "./components/Cookbook";
import Terminal from "./components/Terminal";
import WavesExchange from "./components/WavesExchange";
import MarketData from "./components/MarketData";
import { PipeProvider, usePipe } from "./pipe/PipeProvider";
import PipeInboxPanel from "./pipe/PipeInboxPanel";
import AppShell, { type NavItem } from "./shell/AppShell";
import {
  ARCHIVED_CODEBASES,
  CodebaseSwitcher,
  EmbeddedCodebase,
  findArchivedCodebase,
  type CodebaseId,
} from "./components/CodebaseWorkbench";

const NAV: NavItem[] = [
  { id: "enso", label: "Ensō Forge", icon: "⭕" },
  { id: "wallet", label: "Haiku Wallet", icon: "🪙" },
  { id: "inspector", label: "Inspector", icon: "🔍" },
  { id: "recovery", label: "Recovery Lab", icon: "🧩" },
  { id: "gallery", label: "Art Gallery", icon: "🖼" },
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
      {activeTab === "recovery" && <RecoveryLab />}
      {activeTab === "gallery" && <ArtGallery />}
      {activeTab === "monkey" && <MonkeyMiner />}
      {activeTab === "book" && <Book />}
      {activeTab === "cookbook" && <Cookbook />}
      {activeTab === "terminal" && <Terminal />}
      {activeTab === "waves" && <WavesExchange />}
      {activeTab === "market" && <MarketData />}
    </AppShell>
  );
}

const CODEBASE_HASH_PREFIX = "codebase=";

function codebaseFromHash(): CodebaseId {
  if (typeof window === "undefined") return "gen2";
  let value: string;
  try {
    value = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "gen2";
  }
  if (!value.startsWith(CODEBASE_HASH_PREFIX)) return "gen2";
  const id = value.slice(CODEBASE_HASH_PREFIX.length) as CodebaseId;
  return id === "suite" || ARCHIVED_CODEBASES.some((codebase) => codebase.id === id) ? id : "gen2";
}

/**
 * The 23 August Gen2 upload is the main canvas. The maintained TypeScript suite
 * and every other distinct uploaded application remain one click away instead
 * of being substituted with look-alike components.
 */
export default function App() {
  const [codebaseId, setCodebaseId] = useState<CodebaseId>(codebaseFromHash);

  useEffect(() => {
    const onHashChange = () => setCodebaseId(codebaseFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const selectCodebase = (id: CodebaseId) => {
    setCodebaseId(id);
    const nextHash = `${CODEBASE_HASH_PREFIX}${encodeURIComponent(id)}`;
    if (window.location.hash.slice(1) !== nextHash) window.location.hash = nextHash;
  };

  const archived = findArchivedCodebase(codebaseId);

  return (
    <>
      {archived ? (
        <EmbeddedCodebase codebase={archived} />
      ) : (
        <PipeProvider initialTab="enso">
          <Workbench />
        </PipeProvider>
      )}
      <CodebaseSwitcher activeId={codebaseId} onSelect={selectCodebase} />
    </>
  );
}
