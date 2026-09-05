import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MAX_PIPES, type Delivery, type Pipe, type PipeDraft } from "./types";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
// Pipes are intentionally persisted: the inbox is a parking area, and losing it
// on refresh (the old behaviour) made "pipe to app" useless across reloads.
// Deliveries are persisted too so a payload sent at a tool that has not been
// opened yet still arrives after a reload.

const PIPES_KEY = "bhw.pipes.v1";
const QUEUE_KEY = "bhw.pipeQueue.v1";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    // Corrupt or unavailable storage must never take the app down.
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded / private mode: degrade to in-memory only.
  }
}

/**
 * Collision-resistant id.
 *
 * The previous implementation used `Math.random().toString(36).substring(2,10)`
 * which collides often enough to matter once the inbox holds a handful of rows
 * keyed by id (React key warnings, and removePipe deleting the wrong entry).
 */
function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface PipeContextValue {
  pipes: Pipe[];
  /** Park data in the inbox. Returns the stored pipe. */
  pushPipe: (draft: PipeDraft) => Pipe;
  /** Read a pipe's content without removing it. `null` only when absent. */
  peekPipe: (id: string) => string | null;
  removePipe: (id: string) => void;
  clearPipes: () => void;

  /** Send data straight at a tool (and focus it). Also parks a copy. */
  sendToTool: (toolId: string, draft: PipeDraft) => void;
  /** Deliveries still awaiting pickup, oldest first. */
  queue: Delivery[];
  /** Mark a delivery as handled. Idempotent. */
  ackDelivery: (id: string) => void;

  activeTab: string;
  setActiveTab: (id: string) => void;
}

const PipeContext = createContext<PipeContextValue | null>(null);

export function PipeProvider({
  children,
  initialTab,
}: {
  children: ReactNode;
  initialTab: string;
}) {
  const [pipes, setPipes] = useState<Pipe[]>(() => readJSON<Pipe[]>(PIPES_KEY, []));
  const [queue, setQueue] = useState<Delivery[]>(() =>
    readJSON<Delivery[]>(QUEUE_KEY, [])
  );
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => writeJSON(PIPES_KEY, pipes), [pipes]);
  useEffect(() => writeJSON(QUEUE_KEY, queue), [queue]);

  const pushPipe = useCallback((draft: PipeDraft): Pipe => {
    const pipe: Pipe = { ...draft, id: newId(), createdAt: Date.now() };
    // Newest first, evict oldest beyond the cap.
    setPipes((prev) => [pipe, ...prev].slice(0, MAX_PIPES));
    return pipe;
  }, []);

  const peekPipe = useCallback(
    (id: string) => {
      const hit = pipes.find((p) => p.id === id);
      // `??` not `||`: an empty string is legitimate content, not a miss.
      return hit?.content ?? null;
    },
    [pipes]
  );

  const removePipe = useCallback((id: string) => {
    setPipes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearPipes = useCallback(() => setPipes([]), []);

  const sendToTool = useCallback(
    (toolId: string, draft: PipeDraft) => {
      const delivery: Delivery = {
        id: newId(),
        toolId,
        content: draft.content,
        contentType: draft.contentType,
        sourceName: draft.sourceName,
        createdAt: Date.now(),
      };
      // Queue, never overwrite: two sends in a row must both arrive.
      setQueue((prev) => [...prev, delivery]);
      // Keep a copy in the inbox so the payload is recoverable if the user
      // navigates away before the target tool picks it up.
      pushPipe(draft);
      setActiveTab(toolId);
    },
    [pushPipe]
  );

  const ackDelivery = useCallback((id: string) => {
    setQueue((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const value = useMemo<PipeContextValue>(
    () => ({
      pipes,
      pushPipe,
      peekPipe,
      removePipe,
      clearPipes,
      sendToTool,
      queue,
      ackDelivery,
      activeTab,
      setActiveTab,
    }),
    [
      pipes,
      pushPipe,
      peekPipe,
      removePipe,
      clearPipes,
      sendToTool,
      queue,
      ackDelivery,
      activeTab,
    ]
  );

  return <PipeContext.Provider value={value}>{children}</PipeContext.Provider>;
}

export function usePipe(): PipeContextValue {
  const ctx = useContext(PipeContext);
  if (!ctx) throw new Error("usePipe must be used within a PipeProvider");
  return ctx;
}

/**
 * Subscribe a tool to its deliveries.
 *
 * Safe under React StrictMode double-invocation: each delivery id is recorded
 * in a ref the moment it is handled, so a repeated effect run cannot apply the
 * same payload twice. The handler is held in a ref so callers may pass an
 * inline arrow without causing the effect to resubscribe every render.
 */
export function usePipeReceiver(
  toolId: string,
  onReceive: (delivery: Delivery) => void
) {
  const { queue, ackDelivery } = usePipe();
  const handler = useRef(onReceive);
  handler.current = onReceive;
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const delivery of queue) {
      if (delivery.toolId !== toolId) continue;
      if (seen.current.has(delivery.id)) continue;
      seen.current.add(delivery.id);
      handler.current(delivery);
      ackDelivery(delivery.id);
    }
  }, [queue, toolId, ackDelivery]);
}
