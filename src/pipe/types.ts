// ---- Piped inbox: shared data model ----------------------------------------
// A "pipe" is a piece of data one tool parks in the inbox so another tool can
// pick it up later. A "delivery" is a pipe actively pushed at a specific tool.

export type PipeContentType =
  | "mnemonic"
  | "haiku"
  | "address"
  | "xpub"
  | "json"
  | "text";

export interface Pipe {
  /** Stable unique id. Never regenerated. */
  id: string;
  content: string;
  contentType: PipeContentType;
  /** Tool id that produced this pipe. */
  sourceId: string;
  /** Human label for the producing tool. */
  sourceName: string;
  /** Short description shown in the inbox row. */
  label: string;
  createdAt: number;
}

/** A pipe addressed at one specific tool, awaiting pickup. */
export interface Delivery {
  id: string;
  toolId: string;
  content: string;
  contentType: PipeContentType;
  sourceName: string;
  createdAt: number;
}

/** Payload accepted by pushPipe / sendToTool. */
export interface PipeDraft {
  content: string;
  contentType: PipeContentType;
  sourceId: string;
  sourceName: string;
  label: string;
}

export const CONTENT_TYPE_META: Record<
  PipeContentType,
  { icon: string; tint: string; name: string }
> = {
  mnemonic: { icon: "🔑", tint: "text-amber-300", name: "Mnemonic" },
  haiku: { icon: "🍃", tint: "text-emerald-300", name: "Haiku" },
  address: { icon: "🪙", tint: "text-cyan-300", name: "Address" },
  xpub: { icon: "🌳", tint: "text-violet-300", name: "xpub" },
  json: { icon: "{}", tint: "text-sky-300", name: "JSON" },
  text: { icon: "¶", tint: "text-zinc-300", name: "Text" },
};

/** Hard cap on stored pipes. Oldest entries are evicted first. */
export const MAX_PIPES = 20;
