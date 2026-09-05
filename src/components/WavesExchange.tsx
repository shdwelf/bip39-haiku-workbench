import { useMemo, useState } from "react";
import { useMarket, fmt, Sparkline } from "../lib/market";
import { WORDLIST } from "../lib/wallet";

interface Account {
  seed: string;
  address: string;
  balances: Record<string, number>;
}

const ACC_KEY = "waves_acc_v1";

function genWavesAccount(): Account {
  const words: string[] = [];
  for (let i = 0; i < 15; i++)
    words.push(WORDLIST[Math.floor(Math.random() * WORDLIST.length)]);
  const seed = words.join(" ");
  // pseudo Waves address (3P… mainnet style) for display purposes
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let addr = "3P";
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = 0; i < 33; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    addr += chars[h % chars.length];
  }
  return {
    seed,
    address: addr,
    balances: { WAVES: 100, USDT: 5000, BTC: 0.05, ETH: 0.5 },
  };
}

function loadAcc(): Account | null {
  try {
    return JSON.parse(localStorage.getItem(ACC_KEY) || "") as Account;
  } catch {
    return null;
  }
}

export default function WavesExchange() {
  const market = useMarket(2000);
  const [acc, setAcc] = useState<Account | null>(loadAcc());
  const [pair, setPair] = useState("WAVES");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("10");
  const [revealSeed, setRevealSeed] = useState(false);

  const ticker = market.find((t) => t.symbol === pair)!;
  const price = ticker?.price ?? 0;

  const book = useMemo(() => {
    const asks = Array.from({ length: 7 }, (_, i) => ({
      p: price * (1 + (i + 1) * 0.0008),
      a: Math.random() * 500 + 10,
    }));
    const bids = Array.from({ length: 7 }, (_, i) => ({
      p: price * (1 - (i + 1) * 0.0008),
      a: Math.random() * 500 + 10,
    }));
    return { asks: asks.reverse(), bids };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, Math.round(price * 100)]);

  const createAcc = () => {
    const a = genWavesAccount();
    localStorage.setItem(ACC_KEY, JSON.stringify(a));
    setAcc(a);
  };

  const trade = () => {
    if (!acc) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const cost = amt * price;
    const b = { ...acc.balances };
    if (side === "buy") {
      if ((b.USDT ?? 0) < cost) return alert("Insufficient USDT");
      b.USDT -= cost;
      b[pair] = (b[pair] ?? 0) + amt;
    } else {
      if ((b[pair] ?? 0) < amt) return alert(`Insufficient ${pair}`);
      b[pair] -= amt;
      b.USDT = (b.USDT ?? 0) + cost;
    }
    const next = { ...acc, balances: b };
    setAcc(next);
    localStorage.setItem(ACC_KEY, JSON.stringify(next));
  };

  if (!acc) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
        <div className="text-5xl">🌊</div>
        <h2 className="text-xl font-semibold">wAves Lite Client</h2>
        <p className="text-sm text-zinc-400">
          A self-custodial Waves wallet & DEX. Generate a 15-word seed to begin
          (kept locally, offline).
        </p>
        <button
          onClick={createAcc}
          className="rounded-lg bg-cyan-500 px-5 py-2.5 font-semibold text-zinc-950 hover:bg-cyan-400"
        >
          Create Waves account
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Account */}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">🌊 Wallet</h2>
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Address</div>
          <div className="break-all font-mono text-xs text-cyan-300">{acc.address}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Balances</div>
          <div className="mt-1 space-y-1">
            {Object.entries(acc.balances).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-zinc-400">{k}</span>
                <span className="font-mono text-zinc-100">{fmt(v)}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => setRevealSeed((s) => !s)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          {revealSeed ? "hide" : "reveal"} backup seed
        </button>
        {revealSeed && (
          <code className="block break-all rounded bg-zinc-950 p-2 text-xs text-amber-300">
            {acc.seed}
          </code>
        )}
      </div>

      {/* Trade */}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Exchange</h2>
          <div className="flex items-center gap-2">
            <Sparkline data={ticker.history} />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          >
            {market
              .filter((t) => t.symbol !== "USDT")
              .map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol}/USDT
                </option>
              ))}
          </select>
          <div className="flex flex-1 items-center justify-end font-mono text-zinc-100">
            ${fmt(price)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSide("buy")}
            className={`rounded-lg py-2 text-sm font-semibold ${
              side === "buy" ? "bg-emerald-500 text-zinc-950" : "border border-zinc-700"
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setSide("sell")}
            className={`rounded-lg py-2 text-sm font-semibold ${
              side === "sell" ? "bg-rose-500 text-zinc-950" : "border border-zinc-700"
            }`}
          >
            Sell
          </button>
        </div>
        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Amount ({pair})
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
          />
        </label>
        <div className="flex justify-between text-sm text-zinc-400">
          <span>Total</span>
          <span className="font-mono">${fmt((parseFloat(amount) || 0) * price)}</span>
        </div>
        <button
          onClick={trade}
          className="w-full rounded-lg bg-cyan-500 py-2.5 font-semibold text-zinc-950 hover:bg-cyan-400"
        >
          {side === "buy" ? "Buy" : "Sell"} {pair}
        </button>
      </div>

      {/* Order book */}
      <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-lg font-semibold">Order Book</h2>
        <div className="grid grid-cols-2 text-[10px] uppercase tracking-wider text-zinc-500">
          <span>Price</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="space-y-0.5 font-mono text-xs">
          {book.asks.map((o, i) => (
            <div key={"a" + i} className="grid grid-cols-2 text-rose-400">
              <span>{fmt(o.p)}</span>
              <span className="text-right text-zinc-400">{o.a.toFixed(1)}</span>
            </div>
          ))}
          <div className="my-1 border-y border-zinc-800 py-1 text-center text-sm text-zinc-100">
            ${fmt(price)}
          </div>
          {book.bids.map((o, i) => (
            <div key={"b" + i} className="grid grid-cols-2 text-emerald-400">
              <span>{fmt(o.p)}</span>
              <span className="text-right text-zinc-400">{o.a.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
