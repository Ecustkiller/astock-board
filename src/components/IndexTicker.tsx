import { useEffect, useState } from "react"
import { fetchQuote } from "../api"

// 大盘指数条：上证/深证/创业板/沪深300/科创50 实时涨跌。
// 接 /api/quote（带 sh/sz 前缀），每 30s 自刷新，独立于页面主刷新。
const INDICES = [
  { code: "sh000001", name: "上证指数" },
  { code: "sz399001", name: "深证成指" },
  { code: "sz399006", name: "创业板指" },
  { code: "sh000300", name: "沪深300" },
  { code: "sh000688", name: "科创50" },
]

export default function IndexTicker() {
  const [data, setData] = useState<Record<string, any>>({})

  useEffect(() => {
    let alive = true
    const load = () => {
      fetchQuote(INDICES.map((i) => i.code))
        .then((d) => alive && setData(d))
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 30000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 items-center text-sm">
      {INDICES.map((idx) => {
        const key = idx.code.replace(/^(sh|sz|bj)/, "")
        const q = data[key]
        const chg = q?.chg
        const col =
          chg == null ? "text-sub" : chg >= 0 ? "text-up" : "text-down"
        const sign = chg == null ? "" : chg >= 0 ? "+" : ""
        return (
          <div key={idx.code} className="flex items-baseline gap-1.5">
            <span className="text-sub">{idx.name}</span>
            <span className="text-ink tabular-nums">
              {q?.price != null ? q.price.toFixed(2) : "—"}
            </span>
            <span className={`tabular-nums ${col}`}>
              {q ? `${sign}${chg!.toFixed(2)}%` : "—"}
            </span>
          </div>
        )
      })}
    </div>
  )
}
