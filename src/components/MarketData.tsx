import { useMarket, Sparkline, fmt } from "../lib/market";

export default function MarketData() {
  const tickers = useMarket(2000);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Market Data</h2>
        <span className="flex items-center gap-2 text-xs text-emerald-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          live feed
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3 text-right">Price (USDT)</th>
              <th className="px-4 py-3 text-right">24h</th>
              <th className="px-4 py-3 text-right">Chart</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map((t) => {
              const up = t.change24h >= 0;
              return (
                <tr key={t.symbol} className="border-t border-zinc-800/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-100">{t.symbol}</div>
                    <div className="text-xs text-zinc-500">{t.name}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-200">
                    ${fmt(t.price)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      up ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {up ? "+" : ""}
                    {t.change24h.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Sparkline
                        data={t.history}
                        color={up ? "#34d399" : "#fb7185"}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-600">
        Offline simulated ticker (random-walk) so the app stays fully standalone.
      </p>
    </div>
  );
}
