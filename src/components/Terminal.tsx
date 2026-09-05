import { useEffect, useRef, useState } from "react";

interface Line {
  text: string;
  cls?: string;
}

// Lightweight offline PIM (Personal Information Manager) — the pim.jar logic
// ported to JS, with the command-line path enabled (GUI path disabled).
interface PimStore {
  notes: string[];
  todos: { text: string; done: boolean }[];
  contacts: { name: string; info: string }[];
}

const PIM_KEY = "pim_store_v1";
function loadPim(): PimStore {
  try {
    return JSON.parse(localStorage.getItem(PIM_KEY) || "") as PimStore;
  } catch {
    return { notes: [], todos: [], contacts: [] };
  }
}
function savePim(s: PimStore) {
  localStorage.setItem(PIM_KEY, JSON.stringify(s));
}

const BOTS = ["@ensobot", "kaeru", "matsuo", "nullptr", "wabi_sabi"];
const BOT_LINES = [
  "an old silent pond… a frog jumps into the pond — splash! silence again.",
  "anyone else mining 5-7-5 seeds tonight?",
  "remember: never paste a real mnemonic in chat.",
  "the ensō is never closed; the gap is the point.",
  "/me sips tea and watches the terrain regenerate",
  "wAves block height looking healthy.",
  "checksum valid? then it's a wallet. ship it.",
];

export default function Terminal() {
  const [lines, setLines] = useState<Line[]>([
    { text: "PIM // Personal Information Manager — CLI build (GUI disabled)", cls: "text-cyan-400" },
    { text: "Type 'help' for commands. Type 'irc' to join #haiku.", cls: "text-zinc-500" },
  ]);
  const [input, setInput] = useState("");
  const [ircMode, setIrcMode] = useState(false);
  const [nick] = useState("you");
  const endRef = useRef<HTMLDivElement>(null);
  const pim = useRef<PimStore>(loadPim());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  // IRC ambient chatter
  useEffect(() => {
    if (!ircMode) return;
    const t = setInterval(() => {
      const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
      const msg = BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];
      push({ text: `<${bot}> ${msg}`, cls: "text-emerald-300" });
    }, 6000);
    return () => clearInterval(t);
  }, [ircMode]);

  const push = (l: Line) => setLines((p) => [...p, l]);
  const pushAll = (arr: Line[]) => setLines((p) => [...p, ...arr]);

  const run = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    push({ text: ircMode ? `<${nick}> ${cmd}` : `$ ${cmd}`, cls: "text-zinc-200" });

    if (ircMode) {
      if (cmd === "/quit" || cmd === "/part") {
        setIrcMode(false);
        push({ text: "* You left #haiku", cls: "text-zinc-500" });
        return;
      }
      if (cmd.startsWith("/nick ")) {
        push({ text: `* now known as ${cmd.slice(6)}`, cls: "text-zinc-500" });
        return;
      }
      // echo to channel + occasional bot reply
      setTimeout(() => {
        const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
        push({ text: `<${bot}> ${pickReply(cmd)}`, cls: "text-emerald-300" });
      }, 1200);
      return;
    }

    const [name, ...args] = cmd.split(" ");
    const arg = args.join(" ");
    const s = pim.current;
    switch (name.toLowerCase()) {
      case "help":
        pushAll(
          [
            "Commands:",
            "  help                 show this help",
            "  irc                  join #haiku chat (type /quit to leave)",
            "  note add <text>      add a note",
            "  note ls              list notes",
            "  todo add <text>      add a todo",
            "  todo ls              list todos",
            "  todo done <n>        mark todo n complete",
            "  contact add <n>=<i> add contact",
            "  contact ls           list contacts",
            "  date                 show date/time",
            "  calc <expr>          evaluate math",
            "  clear                clear screen",
          ].map((t) => ({ text: t, cls: "text-zinc-400" }))
        );
        break;
      case "irc":
        setIrcMode(true);
        pushAll([
          { text: "* Connecting to irc.libera.local …", cls: "text-zinc-500" },
          { text: "* Joined #haiku — " + BOTS.join(", ") + " are here", cls: "text-cyan-400" },
          { text: "<matsuo> welcome. mind the syllables.", cls: "text-emerald-300" },
        ]);
        break;
      case "note":
        if (args[0] === "add") {
          s.notes.push(args.slice(1).join(" "));
          savePim(s);
          push({ text: "note saved.", cls: "text-emerald-400" });
        } else {
          pushAll(
            s.notes.length
              ? s.notes.map((n, i) => ({ text: `  ${i + 1}. ${n}` }))
              : [{ text: "no notes.", cls: "text-zinc-500" }]
          );
        }
        break;
      case "todo":
        if (args[0] === "add") {
          s.todos.push({ text: args.slice(1).join(" "), done: false });
          savePim(s);
          push({ text: "todo added.", cls: "text-emerald-400" });
        } else if (args[0] === "done") {
          const i = +args[1] - 1;
          if (s.todos[i]) {
            s.todos[i].done = true;
            savePim(s);
            push({ text: "done!", cls: "text-emerald-400" });
          }
        } else {
          pushAll(
            s.todos.length
              ? s.todos.map((t, i) => ({
                  text: `  ${i + 1}. [${t.done ? "x" : " "}] ${t.text}`,
                }))
              : [{ text: "no todos.", cls: "text-zinc-500" }]
          );
        }
        break;
      case "contact":
        if (args[0] === "add") {
          const [n, info] = arg.replace("add", "").trim().split("=");
          s.contacts.push({ name: (n || "").trim(), info: (info || "").trim() });
          savePim(s);
          push({ text: "contact saved.", cls: "text-emerald-400" });
        } else {
          pushAll(
            s.contacts.length
              ? s.contacts.map((c) => ({ text: `  ${c.name} — ${c.info}` }))
              : [{ text: "no contacts.", cls: "text-zinc-500" }]
          );
        }
        break;
      case "date":
        push({ text: new Date().toString(), cls: "text-zinc-300" });
        break;
      case "calc":
        try {
          // eslint-disable-next-line no-new-func
          const r = Function(`"use strict";return (${arg})`)();
          push({ text: `= ${r}`, cls: "text-cyan-300" });
        } catch {
          push({ text: "calc error", cls: "text-rose-400" });
        }
        break;
      case "clear":
        setLines([]);
        break;
      default:
        push({ text: `pim: command not found: ${name}`, cls: "text-rose-400" });
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      run(input);
      setInput("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span
          className={`h-2 w-2 rounded-full ${ircMode ? "bg-emerald-400" : "bg-zinc-600"}`}
        />
        {ircMode ? "IRC · #haiku" : "PIM shell"}
      </div>
      <div className="h-[60vh] overflow-y-auto rounded-xl border border-zinc-800 bg-black p-4 font-mono text-sm">
        {lines.map((l, i) => (
          <div key={i} className={l.cls || "text-zinc-300"}>
            {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black px-3 font-mono">
        <span className="text-cyan-400">{ircMode ? `${nick}>` : "$"}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          autoFocus
          spellCheck={false}
          className="flex-1 bg-transparent py-3 text-sm text-zinc-100 outline-none"
          placeholder={ircMode ? "message #haiku…" : "type a command…"}
        />
      </div>
    </div>
  );
}

function pickReply(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("hello") || m.includes("hi")) return "konnichiwa 🍵";
  if (m.includes("wallet")) return "keep that seed off the wire, friend.";
  if (m.includes("haiku")) return "five, seven, five — the river knows.";
  if (m.includes("?")) return "mu.";
  return BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];
}
