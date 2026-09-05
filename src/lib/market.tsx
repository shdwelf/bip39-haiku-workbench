import { useEffect, useRef, useState } from "react";

export interface Ticker {
  symbol: string;
  name: string;
  price: number;
  change24h: number; // percent
  history: number[];
}

const SEED_COINS: Omit<Ticker, "history" | "change24h">[] = [
  { symbol: "WAVES", name: "Waves", price: 1.34 },
  { symbol: "BTC", name: "Bitcoin", price: 64210 },
  { symbol: "ETH", name: "Ethereum", price: 3380 },
  { symbol: "USDT", name: "Tether", price: 1.0 },
  { symbol: "LTC", name: "Litecoin", price: 84.2 },
  { symbol: "XMR", name: "Monero", price: 168.5 },
];

function genHistory(price: number, n = 48): number[] {
  const out: number[] = [];
  let p = price * (0.9 + Math.random() * 0.1);
  for (let i = 0; i < n; i++) {
    p *= 1 + (Math.random() - 0.5) * 0.02;
    out.push(p);
  }
  out.push(price);
  return out;
}

// Simulated live market (random walk). Works fully offline / standalone.
export function useMarket(intervalMs = 2000): Ticker[] {
  const [tickers, setTickers] = useState<Ticker[]>(() =>
    SEED_COINS.map((c) => {
      const history = genHistory(c.price);
      return {
        ...c,
        history,
        change24h: ((history[history.length - 1] - history[0]) / history[0]) * 100,
      };
    })
  );
  const ref = useRef(tickers);
  ref.current = tickers;

  useEffect(() => {
    const t = setInterval(() => {
      setTickers((prev) =>
        prev.map((tk) => {
          if (tk.symbol === "USDT") return tk;
          const drift = (Math.random() - 0.5) * 0.012;
          const price = Math.max(0.0001, tk.price * (1 + drift));
          const history = [...tk.history.slice(1), price];
          return {
            ...tk,
            price,
            history,
            change24h: ((price - history[0]) / history[0]) * 100,
          };
        })
      );
    }, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return tickers;
}

export function Sparkline({
  data,
  color = "#22d3ee",
  w = 120,
  h = 36,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
