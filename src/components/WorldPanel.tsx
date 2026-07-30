import { useEffect, useState } from "react"
import { fetchWorld, pct, chgColor } from "../api"

const GROUPS = [
  { title: "美股指数", symbols: ["^IXIC", "^GSPC", "^DJI", "^VIX"] },
  { title: "美股明星", symbols: ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META"] },
  { title: "中概股", symbols: ["BABA", "PDD", "NIO", "BIDU", "JD", "BILI"] },
  { title: "港股", symbols: ["0700.HK", "9988.HK", "3690.HK", "1810.HK", "0941.HK"] },
]
const ALL = GROUPS.flatMap((g) => g.symbols)

export default function WorldPanel() {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [updated, setUpdated] = useState<Date | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const arr = await fetchWorld(ALL)
      const map: Record<string, any> = {}
      arr.forEach((it: any) => {
        if (it && it.symbol) map[it.symbol.toUpperCase()] = it
      })
      setData(map)
      setUpdated(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="text-xs text-sub mb-3">
        国际行情 · Yahoo Finance 公开接口 · 每 30 秒刷新
        {updated ? ` · ${updated.toLocaleTimeString("zh-CN")}` : ""}
        {loading && " · 刷新中"}
      </div>
      {GROUPS.map((g) => (
        <section key={g.title} className="mb-5">
          <h2 className="text-sm text-sub mb-2">{g.title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {g.symbols.map((sym) => {
              const it = data[sym.toUpperCase()]
              return (
                <div key={sym} className="rounded-lg border border-edge bg-panel p-3">
                  <div className="truncate text-sm font-medium" title={it?.name || sym}>
                    {it?.name || sym}
                  </div>
                  <div className="text-xs text-sub">{sym}</div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="text-ink tabular-nums">
                      {it?.price != null ? it.price.toFixed(2) : "—"}
                    </span>
                    <span
                      className={`text-sm tabular-nums ${
                        it?.chgPct != null ? chgColor(it.chgPct) : "text-sub"
                      }`}
                    >
                      {it ? pct(it.chgPct) : "—"}
                    </span>
                  </div>
                  <div className="text-[11px] text-sub mt-0.5">{it?.currency || ""}</div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <div className="text-xs text-sub mt-2">
        注：国际行情为参考行情，非投资建议；美股按美东时间报价。
      </div>
    </div>
  )
}
